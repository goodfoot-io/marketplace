/**
 * Module for testing type declarations generation.
 *
 * @summary Type declarations test module
 */

/** A string type alias */
export type Name = string;

/** A user interface */
export interface User {
	id: number;
	name: string;
	email?: string;
}

/**
 * Gets a user by ID
 * @param id - The user ID
 * @returns The user object
 */
export function getUser(id: number): User {
	return { id, name: "test" };
}

/** The default timeout value */
export const DEFAULT_TIMEOUT = 5000;

/** A simple utility class */
export class UserService {
	private users: User[] = [];

	/** Add a user */
	add(user: User): void {
		this.users.push(user);
	}

	/** Get all users */
	getAll(): User[] {
		return this.users;
	}
}

// Internal helper - should NOT appear in declarations
function _internalHelper(): string {
	return "internal";
}

const _privateConst = 42;
