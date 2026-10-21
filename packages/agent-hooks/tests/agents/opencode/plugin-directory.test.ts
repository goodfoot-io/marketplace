import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { runOpenCodeCli } from "../../../src/agents/opencode/cli-support.js";

describe("OpenCode plugin directory output", () => {
  it("packages every selected plugin as a loadable directory", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-plugin-directory-"));
    try {
      const inputDir = path.join(tempDir, "input");
      const outputDir = path.join(tempDir, "output");
      fs.mkdirSync(inputDir);
      for (const name of ["first", "second"]) {
        fs.writeFileSync(
          path.join(inputDir, `${name}.ts`),
          `export default { id: ${JSON.stringify(name)}, setup: async () => ({}) };`,
        );
      }

      const compiled = await runOpenCodeCli({
        input: path.join(inputDir, "*.ts"),
        output: outputDir,
        loaderFlags: [],
      });

      expect(compiled).toHaveLength(2);
      for (const { sourcePath, outputPath } of compiled) {
        const name = path.basename(sourcePath, ".ts");
        expect(outputPath).toBe(path.join(outputDir, name));
        expect(fs.statSync(outputPath).isDirectory()).toBe(true);
        const manifest = JSON.parse(fs.readFileSync(path.join(outputPath, "package.json"), "utf8"));
        expect(manifest).toMatchObject({
          type: "module",
          main: "index.js",
          exports: "./index.js",
          private: true,
        });
        const entrypoint = pathToFileURL(path.join(outputPath, manifest.main)).href;
        const plugin = (await import(entrypoint)).default;
        expect(plugin.id).toBe(name);
        expect(plugin.setup).toBeTypeOf("function");
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
