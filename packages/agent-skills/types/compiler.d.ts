import type { BuildOptions, BuildResult, LintOptions, LintResult, RenderedTemplate, RenderTemplateOptions, TemplateFrontConfig } from "./types.js";
export declare function parseFrontConfig(template: string): {
    config?: TemplateFrontConfig;
    body: string;
};
export declare function renderTemplate(options: RenderTemplateOptions): Promise<RenderedTemplate>;
export declare function build(options: BuildOptions): Promise<BuildResult>;
export declare function lint(options: LintOptions): Promise<LintResult>;
