#!/usr/bin/env node
import type { HookEventName } from "./types.js";
export interface HookMetadata {
    hookEventName: HookEventName;
    matcher?: string;
    timeout?: number;
    statusMessage?: string;
}
interface CompiledHook {
    sourcePath: string;
    outputPath: string;
    outputFilename: string;
    metadata: HookMetadata;
}
interface HookConfigEntry {
    type: "command";
    command: string;
    timeout?: number;
    statusMessage?: string;
}
interface MatcherEntry {
    matcher?: string;
    hooks: HookConfigEntry[];
}
interface HooksJson {
    hooks: Partial<Record<HookEventName, MatcherEntry[]>>;
}
export declare function analyzeHookFile(sourcePath: string): HookMetadata | undefined;
export declare function generateHooksJson(compiledHooks: CompiledHook[], outputPath: string, executable?: string): HooksJson;
export declare function main(): Promise<void>;
export {};
