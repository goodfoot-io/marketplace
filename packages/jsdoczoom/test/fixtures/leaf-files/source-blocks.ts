import { readFileSync } from "node:fs";

/**
 * A helper to format a greeting.
 */
function formatGreeting(name: string): string {
	return `Hello, ${name}!`;
}

/**
 * Exported function that uses the helper.
 * @param name - The name to greet
 */
export function greet(name: string): string {
	return formatGreeting(name);
}

/** An exported interface */
export interface Options {
	verbose: boolean;
	timeout: number;
}

/** An exported class */
export class Processor {
	/** Run the processor */
	run(opts: Options): string {
		return opts.verbose ? "verbose" : "quiet";
	}
}

const internalConst = "secret";

export const MAX_RETRIES = 3;
