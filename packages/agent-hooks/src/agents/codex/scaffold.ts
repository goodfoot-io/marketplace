import * as fs from "node:fs";
import * as path from "node:path";
import { HOOK_FACTORY_TO_EVENT, PACKAGE_NAME } from "./constants.js";
import type { HookEventName } from "./types.js";

export interface ScaffoldOptions {
  directory: string;
  hooks: string[];
  outputPath: string;
}

const CODEX_IMPORT_SPECIFIER = `${PACKAGE_NAME}/codex`;

const VALID_HOOK_EVENT_NAMES = new Set<HookEventName>(Object.values(HOOK_FACTORY_TO_EVENT));
const EVENT_LOOKUP = new Map(Array.from(VALID_HOOK_EVENT_NAMES).map((value) => [value.toLowerCase(), value]));

const EVENT_TO_FACTORY: Record<HookEventName, string> = Object.fromEntries(
  Object.entries(HOOK_FACTORY_TO_EVENT).map(([factory, eventName]) => [eventName, factory]),
) as Record<HookEventName, string>;

const EVENT_TO_OUTPUT: Record<HookEventName, string> = {
  PreToolUse: "preToolUseOutput",
  PostToolUse: "postToolUseOutput",
  PermissionRequest: "permissionRequestOutput",
  UserPromptSubmit: "userPromptSubmitOutput",
  SessionStart: "sessionStartOutput",
  SubagentStart: "subagentStartOutput",
  Stop: "stopOutput",
  SubagentStop: "subagentStopOutput",
  PreCompact: "preCompactOutput",
  PostCompact: "postCompactOutput",
};

export function validateHookNames(
  hookNames: string[],
): { valid: true; normalized: HookEventName[] } | { valid: false; error: string } {
  const normalized: HookEventName[] = [];
  const invalid: string[] = [];
  for (const hookName of hookNames) {
    const eventName = EVENT_LOOKUP.get(hookName.toLowerCase());
    if (eventName === undefined) {
      invalid.push(hookName);
    } else {
      normalized.push(eventName);
    }
  }
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Invalid hook names: ${invalid.join(", ")}. Valid names: ${Array.from(VALID_HOOK_EVENT_NAMES).join(", ")}`,
    };
  }
  return { valid: true, normalized };
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function generatePackageJson(projectName: string, outputPath: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "1.0.0",
      type: "module",
      scripts: {
        build: `agent-hooks --agent codex -i "src/**/*.ts" -o "${outputPath}"`,
        test: "vitest run",
        lint: "biome check .",
        typecheck: "tsc --noEmit",
      },
      dependencies: {
        [PACKAGE_NAME]: "^1.0.10",
      },
      devDependencies: {
        "@biomejs/biome": "2.4.9",
        "@types/node": "^24.0.0",
        typescript: "^5.9.3",
        vitest: "^4.0.13",
      },
      engines: {
        node: ">=20.11.0",
      },
    },
    null,
    2,
  )}\n`;
}

function generateTsConfig(): string {
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

function generateBiomeConfig(): string {
  return `{
  "$schema": "https://biomejs.dev/schemas/2.4.9/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "files": {
    "includes": ["src/**/*.ts", "test/**/*.ts", "*.ts"]
  }
}
`;
}

function generateVitestConfig(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
`;
}

function generateReadme(projectName: string, hooks: HookEventName[]): string {
  const hookList = hooks.map((hookName) => `\`${hookName}\``).join(", ");
  return `# ${projectName}

This project contains Codex hooks built with \`${PACKAGE_NAME}\`. The scaffold is intentionally narrow: it targets only the five synchronous command hook events Codex currently supports. This project includes: ${hookList}.

Run \`npm install\`, then \`npm run build\` to compile the hooks and generate \`hooks.json\`. Use \`npm test\` to run the starter tests.
`;
}

function generateGitignore(): string {
  return `dist/
node_modules/
*.log
`;
}

