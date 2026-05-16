import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Mirror esbuild's `{ ".html": "text" }` loader so that controller.ts's
// `import uiHtml from "./ui-dist/index.html"` resolves to the file's text
// content under Vitest's Vite pipeline (Vite would otherwise try to parse
// the HTML as JS for import analysis).
function htmlAsText(): Plugin {
  return {
    name: "html-as-text",
    enforce: "pre",
    transform(_code, id) {
      if (!id.endsWith(".html")) return null;
      const source = readFileSync(id, "utf8");
      return {
        code: `export default ${JSON.stringify(source)};`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [htmlAsText()],
  test: {
    globals: false,
    include: ["tests/**/*.test.ts"],
  },
});
