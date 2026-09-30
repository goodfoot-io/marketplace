import { postToolUseHook, postToolUseOutput } from "@goodfoot/agent-hooks/codex";
import { parseCodexPatch } from "../shared/codex-patch.js";
import { checkTypeScriptFile } from "../shared/validation.js";

export default postToolUseHook({ matcher: "^apply_patch$", timeout: 60000 }, (input, { logger }) => {
  const typeChecks: NonNullable<Parameters<typeof checkTypeScriptFile>[2]> = new Map();
  const results: string[] = [];
  const checkedFiles = new Set<string>();
  for (const edit of parseCodexPatch(input.tool_input, input.cwd)) {
    if (edit.deleted || checkedFiles.has(edit.filePath)) continue;
    checkedFiles.add(edit.filePath);
    const result = checkTypeScriptFile(edit.filePath, logger, typeChecks);
    if (result) results.push(result.additionalContext);
  }
  if (!results.length) return undefined;
  return postToolUseOutput({
    systemMessage: "TypeScript check: Review the diagnostics and fix type issues before proceeding.",
    additionalContext: results.join("\n\n"),
  });
});
