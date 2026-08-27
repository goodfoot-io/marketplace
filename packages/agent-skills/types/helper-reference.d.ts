import { type PlatformDefinition, type PlatformFact, type Verification } from "./platforms.js";
import { type Platform } from "./types.js";
/**
 * `PlatformDefinition`'s members are three genuinely different shapes: single
 * string-valued facts, one list-valued fact, and `logicalPaths`, which is a
 * *record* of facts rather than a fact. These two key sets are derived from the
 * interface instead of hand-listed, so a fact whose shape is none of the three
 * belongs to neither union and cannot reach a renderer that would stringify it
 * into `[object Object]`. That is the standing gate: it fails at `tsc`, not in
 * the generated table.
 */
export type ScalarFactKey = {
    [K in keyof PlatformDefinition]: PlatformDefinition[K] extends PlatformFact<string> ? K : never;
}[keyof PlatformDefinition];
export type ListFactKey = {
    [K in keyof PlatformDefinition]: PlatformDefinition[K] extends PlatformFact<readonly string[]> ? K : never;
}[keyof PlatformDefinition];
export type BooleanFactKey = {
    [K in keyof PlatformDefinition]: PlatformDefinition[K] extends PlatformFact<boolean> ? K : never;
}[keyof PlatformDefinition];
/**
 * What a cell holds, kept separate from its status because the two answer
 * different questions. `absent` means the platform has no value at all;
 * `empty` means the value is the empty string and that is the correct answer —
 * no sigil, no identity prefix. Rendering both as a blank cell is what made a
 * complete row indistinguishable from a missing one.
 */
export type HelperReferenceValue = {
    readonly kind: "absent";
} | {
    readonly kind: "empty";
} | {
    readonly kind: "text";
    readonly text: string;
    readonly code: boolean;
} | {
    readonly kind: "list";
    readonly items: readonly string[];
};
export interface HelperReferenceCell {
    readonly platform: Platform;
    readonly status: Verification;
    readonly value: HelperReferenceValue;
}
export interface HelperReferenceEntry {
    readonly name: string;
    readonly inputs: string;
    readonly description: string;
    readonly cells: readonly HelperReferenceCell[];
}
export interface HelperReferenceModel {
    readonly platforms: readonly Platform[];
    readonly helpers: readonly HelperReferenceEntry[];
}
export declare function getHelperReferenceModel(): HelperReferenceModel;
export declare function renderHelperReferenceMarkdown(model?: HelperReferenceModel): string;
