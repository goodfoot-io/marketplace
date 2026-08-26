#!/usr/bin/env node
import type { BuildOptions, BuildResult, LintOptions, LintResult, OutputTarget, Platform, TransactionResidue } from "./types.js";
export type CliCommand = "build" | "lint";
export interface ParsedCliArgs {
    readonly command?: CliCommand;
    readonly root?: string;
    readonly targets: readonly string[];
    readonly platforms: readonly string[];
    readonly patterns: readonly string[];
    readonly platformDirs: readonly string[];
    readonly help: boolean;
    readonly version: boolean;
}
export interface ValidatedCliArgs extends Omit<BuildOptions, "targets"> {
    readonly command: CliCommand;
    readonly targets: readonly OutputTarget[];
    readonly platforms?: readonly Platform[];
}
export declare function parseArgs(argv: readonly string[]): ParsedCliArgs;
export declare function validateArgs(args: ParsedCliArgs): ValidatedCliArgs;
export interface CliDependencies {
    readonly build: (options: BuildOptions) => Promise<BuildResult>;
    readonly lint: (options: LintOptions) => Promise<LintResult>;
    readonly stdout: (text: string) => void;
    readonly stderr: (text: string) => void;
}
export declare function formatResidueWarnings(residues: readonly TransactionResidue[]): string[];
export declare function run(argv?: readonly string[], dependencies?: CliDependencies): Promise<number>;
