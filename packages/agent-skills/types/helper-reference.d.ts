import { type Verification } from "./platforms.js";
import { type Platform } from "./types.js";
export interface HelperReferenceCell {
    readonly platform: Platform;
    readonly status: Verification;
    readonly example?: string;
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
