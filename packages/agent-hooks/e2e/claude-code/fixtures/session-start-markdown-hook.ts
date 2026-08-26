import { sessionStartHook, sessionStartOutput } from "../../../src/agents/claude-code/index.js";
import prompt from "./content/prompt.md";

export default sessionStartHook({}, () => {
  return sessionStartOutput({
    hookSpecificOutput: { additionalContext: prompt },
  });
});
