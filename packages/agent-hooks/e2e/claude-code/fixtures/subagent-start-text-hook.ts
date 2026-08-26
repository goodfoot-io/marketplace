import { subagentStartHook, subagentStartOutput } from "../../../src/agents/claude-code/index.js";
import prompt from "./content/prompt.txt";

export default subagentStartHook({}, () => {
  return subagentStartOutput({
    hookSpecificOutput: { additionalContext: prompt },
  });
});
