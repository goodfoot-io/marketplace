import { readFileSync } from "node:fs";

/**
 * This JSDoc appears after imports but before code.
 *
 * @summary After imports summary
 */

export function doSomething(): string {
	return readFileSync("/dev/null", "utf-8");
}
