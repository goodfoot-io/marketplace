import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runOpenCodeCli } from "../../../src/agents/opencode/cli-support.js";

describe("OpenCode directory rebuild safety", () => {
  it("preserves the previous build and author files when a rebuilt module fails validation", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-rebuild-"));
    try {
      const source = path.join(tempDir, "plugin.ts");
      const output = path.join(tempDir, "output");
      const args = { input: source, output, loaderFlags: [] };
      fs.writeFileSync(source, 'export default { id: "valid", setup: async () => ({}) };');
      await runOpenCodeCli(args);
      const entry = path.join(output, "plugin", "index.js");
      const original = fs.readFileSync(entry, "utf8");
      const authorFile = path.join(output, "plugin", "notes.txt");
      fs.writeFileSync(authorFile, "keep me");
      fs.writeFileSync(source, "export default {}; ");
      await expect(runOpenCodeCli(args)).rejects.toThrow("default export must be a V2");
      expect(fs.readFileSync(entry, "utf8")).toBe(original);
      expect(fs.readFileSync(authorFile, "utf8")).toBe("keep me");
      expect(fs.readdirSync(output)).toEqual(["plugin"]);
      fs.writeFileSync(source, 'export default { id: "updated", setup: async () => ({}) };');
      await runOpenCodeCli(args);
      expect(fs.readFileSync(entry, "utf8")).toContain("updated");
      expect(fs.readFileSync(authorFile, "utf8")).toBe("keep me");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects colliding basenames before emitting plugins", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-collision-"));
    try {
      for (const directory of ["first", "second"]) {
        fs.mkdirSync(path.join(tempDir, directory));
        fs.writeFileSync(
          path.join(tempDir, directory, "plugin.ts"),
          'export default { id: "plugin", setup: async () => ({}) };',
        );
      }
      const output = path.join(tempDir, "output");
      await expect(runOpenCodeCli({ input: path.join(tempDir, "*", "*.ts"), output, loaderFlags: [] })).rejects.toThrow(
        "basenames must be unique",
      );
      expect(fs.existsSync(output)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
