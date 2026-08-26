/**
 * Stdin acquisition and JSON parsing for agent hooks.
 *
 * Both source runtimes (`claude-code-hooks`, `codex-hooks`) read stdin and
 * parse JSON identically; this module is that shared logic. Wire rules for
 * what a parse failure *means* belong to each agent's transport — core only
 * classifies the outcome.
 * @module
 */

/**
 * Reads all data from stdin.
 * @returns Promise resolving to the complete stdin content
 */
export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];

    // Set encoding first to ensure data events receive strings
    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", (chunk: string) => {
      chunks.push(chunk);
    });

    process.stdin.on("end", () => {
      resolve(chunks.join(""));
    });

    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Parses stdin JSON input.
 * @param stdinContent - Raw stdin content
 * @returns Parsed input in the host CLI's wire format
 * @throws SyntaxError if JSON is malformed
 */
export function parseStdinJson(stdinContent: string): unknown {
  return JSON.parse(stdinContent) as unknown;
}
