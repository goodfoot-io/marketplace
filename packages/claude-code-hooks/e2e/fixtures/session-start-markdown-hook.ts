import { sessionStartHook, sessionStartOutput } from "../../src/index.js";
import prompt from "./content/prompt.md";

export default sessionStartHook({}, () => {
  return sessionStartOutput({
    hookSpecificOutput: { additionalContext: prompt },
  });
});
