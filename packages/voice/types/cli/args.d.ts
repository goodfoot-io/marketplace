/**
 * argv parsing helpers for the voice CLI
 */
export interface ParsedArgs {
    command: string;
    subcommand?: string;
    positional: string[];
    flags: Record<string, string | boolean>;
}
/**
 * Parse process.argv[2...] into a structured object.
 */
export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function getPort(flags: Record<string, string | boolean>): number;
export declare function getString(flags: Record<string, string | boolean>, key: string): string | undefined;
export declare function getBoolean(flags: Record<string, string | boolean>, key: string): boolean;
/**
 * Read all of stdin as a string.
 */
export declare function readStdin(): Promise<string>;
