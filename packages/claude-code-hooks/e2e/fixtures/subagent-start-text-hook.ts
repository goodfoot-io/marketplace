import prompt from "./content/prompt.txt";
import { subagentStartHook, subagentStartOutput } from "../../src/index.js";

export default subagentStartHook({}, () => {
  return subagentStartOutput({
    hookSpecificOutput: { additionalContext: prompt },
  });
});
