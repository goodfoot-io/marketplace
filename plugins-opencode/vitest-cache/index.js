import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Plugin } from "@opencode/plugin";
import { load } from "js-yaml";

// Resolve bundled skills from the installed module, independently of the project.
const own = new URL("./skills/", import.meta.url);

export default Plugin.define({
  id: "goodfoot.vitest-cache",
  async setup(ctx) {
    const entries = await readdir(own, { withFileTypes: true });
    const skills = await Promise.all(
      entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        const url = new URL(`${entry.name}/SKILL.md`, own);
        const source = await readFile(url, "utf8");
        const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
        if (!match) throw new Error(`Missing skill frontmatter: ${url}`);
        const metadata = load(match[1]);
        if (
          !metadata || typeof metadata !== "object" ||
          typeof metadata.name !== "string" || !metadata.name ||
          typeof metadata.description !== "string"
        ) throw new Error(`Invalid skill frontmatter: ${url}`);
        return {
          id: metadata.name,
          name: metadata.name,
          description: metadata.description,
          autoinvoke: metadata.metadata?.opencode?.autoinvoke ??
            metadata["disable-model-invocation"] !== true,
          path: fileURLToPath(url),
          content: source.slice(match[0].length),
        };
      }),
    );
    // Transforms replay synchronously; read and parse the files before registration.
    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill);
    });
  },
});
