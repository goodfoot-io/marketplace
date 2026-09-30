import { preToolUseHook, preToolUseOutput } from "@goodfoot/agent-hooks/codex";
import { GUIDANCE_MESSAGE, findBypassViolations } from "../shared/bypass.js";
import { parseCodexPatch } from "../shared/codex-patch.js";

export default preToolUseHook({ matcher: "^apply_patch$", timeout: 10000 }, (input, { logger }) => {
  const violations: string[] = [];
  for (const edit of parseCodexPatch(input.tool_input, input.cwd)) {
    if (edit.deleted || !/\.(?:[cm]?[jt]s|[jt]sx)$/.test(edit.filePath)) continue;
    for (const chunk of edit.chunks) {
      for (const violation of findBypassViolations(chunk.oldContent, chunk.newContent)) {
        violations.push(`${edit.filePath}: ${violation}`);
      }
    }
  }
  if (!violations.length) return preToolUseOutput({});
  logger.warn("Denying patch containing rule bypasses", { violations });
  return preToolUseOutput({
    systemMessage: "ESLint/TypeScript/Biome bypass prevention: Fix the underlying issue.",
    permissionDecision: "deny",
    permissionDecisionReason: `The following rule bypasses are not allowed:\n${violations.map((v) => `- ${v}`).join("\n")}\n\n${GUIDANCE_MESSAGE}`,
  });
});