function generateHookSource(eventName: HookEventName): string {
  const factory = EVENT_TO_FACTORY[eventName];
  const output = EVENT_TO_OUTPUT[eventName];
  const importItems = [factory, output].join(", ");

  switch (eventName) {
    case "PreToolUse":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "Bash" }, (input) => {
  // Codex does not give tool_input a fixed schema, so it's typed "unknown" —
  // narrow before reading a field off it.
  const toolInput = input.tool_input as { command?: unknown };
  const command = typeof toolInput.command === "string" ? toolInput.command : "";
  if (command.includes("rm -rf")) {
    return ${output}({
      systemMessage: "Blocked dangerous shell command.",
      permissionDecision: "deny",
      permissionDecisionReason: "Refusing destructive Bash command.",
    });
  }
});
`;
    case "PostToolUse":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "Bash" }, (input) => {
  // Codex does not give tool_input a fixed schema, so it's typed "unknown" —
  // narrow before reading a field off it.
  const toolInput = input.tool_input as { command?: unknown };
  const command = typeof toolInput.command === "string" ? toolInput.command : "<unknown>";
  return ${output}({
    additionalContext: \`Observed Bash command: \${command}\`,
  });
});
`;
    case "SessionStart":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "startup" }, () => {
  return ${output}({
    additionalContext: "Project-specific Codex hook context loaded.",
  });
});
`;
    case "UserPromptSubmit":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({}, (input) => {
  if (input.prompt.trim().length === 0) {
    return ${output}({
      decision: "block",
      reason: "Prompt must not be empty.",
    });
  }
});
`;
    case "Stop":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({}, (input) => {
  if (input.stop_hook_active && input.last_assistant_message === null) {
    return ${output}({
      continue: true,
      systemMessage: "Stop hook observed an empty assistant message.",
    });
  }
});
`;
    case "PermissionRequest":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "Bash" }, (input) => {
  return ${output}({
    behavior: "allow",
    message: \`Allowed \${input.tool_name} via PermissionRequest hook.\`,
  });
});
`;
    case "SubagentStart":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: ".*" }, (input) => {
  return ${output}({
    additionalContext: \`Subagent \${input.agent_type} (\${input.agent_id}) starting.\`,
  });
});
`;
    case "SubagentStop":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: ".*" }, (input) => {
  if (input.last_assistant_message === null) {
    return ${output}({
      decision: "block",
      reason: \`Subagent \${input.agent_type} produced no message.\`,
    });
  }
});
`;
    case "PreCompact":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "manual" }, () => {
  return ${output}({
    systemMessage: "Compaction starting.",
  });
});
`;
    case "PostCompact":
      return `import { ${importItems} } from "${CODEX_IMPORT_SPECIFIER}";

export default ${factory}({ matcher: "manual" }, () => {
  return ${output}({
    systemMessage: "Compaction complete.",
  });
});
`;
  }
}

function generateHookTest(eventName: HookEventName): string {
  const filename = toKebabCase(eventName);
  return `import { describe, expect, it } from "vitest";
import hook from "../src/${filename}.js";

describe("${eventName} hook", () => {
  it("exports a ${eventName} hook", () => {
    expect(hook.hookEventName).toBe("${eventName}");
  });
});
`;
}

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
  fs.writeFileSync(path.join(directory, "package.json"), generatePackageJson(projectName, outputPath));
  fs.writeFileSync(path.join(directory, "tsconfig.json"), generateTsConfig());
  fs.writeFileSync(path.join(directory, "biome.json"), generateBiomeConfig());
  fs.writeFileSync(path.join(directory, "vitest.config.ts"), generateVitestConfig());
  fs.writeFileSync(path.join(directory, ".gitignore"), generateGitignore());
  fs.writeFileSync(path.join(directory, "README.md"), generateReadme(projectName, validation.normalized));

  for (const hookName of validation.normalized) {
    const baseName = toKebabCase(hookName);
    fs.writeFileSync(path.join(directory, "src", `${baseName}.ts`), generateHookSource(hookName));
    fs.writeFileSync(path.join(directory, "test", `${baseName}.test.ts`), generateHookTest(hookName));
  }
}
