import prompt from "./content/prompt.md";
import { sessionStartHook, sessionStartOutput } from "../../src/index.js";

export default sessionStartHook({}, () => {
  return sessionStartOutput({
    hookSpecificOutput: { additionalContext: prompt },
  });
});
