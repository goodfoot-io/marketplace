/**
 * Sample module for testing noEmit override.
 *
 * @summary noEmit test fixture
 */

/** A simple string type alias */
export type Greeting = string;

/** A configuration interface */
export interface Config {
	host: string;
	port: number;
	debug?: boolean;
}

/**
 * Creates a greeting message.
 *
 * @param name - The name to greet
 * @returns A greeting string
 */
export function greet(name: string): Greeting {
	return `Hello, ${name}!`;
}
