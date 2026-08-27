import { type Verification } from "./platforms.js";
import { type Platform } from "./types.js";
export interface HelperReferenceCell {
    readonly platform: Platform;
    readonly status: Verification;
    readonly example?: string;
    /**
     * The example is literal host syntax rather than a descriptive word, so it
     * renders as a Markdown code span. That is the correct markup for a variable
     * name regardless, and it is also what distinguishes this table's necessary
     * mention of every platform's root variable from an actual wrong-platform
     * token in a generated tree.
     */
    readonly code?: boolean;
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
export declare function renderHelperReferenceMarkdown(_model?: HelperReferenceModel): string;
