import type { BuildOptions, BuildResult, LintOptions, LintResult, RenderedTemplate, RenderTemplateOptions } from "./types.js";
export declare function renderTemplate(options: RenderTemplateOptions): Promise<RenderedTemplate>;
export declare function build(options: BuildOptions): Promise<BuildResult>;
export declare function lint(options: LintOptions): Promise<LintResult>;
