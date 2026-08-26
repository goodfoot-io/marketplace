/**
 * Conformance matrix for the OpenCode entry point (plan task 24).
 *
 * Unlike the Codex conformance suite, which drives a compiled bundle over
 * stdin/stdout in a child process, OpenCode plugins are imported and invoked
 * in-process — that's how OpenCode's real loader consumes them, and it's the
 * only way to exercise `server(input)`'s returned `Hooks` map directly rather
 * than through a wire protocol that doesn't exist for this agent. Every case
 * still goes through a real `esbuild` compile (`compileOpenCodePlugin`) and a
 * real dynamic `import()` of the written artifact (`validateOpenCodePluginModule`),
 * so a case here would trip on the same bundling and shape mismatches
 * OpenCode's own loader would hit.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileOpenCodePlugin, validateOpenCodePluginModule } from "../../src/agents/opencode/cli-support.js";
import type { Hooks, Plugin, PluginInput, PluginModule } from "../../src/agents/opencode/types.js";
import { buildEsbuildLoaderMap } from "../../src/cli.js";

let workDir: string;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-opencode-conformance-"));
});

afterAll(() => {
  if (workDir !== undefined) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

const LOADERS = buildEsbuildLoaderMap([]);

/** Compiles `source` and imports the resulting artifact's default export. */
async function compileAndImport(source: string): Promise<unknown> {
  const caseDir = fs.mkdtempSync(path.join(workDir, "case-"));
  const sourcePath = path.join(caseDir, "plugin.ts");
  const outputPath = path.join(caseDir, "plugin.mjs");
  fs.writeFileSync(sourcePath, source);

  const bundled = await compileOpenCodePlugin(sourcePath, LOADERS);
  fs.writeFileSync(outputPath, bundled, { encoding: "utf-8" });
  await validateOpenCodePluginModule(outputPath);

  const imported = (await import(pathToFileURL(outputPath).href)) as { default: unknown };
  return imported.default;
}

function mockPluginInput(): PluginInput {
  return {
    client: {} as PluginInput["client"],
    project: {
      id: "proj-1",
      worktree: "/tmp/worktree",
      vcs: "git",
      time: { created: 0, initialized: 0 },
    } as PluginInput["project"],
    directory: "/tmp/worktree",
    worktree: "/tmp/worktree",
    experimental_workspace: { register: () => undefined },
    serverUrl: new URL("http://localhost:0"),
    $: (() => {
      throw new Error("$ shell should not be invoked by these conformance cases");
    }) as unknown as PluginInput["$"],
  };
}

const OPENCODE_ENTRY_SOURCE = fileURLToPath(new URL("../../src/agents/opencode/index.ts", import.meta.url));

describe("module discovery and validation (validateOpenCodePluginModule)", () => {
  it("accepts a { id, server } module built through defineOpenCodePlugin", async () => {
    const defaultExport = await compileAndImport(
      `
        import { defineOpenCodePlugin } from ${JSON.stringify(OPENCODE_ENTRY_SOURCE)};
        export default defineOpenCodePlugin({ id: "conformance-plugin", server: async () => ({}) });
      `,
    );
    expect(defaultExport).toMatchObject({ id: "conformance-plugin" });
    expect(typeof (defaultExport as PluginModule).server).toBe("function");
  });

  it("accepts a bare server function default export (no wrapper object)", async () => {
    const defaultExport = await compileAndImport(`export default async () => ({});\n`);
    expect(typeof defaultExport).toBe("function");
  });

  it("rejects a built artifact whose default export matches neither shape", async () => {
    const caseDir = fs.mkdtempSync(path.join(workDir, "case-"));
    const sourcePath = path.join(caseDir, "plugin.ts");
    const outputPath = path.join(caseDir, "plugin.mjs");
    fs.writeFileSync(sourcePath, `export default { notServer: true };\n`);

    const bundled = await compileOpenCodePlugin(sourcePath, LOADERS);
    fs.writeFileSync(outputPath, bundled, { encoding: "utf-8" });

    await expect(validateOpenCodePluginModule(outputPath)).rejects.toThrow(
      /default export must be a function or a \{ server \} object/,
    );
  });
});

describe("event delivery and root/child/resumed session tracking (createRootSessionRegistry)", () => {
  it("treats a session first observed via session.created as root, a nested one as a child", async () => {
    const defaultExport = await compileAndImport(
      `
        import { createRootSessionRegistry } from ${JSON.stringify(OPENCODE_ENTRY_SOURCE)};
        const registry = createRootSessionRegistry();
        export default async () => ({
          event: async ({ event }) => {
            if (event.type === "session.created") {
              registry.observe(event.properties.info.id, event.properties.info.parentID);
            }
          },
          "tool.execute.before": async (input, output) => {
            output.args = { ...output.args, isRootSession: registry.isRoot(input.sessionID) };
          },
        });
      `,
    );
    const hooks = await (defaultExport as Plugin)(mockPluginInput());

    await hooks.event?.({ event: sessionCreatedEvent("root-session", undefined) });
    await hooks.event?.({ event: sessionCreatedEvent("child-session", "root-session") });

    const rootOutput = { args: {} };
    await hooks["tool.execute.before"]?.({ tool: "bash", sessionID: "root-session", callID: "call-1" }, rootOutput);
    expect(rootOutput.args).toMatchObject({ isRootSession: true });

    const childOutput = { args: {} };
    await hooks["tool.execute.before"]?.({ tool: "bash", sessionID: "child-session", callID: "call-2" }, childOutput);
    expect(childOutput.args).toMatchObject({ isRootSession: false });
  });

  it("marks a session first observed through a non-created event (e.g. session.updated) as resumed", async () => {
    const defaultExport = await compileAndImport(
      `
        import { createRootSessionRegistry } from ${JSON.stringify(OPENCODE_ENTRY_SOURCE)};
        const registry = createRootSessionRegistry();
        export default async () => ({
          event: async ({ event }) => {
            if (event.type === "session.created") {
              registry.observe(event.properties.info.id, event.properties.info.parentID);
            } else if (event.type === "session.updated") {
              registry.observeResumed(event.properties.info.id, event.properties.info.parentID);
            }
          },
          "tool.execute.before": async (input, output) => {
            output.args = { ...output.args, isResumedSession: registry.isResumed(input.sessionID) };
          },
        });
      `,
    );
    const hooks = await (defaultExport as Plugin)(mockPluginInput());

    // No session.created ever arrives for this id — it first appears via
    // session.updated, the resumed-session signal.
    await hooks.event?.({ event: sessionUpdatedEvent("resumed-session", undefined) });

    const output = { args: {} };
    await hooks["tool.execute.before"]?.({ tool: "bash", sessionID: "resumed-session", callID: "call-1" }, output);
    expect(output.args).toMatchObject({ isResumedSession: true });
  });
});

