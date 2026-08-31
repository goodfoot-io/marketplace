import * as fs from "node:fs";
import * as path from "node:path";
import { HOOK_FACTORY_TO_EVENT, PACKAGE_NAME } from "./constants.js";
import type { HookEventName } from "./types.js";

export interface ScaffoldOptions {
  directory: string;
  hooks: string[];
  outputPath: string;
}

const IMPORT_SPECIFIER = `${PACKAGE_NAME}/antigravity`;

const EVENT_NAMES = Object.values(HOOK_FACTORY_TO_EVENT);
const EVENT_LOOKUP = new Map(EVENT_NAMES.map((event) => [event.toLowerCase(), event]));

const EVENT_TO_FACTORY = Object.fromEntries(
  Object.entries(HOOK_FACTORY_TO_EVENT).map(([factory, event]) => [event, factory]),
) as Record<HookEventName, string>;

const EVENT_TO_OUTPUT: Record<HookEventName, string> = {
  PreToolUse: "preToolUseOutput",
  PostToolUse: "postToolUseOutput",
  PreInvocation: "preInvocationOutput",
  PostInvocation: "postInvocationOutput",
  Stop: "stopOutput",
};

/** Resolves user-supplied hook names case-insensitively, rejecting the whole list on any miss. */
export function validateHookNames(
  requested: string[],
): { valid: true; normalized: HookEventName[] } | { valid: false; error: string } {
  const normalized: HookEventName[] = [];
  const rejected: string[] = [];
  for (const name of requested) {
    const event = EVENT_LOOKUP.get(name.toLowerCase());
    if (event === undefined) {
      rejected.push(name);
    } else {
      normalized.push(event);
    }
  }
  if (rejected.length > 0) {
    return {
      valid: false,
      error: `Invalid hook names: ${rejected.join(", ")}. Valid names: ${EVENT_NAMES.join(", ")}`,
    };
  }
  return { valid: true, normalized };
}

function kebab(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function packageJson(projectName: string, outputPath: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "1.0.0",
      type: "module",
      scripts: {
        build: `agent-hooks --agent antigravity -i "src/**/*.ts" -o "${outputPath}"`,
        test: "vitest run",
        lint: "biome check .",
        typecheck: "tsc --noEmit",
      },
      dependencies: { [PACKAGE_NAME]: "^1.0.10" },
      devDependencies: {
        "@biomejs/biome": "2.4.9",
        "@types/node": "^24.0.0",
        typescript: "^5.9.3",
        vitest: "^4.0.13",
      },
      engines: { node: ">=20.11.0" },
    },
    null,
    2,
  )}\n`;
}

function pluginJson(projectName: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "1.0.0",
      description: `Antigravity hooks built with ${PACKAGE_NAME}`,
    },
    null,
    2,
  )}\n`;
}

function tsConfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ["src/**/*.ts", "test/**/*.ts"],
      exclude: ["dist", "node_modules"],
    },
    null,
    2,
  )}\n`;
}

function biomeConfig(): string {
  return `{
  "$schema": "https://biomejs.dev/schemas/2.4.9/schema.json",
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 120 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "assist": { "actions": { "source": { "organizeImports": "on" } } },
  "files": { "includes": ["src/**/*.ts", "test/**/*.ts", "*.ts"] }
}
`;
}

function vitestConfig(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
`;
}

function readme(projectName: string, events: HookEventName[]): string {
  return `# ${projectName}

Antigravity hooks built with \`${PACKAGE_NAME}\`. This project includes: ${events.map((event) => `\`${event}\``).join(", ")}.

Run \`npm install\`, then \`npm run build\` to compile the hooks and write \`hooks.json\`. Antigravity reads that manifest from the plugin root and runs each command with its working directory set to the manifest's own directory, so the generated commands are relative and need no rewriting after install.

Every hook replies at exit 0: Antigravity has no exit-code channel, and each decision travels inside the JSON payload on stdout.
`;
}

function gitignore(): string {
  return `bin/
dist/
node_modules/
*.log
`;
}

function hookSource(event: HookEventName): string {
  const factory = EVENT_TO_FACTORY[event];
  const output = EVENT_TO_OUTPUT[event];

  switch (event) {
    case "PreToolUse":
      return `import { ${factory}, ${output} } from "${IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "run_command" }, (input) => {
  // Antigravity gives tool arguments no fixed schema, so narrow before reading.
  const commandLine = input.toolCall.args.CommandLine;
  if (typeof commandLine === "string" && commandLine.includes("rm -rf")) {
    return ${output}({ decision: "deny", reason: "Refusing a destructive shell command." });
  }
  return ${output}({ decision: "allow" });
});
`;
    case "PostToolUse":
      return `import { ${factory}, ${output} } from "${IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "run_command" }, (input, { logger }) => {
  // PostToolUse has no reply channel: the contract defines its output as {}.
  // Report findings through the logger, never through stdout.
  logger.info("Tool step finished", { stepIdx: input.stepIdx, error: input.error });
  return ${output}();
});
`;
    case "PreInvocation":
      return `import { ${factory}, ${output} } from "${IMPORT_SPECIFIER}";

export default ${factory}({}, () => {
  return ${output}({
    injectSteps: [{ ephemeralMessage: "Check for lint errors before proposing changes." }],
  });
});
`;
    case "PostInvocation":
      return `import { ${factory}, ${output} } from "${IMPORT_SPECIFIER}";

export default ${factory}({}, (input) => {
  if (input.invocationNum < 2) {
    return ${output}({ terminationBehavior: "force_continue" });
  }
  return ${output}({});
});
`;
    case "Stop":
      return `import { ${factory}, ${output} } from "${IMPORT_SPECIFIER}";

export default ${factory}({}, (input) => {
  if (!input.fullyIdle) {
    return ${output}({ decision: "continue", reason: "Background tasks are still running." });
  }
  return ${output}({});
});
`;
  }
}

function hookTest(event: HookEventName): string {
  return `import { describe, expect, it } from "vitest";
import hook from "../src/${kebab(event)}.js";

describe("${event} hook", () => {
  it("exports a ${event} hook", () => {
    expect(hook.hookEventName).toBe("${event}");
  });
});
`;
}

/** Creates a new Antigravity hook project. Refuses to write into an existing directory. */
export function scaffoldProject(options: ScaffoldOptions): void {
  const validation = validateHookNames(options.hooks);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const { directory, outputPath } = options;
  if (fs.existsSync(directory)) {
    throw new Error(`Directory already exists: ${directory}`);
  }

  fs.mkdirSync(path.join(directory, "src"), { recursive: true });
  fs.mkdirSync(path.join(directory, "test"), { recursive: true });

  const projectName = path.basename(directory);
  fs.writeFileSync(path.join(directory, "package.json"), packageJson(projectName, outputPath));
  fs.writeFileSync(path.join(directory, "plugin.json"), pluginJson(projectName));
  fs.writeFileSync(path.join(directory, "tsconfig.json"), tsConfig());
  fs.writeFileSync(path.join(directory, "biome.json"), biomeConfig());
  fs.writeFileSync(path.join(directory, "vitest.config.ts"), vitestConfig());
  fs.writeFileSync(path.join(directory, ".gitignore"), gitignore());
  fs.writeFileSync(path.join(directory, "README.md"), readme(projectName, validation.normalized));

  for (const event of validation.normalized) {
    fs.writeFileSync(path.join(directory, "src", `${kebab(event)}.ts`), hookSource(event));
    fs.writeFileSync(path.join(directory, "test", `${kebab(event)}.test.ts`), hookTest(event));
  }
}
