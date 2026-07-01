import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression test for a hang introduced in 1.2.4: `process.stdin.isTTY` is
 * `undefined` both for genuine shell pipes with real data coming AND for a
 * spawned child's default `stdio: 'pipe'` where nothing is ever written or
 * closed. The auto-invoke block in `src/cli.ts` uses `!process.stdin.isTTY`
 * to decide whether to call `readStdin()`, which is `true` in both cases —
 * so an idle, unwritten pipe causes `readStdin()` to block forever on
 * `for await (const chunk of process.stdin)`, hanging the whole process.
 *
 * This test spawns the built CLI with default stdio (a pipe that is never
 * written to or closed — the shape produced by orchestrators that shell out
 * without setting `stdio: 'inherit'` or redirecting from `/dev/null`) and
 * asserts the process exits before a short timeout instead of hanging.
 *
 * @summary Reproduces the idle-pipe-stdin hang bug via a real subprocess
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, "..", "dist", "cli.js");
const leafFilesDir = resolve(__dirname, "fixtures", "leaf-files");

/** Race a spawned CLI process against a timeout; resolves with which one won. */
function raceProcessAgainstTimeout(
	args: string[],
	cwd: string,
	timeoutMs: number,
): Promise<"exited" | "timed-out"> {
	return new Promise((resolvePromise) => {
		const child = spawn(process.execPath, [cliPath, ...args], {
			cwd,
			// Default stdio: an open pipe that is never written to or closed —
			// NOT 'inherit' and NOT redirected from /dev/null.
			stdio: ["pipe", "pipe", "pipe"],
		});

		let settled = false;

		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			child.kill("SIGKILL");
			resolvePromise("timed-out");
		}, timeoutMs);

		child.once("close", () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolvePromise("exited");
		});

		child.once("error", () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolvePromise("exited");
		});
	});
}

describe("idle pipe stdin (bug reproduction)", () => {
	it(
		"should not hang on -l when stdin is an open, unwritten pipe",
		async () => {
			const result = await raceProcessAgainstTimeout(
				["-l", "description-only.ts"],
				leafFilesDir,
				2500,
			);

			// BUG: readStdin() blocks forever waiting for EOF that never
			// arrives, so the timeout wins and this is "timed-out".
			// CORRECT: isTTY===false check means readStdin() is skipped for an
			// idle pipe, main() runs and exits, so this is "exited".
			expect(result).toBe("exited");
		},
		5000,
	);

	it(
		"should not hang on -c when stdin is an open, unwritten pipe",
		async () => {
			const result = await raceProcessAgainstTimeout(
				["-c", "description-only.ts"],
				leafFilesDir,
				2500,
			);

			expect(result).toBe("exited");
		},
		5000,
	);
});
