import type { HookFunction } from "./hooks.js";
import { type HookOutput, type SpecificHookOutput } from "./outputs.js";
import type { HookEventName, HookInput } from "./types.js";
export declare function convertToHookOutput(output: SpecificHookOutput): HookOutput;
export declare function execute<TInput extends HookInput, TOutput>(hookFn: HookFunction<TInput, TOutput, HookEventName>): Promise<void>;
