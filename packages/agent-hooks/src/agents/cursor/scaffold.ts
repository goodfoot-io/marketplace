/** Create a complete Cursor plugin project, without overwriting existing files. */
import * as fs from "node:fs";
import * as path from "node:path";
import { HOOK_EVENT_NAMES } from "./events.js";
import type { HookEventName } from "./types.js";

export interface ScaffoldOptions {
  directory: string;
  hooks: string;
  outputPath: string;
}

/** Accept native camelCase and conventional PascalCase spellings, but no unknown events. */
export function parseHookNames(requested: string): HookEventName[] {
  const names = requested
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!names.length) throw new Error("Cursor scaffold requires at least one hook name");
  return [
    ...new Set(
      names.map((name) => {
        const event = HOOK_EVENT_NAMES.find((candidate) => candidate.toLowerCase() === name.toLowerCase());
        if (!event) throw new Error(`Unknown Cursor hook ${name}. Valid names: ${HOOK_EVENT_NAMES.join(", ")}`);
        return event;
      }),
    ),
  ];
}

function kebab(event: string): string {
  return event.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function source(event: HookEventName): string {
  const config =
    event === "preToolUse"
      ? '{ matcher: "Shell", failClosed: true }'
      : event === "postToolUse"
        ? '{ matcher: "Shell" }'
        : event === "beforeSubmitPrompt"
          ? "{ failClosed: true }"
          : event === "stop" || event === "subagentStop"
            ? "{ loopLimit: 5 }"
            : "{}";
  const options =
    event === "sessionStart" || event === "postToolUse"
      ? '{ additionalContext: "Run the relevant checks before reporting completion." }'
      : event === "preToolUse"
        ? '{ permission: "allow" }'
        : event === "beforeSubmitPrompt"
          ? "{ continue: true }"
          : "{}";
  return `import { ${event}Hook, ${event}Output } from "@goodfoot/agent-hooks/cursor";

export default ${event}Hook(${config}, (_input, { logger }) => {
  logger.info("${event} hook invoked");
  return ${event}Output(${options});
});
`;
}

/** Returns the number of generated hooks. All validation precedes filesystem writes. */
export function scaffoldProject(options: ScaffoldOptions): number {
  const events = parseHookNames(options.hooks);
  const directory = path.resolve(options.directory);
  const output = path.normalize(options.outputPath).split(path.sep).join("/");
  if (path.isAbsolute(output) || output === ".." || output.startsWith("../") || !output.endsWith(".json")) {
    throw new Error("Cursor scaffold output must be a plugin-relative .json path");
  }
  if (["package.json", "tsconfig.json", "biome.json", ".cursor-plugin/plugin.json"].includes(output)) {
    throw new Error("Cursor scaffold output must not overwrite project or plugin metadata");
  }
  if (fs.existsSync(directory)) throw new Error(`Directory already exists: ${directory}`);
  const name = path
    .basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!name) throw new Error("Cursor plugin directory must contain an alphanumeric name");
  const pkg = JSON.parse(fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  const quotedOutput = `'${output.replace(/'/g, "'\\''")}'`;
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const files: Record<string, string> = {
    "package.json": json({
      name,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        build: `agent-hooks --agent cursor -i 'src/**/*.ts' -o ${quotedOutput}`,
        typecheck: "tsc --noEmit",
        test: "vitest run",
        lint: "biome check .",
      },
      dependencies: { "@goodfoot/agent-hooks": `^${pkg.version}` },
      devDependencies: { "@biomejs/biome": "2.4.16", "@types/node": "^26.6.5", typescript: "^5.9.3", vitest: "^5.0.4" },
      engines: { node: ">=20.11.0" },
    }),
    ".cursor-plugin/plugin.json": json({
      name,
      version: "1.0.0",
      description: `Cursor hooks for ${name}`,
      ...(output !== "hooks/hooks.json" ? { hooks: `./${output}` } : {}),
    }),
    "tsconfig.json": json({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src/**/*.ts", "test/**/*.ts"],
    }),
    "biome.json": json({
      $schema: "https://biomejs.dev/schemas/2.4.16/schema.json",
      formatter: { indentStyle: "space", indentWidth: 2, lineWidth: 120 },
      files: { includes: ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"] },
    }),
    "vitest.config.ts":
      'import { defineConfig } from "vitest/config";\n\nexport default defineConfig({ test: { include: ["test/**/*.test.ts"] } });\n',
    ".gitignore": "node_modules/\n*.log\n",
    "README.md": `# ${name}

Install dependencies with \`yarn install\`, then run \`yarn typecheck\`, \`yarn test\`, and \`yarn build\`.
Ship this directory with its \`.cursor-plugin/plugin.json\`, \`${output}\`, and generated bundles.
Build output must be included in the installed plugin.

Factory timeouts are milliseconds; the generated manifest uses seconds.
Permission hooks default to \`failClosed: true\`. Only sessionStart and postToolUse allow
\`unexpectedError: "continue"\`. sessionStart is fire-and-forget, not a permission gate.
For stop/subagentStop, \`loopLimit\` belongs in factory configuration; \`followupMessage\` belongs in the reply.
Generated commands use POSIX shell quoting. Stop hooks use Cursor's CURSOR_PLUGIN_ROOT environment variable.
`,
  };
  for (const event of events) {
    const stem = kebab(event);
    files[`src/${stem}.ts`] = source(event);
    files[`test/${stem}.test.ts`] = `import { expect, it } from "vitest";
import hook from "../src/${stem}.js";

it("binds ${event}", () => {
  expect(hook.hookEventName).toBe("${event}");
});
`;
  }
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(directory, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return events.length;
}
