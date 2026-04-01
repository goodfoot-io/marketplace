import { subagentStartHook, subagentStartOutput } from "../../src/index.js";
import prompt from "./content/prompt.txt";

export default subagentStartHook({}, () => {
  return subagentStartOutput({
    hookSpecificOutput: { additionalContext: prompt },
  });
});
