import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Skill } from "@opencode/plugin";
import { Schema } from "effect";
import { load } from "js-yaml";

const root = fileURLToPath(new URL("../plugins-opencode/", import.meta.url));
const skillIDs = new Set();
let plugins = 0;
let skills = 0;
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = join(root, entry.name);
  const { default: plugin } = await import(new URL(`../plugins-opencode/${entry.name}/index.js`, import.meta.url));
  assert.equal(plugin.id, `goodfoot.${entry.name}`);
  assert.equal(typeof plugin.setup, "function");
  const transforms = [];
  await plugin.setup({ skill: { transform: async (callback) => transforms.push(callback) } });
  const registered = new Map();
  const editor = { add(skill) {
    Schema.decodeUnknownSync(Skill.Info)(skill);
    registered.set(skill.id, skill);
  } };
  for (const transform of transforms) transform(editor);
  const first = JSON.stringify([...registered]);
  for (const transform of transforms) transform(editor);
  assert.equal(JSON.stringify([...registered]), first, "Transforms must replay consistently");
  if (entry.name === "voice") {
    assert.equal(transforms.length, 0);
  } else {
    const leaves = (await readdir(join(directory, "skills"), { withFileTypes: true })).filter((leaf) => leaf.isDirectory());
    assert.equal(transforms.length, 1);
    assert.equal(registered.size, leaves.length);
    for (const leaf of leaves) {
      const path = join(directory, "skills", leaf.name, "SKILL.md");
      const source = await readFile(path, "utf8");
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
      const metadata = load(match[1]);
      const skill = registered.get(metadata.name);
      assert.ok(skill, `Missing ${entry.name}/${leaf.name}`);
      assert.ok(!skillIDs.has(skill.id), `Duplicate skill ID across plugins: ${skill.id}`);
      skillIDs.add(skill.id);
      assert.equal(skill.name, metadata.name);
      assert.equal(skill.description, metadata.description);
      assert.equal(skill.path, path);
      assert.equal(skill.content, source.slice(match[0].length));
      assert.equal(skill.autoinvoke, metadata.metadata?.opencode?.autoinvoke ?? metadata["disable-model-invocation"] !== true);
    }
  }
  plugins += 1;
  skills += registered.size;
}
console.log(`Validated ${plugins} OpenCode v2 plugins and ${skills} bundled skills.`);
