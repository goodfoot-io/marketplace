export declare const PLATFORMS: readonly ["claude-code", "codex", "opencode", "antigravity"];
export type Platform = (typeof PLATFORMS)[number];
export type PlatformAlias = "@codex";
export type VariantMap<T = string> = Partial<Record<Platform | PlatformAlias, T>>;
export type ContentKind = "skill" | "agent" | "hook" | "manifest" | "documentation";
export type PlatformPathKind = "skills" | "agents" | "hooks" | "plugin" | "conventions";
export type PlatformDirectoryMap = Partial<Record<Platform, Partial<Record<PlatformPathKind, string>>>>;
export type LintRuleId = "config" | "include" | "unexpanded-eta" | "frontmatter-key" | "cross-dialect-reference" | "literal-platform-prose" | "plugin-root-variable" | "skill-relative-path" | "opencode-name";
export interface LintSuppression {
    readonly rule: LintRuleId;
    readonly lines: readonly [start: number, end: number];
}
export interface TemplateFrontConfig {
    readonly platforms?: readonly Platform[];
    readonly outputName?: string;
    readonly kind?: ContentKind;
    readonly lintSuppressions?: readonly LintSuppression[];
}
export interface OutputTarget {
    readonly platform: Platform;
    readonly outDir: string;
}
export interface SourceLocation {
    readonly line: number;
    readonly column: number;
}
export interface Diagnostic {
    readonly rule: LintRuleId;
    readonly message: string;
    readonly sourcePath: string;
    readonly outputPath?: string;
    readonly platform?: Platform;
    readonly location?: SourceLocation;
}
export interface ManifestFile {
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly mode: number;
}
export interface PlatformManifest {
    readonly platform: Platform;
    readonly files: ReadonlyMap<string, ManifestFile>;
}
export interface BuildOptions {
    readonly root: string;
    readonly patterns: readonly string[];
    readonly targets: readonly OutputTarget[];
    readonly platforms?: readonly Platform[];
    readonly outputBoundary?: string;
    readonly platformDirs?: PlatformDirectoryMap;
    /** Injectable filesystem boundary for deterministic transaction-failure testing. */
    readonly fileSystem?: BuildFileSystem;
}
export interface BuildFileSystem {
    mkdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<unknown>;
    mkdtemp(prefix: string): Promise<string>;
    writeFile(path: string, data: Uint8Array | string): Promise<unknown>;
    chmod(path: string, mode: number): Promise<unknown>;
    lstat(path: string): Promise<unknown>;
    rename(from: string, to: string): Promise<unknown>;
    rm(path: string, options: {
        recursive: true;
        force: true;
    }): Promise<unknown>;
}
export interface BuildResult {
    readonly manifests: ReadonlyMap<Platform, PlatformManifest>;
    readonly written: readonly {
        readonly target: OutputTarget;
        readonly files: readonly string[];
    }[];
}
export interface LintOptions extends BuildOptions {
}
export interface LintResult {
    readonly ok: boolean;
    readonly diagnostics: readonly Diagnostic[];
    readonly manifests: ReadonlyMap<Platform, PlatformManifest>;
}
export interface SubagentDispatchOptions {
    readonly parallel?: boolean;
    readonly background?: boolean;
    readonly taskName?: string;
}
export interface SubagentReengageOptions {
    readonly live?: boolean;
}
export interface PlatformHelpers {
    readonly platform: Platform;
    is(...platforms: readonly Platform[]): boolean;
    variant<T>(variants: VariantMap<T>): T;
    skillRef(id: string): string;
    skillInvoke(id: string): string;
    agentRef(id: string): string;
    agentSlotVar(role: string): string;
    conventionsFile: string;
    hostIdentity(role?: string): string;
    pluginRootVar: string;
    platformDir(kind: PlatformPathKind): string;
    frontmatter(value: Readonly<Record<string, unknown>>): string;
    readonly subagent: {
        dispatch(type: string, options?: SubagentDispatchOptions): string;
        reengage(options?: SubagentReengageOptions): string;
        resultChannel(orchestrator?: boolean): string;
    };
    readonly worktree: {
        enter(): string;
        remove(): string;
    };
}
export interface RenderTemplateOptions {
    readonly platform: Platform;
    readonly sourcePath: string;
    readonly root: string;
    readonly template: string;
    readonly data?: Readonly<Record<string, unknown>>;
    readonly platformDirs?: Partial<Record<PlatformPathKind, string>>;
}
export interface RenderedTemplate {
    readonly content: string;
    readonly outputPath: string;
    readonly config?: TemplateFrontConfig;
}
export interface HelperFactoryOptions {
    readonly platformDirs?: Partial<Record<PlatformPathKind, string>>;
    readonly opencodeProductName?: string;
}
