import type { HookEventName } from "./types.js";
export interface ScaffoldOptions {
    directory: string;
    hooks: string[];
    outputPath: string;
}
export declare function validateHookNames(hookNames: string[]): {
    valid: true;
    normalized: HookEventName[];
} | {
    valid: false;
    error: string;
};
export declare function scaffoldProject(options: ScaffoldOptions): void;
