/**
 * Test fixture: UserPromptSubmit hook with `unexpectedError: "continue"` that throws.
 *
 * Used to verify that a fail-open hook emits `{}` and exits 0 instead of
 * surfacing a failed-hook banner.
 */

import { userPromptSubmitHook } from "../../../src/agents/claude-code/index.js";

export default userPromptSubmitHook({ unexpectedError: "continue" }, () => {
  throw new Error("E2E_TEST_ERROR: advisory enrichment blew up");
});
