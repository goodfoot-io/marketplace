/**
 * Type declarations generation for JSDoc Zoom
 *
 * @summary Generates TypeScript declaration output from source files
 */
/**
 * Generates TypeScript declaration output from a source file.
 *
 * Produces .d.ts-like output containing:
 * - All exported type aliases, interfaces, enums
 * - All exported function signatures (no implementation bodies)
 * - All exported const/let/var declarations (type signatures only)
 * - All exported class declarations (signatures only, no method bodies)
 * - All JSDoc comments preserved
 * - Source order maintained
 *
 * Excludes:
 * - Import statements
 * - Non-exported internals
 *
 * @param filePath - Absolute path to the TypeScript source file
 * @returns The declaration output as a string
 * @throws {JsdocError} If the file cannot be read or parsed
 */
export declare function generateTypeDeclarations(filePath: string): string;