describe("tool.execute.before -> tool.execute.after mutation round-trip", () => {
  it("carries a value written in before through to the after callback's own output mutation", async () => {
    const defaultExport = await compileAndImport(
      `
        export default async () => {
          const timeoutBySessionID = new Map();
          return {
            "tool.execute.before": async (input, output) => {
              timeoutBySessionID.set(input.sessionID, 30000);
              output.args = { ...output.args, timeout: timeoutBySessionID.get(input.sessionID) };
            },
            "tool.execute.after": async (input, output) => {
              output.metadata = { ...output.metadata, timeoutApplied: timeoutBySessionID.get(input.sessionID) };
            },
          };
        };
      `,
    );
    const hooks = await (defaultExport as Plugin)(mockPluginInput());

    const before = { args: {} };
    await hooks["tool.execute.before"]?.({ tool: "bash", sessionID: "sess-1", callID: "call-1" }, before);
    expect(before.args).toMatchObject({ timeout: 30000 });

    const after = { title: "bash", output: "", metadata: {} };
    await hooks["tool.execute.after"]?.(
      { tool: "bash", sessionID: "sess-1", callID: "call-1", args: before.args },
      after,
    );
    expect(after.metadata).toMatchObject({ timeoutApplied: 30000 });
  });
});

describe("error isolation: policy-enforcing vs. advisory callbacks", () => {
  it("propagates a thrown error from the policy-enforcing permission.ask callback", async () => {
    const defaultExport = await compileAndImport(
      `
        export default async () => ({
          "permission.ask": async () => {
            throw new Error("permission handler exploded");
          },
        });
      `,
    );
    const hooks = await (defaultExport as Plugin)(mockPluginInput());

    await expect(
      hooks["permission.ask"]?.(
        {
          id: "perm-1",
          type: "bash",
          sessionID: "sess-1",
          messageID: "msg-1",
          callID: "call-1",
          title: "run bash",
          metadata: {},
          time: { created: 0 },
        } as Parameters<NonNullable<Hooks["permission.ask"]>>[0],
        { status: "ask" },
      ),
    ).rejects.toThrow("permission handler exploded");
  });

  it("swallows a thrown error from an advisory callback guarded with the continue policy", async () => {
    const defaultExport = await compileAndImport(
      `
        import { guardAdvisory } from ${JSON.stringify(OPENCODE_ENTRY_SOURCE)};
        export default async () => ({
          event: guardAdvisory("event", async () => {
            throw new Error("advisory enrichment blew up");
          }, "continue"),
        });
      `,
    );
    const hooks = await (defaultExport as Plugin)(mockPluginInput());

    await expect(hooks.event?.({ event: sessionCreatedEvent("sess-1", undefined) })).resolves.toBeUndefined();
  });

  it("propagates a thrown error from an advisory callback with no continue policy configured", async () => {
    const defaultExport = await compileAndImport(
      `
        import { guardAdvisory } from ${JSON.stringify(OPENCODE_ENTRY_SOURCE)};
        export default async () => ({
          event: guardAdvisory("event", async () => {
            throw new Error("advisory enrichment blew up, unguarded");
          }, undefined),
        });
      `,
    );
    const hooks = await (defaultExport as Plugin)(mockPluginInput());

    await expect(hooks.event?.({ event: sessionCreatedEvent("sess-1", undefined) })).rejects.toThrow(
      "advisory enrichment blew up, unguarded",
    );
  });
});

function sessionCreatedEvent(
  id: string,
  parentID: string | undefined,
): Parameters<NonNullable<Hooks["event"]>>[0]["event"] {
  return {
    type: "session.created",
    properties: { info: mockSession(id, parentID) },
  } as Parameters<NonNullable<Hooks["event"]>>[0]["event"];
}

function sessionUpdatedEvent(
  id: string,
  parentID: string | undefined,
): Parameters<NonNullable<Hooks["event"]>>[0]["event"] {
  return {
    type: "session.updated",
    properties: { info: mockSession(id, parentID) },
  } as Parameters<NonNullable<Hooks["event"]>>[0]["event"];
}

function mockSession(id: string, parentID: string | undefined): Record<string, unknown> {
  return {
    id,
    projectID: "proj-1",
    directory: "/tmp/worktree",
    parentID,
    title: "conformance session",
    version: "1.0.0",
    time: { created: 0, updated: 0 },
  };
}
