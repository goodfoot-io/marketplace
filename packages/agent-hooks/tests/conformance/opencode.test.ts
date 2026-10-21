/** Compiled V2 plugins exercise the same default export and setup registrations consumed by OpenCode. */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileOpenCodePlugin, validateOpenCodePluginModule } from "../../src/agents/opencode/cli-support.js";
import type { PluginInput, PluginModule } from "../../src/agents/opencode/types.js";
import { buildEsbuildLoaderMap } from "../../src/cli.js";

let workDir: string;
beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-hooks-opencode-v2-"));
});
afterAll(() => fs.rmSync(workDir, { recursive: true, force: true }));
const entry = fileURLToPath(new URL("../../src/agents/opencode/index.ts", import.meta.url));
async function compile(source: string): Promise<string> {
  const dir = fs.mkdtempSync(path.join(workDir, "case-"));
  const sourcePath = path.join(dir, "plugin.ts");
  const outputPath = path.join(dir, "plugin.mjs");
  fs.writeFileSync(sourcePath, source);
  fs.writeFileSync(outputPath, await compileOpenCodePlugin(sourcePath, buildEsbuildLoaderMap([])));
  return outputPath;
}
describe("OpenCode V2 compiled plugin contract", () => {
  it("registers mutable before/after tool hooks through setup and returns cleanup", async () => {
    const outputPath = await compile(`
      import { defineOpenCodePlugin } from ${JSON.stringify(entry)};
      export default defineOpenCodePlugin({ id: "round-trip", async setup(ctx) {
        await ctx.tool.hook("execute.before", event => { event.input.timeout = 30000; });
        await ctx.tool.hook("execute.after", event => {
          if (event.status === "completed") event.result.metadata = { timeoutApplied: event.input.timeout };
        });
        return () => { ctx.options.cleaned = true; };
      }});
    `);
    await validateOpenCodePluginModule(outputPath);
    const plugin = (await import(pathToFileURL(outputPath).href)).default as PluginModule;
    const callbacks = new Map<string, (event: Record<string, unknown>) => Promise<void>>();
    const options: Record<string, unknown> = {};
    const context = {
      options,
      tool: {
        hook: async (name: string, callback: (event: Record<string, unknown>) => Promise<void>) => {
          callbacks.set(name, callback);
          return { dispose: async () => {} };
        },
      },
    } as unknown as PluginInput;
    const cleanup = await plugin.setup(context);
    const input = {};
    await callbacks.get("execute.before")?.({ input });
    expect(input).toEqual({ timeout: 30000 });
    const result = { metadata: {} };
    await callbacks.get("execute.after")?.({ input, status: "completed", result });
    expect(result.metadata).toEqual({ timeoutApplied: 30000 });
    await cleanup?.();
    expect(options.cleaned).toBe(true);
  });
  it.each([
    "export default async () => ({});",
    "export default { id: 'legacy', server: async () => ({}) };",
    "export default { id: '', setup() {} };",
    "export default { id: 'invalid' };",
  ])("rejects invalid or V1 entrypoint %s", async (source) => {
    await expect(validateOpenCodePluginModule(await compile(source))).rejects.toThrow(/V2 \{ id, setup \}/);
  });
  it("propagates permission evaluation failures while guarded enrichment may continue", async () => {
    const outputPath = await compile(`
      import { defineOpenCodePlugin, guardAdvisory } from ${JSON.stringify(entry)};
      export default defineOpenCodePlugin({ id: "policy", async setup(ctx) {
        await ctx.permission.hook("evaluate", () => { throw new Error("denied"); });
        await ctx.session.hook("context", guardAdvisory("session.context", () => { throw new Error("enrichment"); }, "continue"));
      }});
    `);
    await validateOpenCodePluginModule(outputPath);
    const plugin = (await import(pathToFileURL(outputPath).href)).default as PluginModule;
    const callbacks = new Map<string, (event: unknown) => Promise<void>>();
    const hook = async (name: string, callback: (event: unknown) => Promise<void>) => {
      callbacks.set(name, callback);
      return { dispose: async () => {} };
    };
    await plugin.setup({ permission: { hook }, session: { hook } } as unknown as PluginInput);
    await expect(async () => callbacks.get("evaluate")?.({})).rejects.toThrow("denied");
    await expect(callbacks.get("context")?.({})).resolves.toBeUndefined();
  });
});
