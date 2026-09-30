import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../../../", import.meta.url));
const plugin = path.join(workspace, "plugins-codex/typescript-hooks");
const manifest = JSON.parse(fs.readFileSync(path.join(plugin, "hooks/hooks.json"), "utf8"));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "typescript-hooks-artifacts-"));
const base = {
  cwd: fixture,
  model: "fixture",
  permission_mode: "default",
  session_id: "fixture",
  transcript_path: null,
  turn_id: "turn",
  tool_use_id: "call",
  tool_name: "apply_patch",
};
const patch = (body) => `*** Begin Patch\n${body}\n*** End Patch`;
function invoke(event, body) {
  const entry = manifest.hooks[event][0];
  assert.equal(entry.matcher, "^apply_patch$");
  assert.equal(entry.hooks[0].timeout, event === "PreToolUse" ? 10 : 60);
  assert.match(entry.hooks[0].command, /\$\{PLUGIN_ROOT\}/);
  const script = event === "PreToolUse" ? "eslint-typescript-bypass.mjs" : "typescript-check.mjs";
  const result = spawnSync(process.execPath, [path.join(plugin, "hooks", script)], {
    cwd: fixture,
    encoding: "utf8",
    timeout: 60000,
    input: JSON.stringify({
      ...base,
      hook_event_name: event,
      tool_input: { command: patch(body) },
      ...(event === "PostToolUse" ? { tool_response: { success: true } } : {}),
    }),
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
try {
  const denied = invoke("PreToolUse", "*** Add File: blocked.ts\n+// @ts-ignore\n+const blocked = 1;");
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
  assert.equal(denied.hookSpecificOutput.hookEventName, "PreToolUse");
  const allowed = invoke("PreToolUse", "*** Add File: clean.ts\n+const clean = 1;");
  assert.equal(allowed.hookSpecificOutput?.permissionDecision, undefined);
  const removed = invoke("PreToolUse", "*** Update File: old.ts\n@@\n-// @ts-ignore\n+const clean = 1;");
  assert.equal(removed.hookSpecificOutput?.permissionDecision, undefined);

  fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({ name: "fixture", private: true }));
  fs.writeFileSync(
    path.join(fixture, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { types: [], skipLibCheck: true }, files: ["broken.ts"] }),
  );
  fs.symlinkSync(
    path.join(workspace, "packages/typescript-hooks/node_modules"),
    path.join(fixture, "node_modules"),
    "dir",
  );
  fs.writeFileSync(
    path.join(fixture, "broken.ts"),
    'const broken: number = "wrong";\ntry { throw new Error("fixture"); } catch {}\n',
  );
  const report = invoke("PostToolUse", '*** Add File: broken.ts\n+const broken: number = "wrong";');
  assert.equal(report.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(report.hookSpecificOutput.additionalContext, /TS2322/);
  assert.match(report.hookSpecificOutput.additionalContext, /empty-catch/);
  process.stdout.write(
    "Codex compiled artifacts: denial, pass-through, removal, real compiler diagnostics, and swallowed-error diagnostics verified.\n",
  );
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
