/** Location information for a resolved skill file */
export interface SkillLocation {
	path: string;
	baseDir: string;
	pluginRoot: string | undefined;
}

/** Marketplace source backed by a GitHub repository */
export interface MarketplaceSourceGitHub {
	source: "github";
	repo: string;
}

/** Marketplace source backed by a generic Git URL */
export interface MarketplaceSourceGit {
	source: "git";
	url: string;
}

/** Marketplace source backed by a plain URL */
export interface MarketplaceSourceUrl {
	source: "url";
	url: string;
}

/** Marketplace source backed by a local file path */
export interface MarketplaceSourceFile {
	source: "file";
	path: string;
}

/** Marketplace source backed by a local directory path */
export interface MarketplaceSourceDirectory {
	source: "directory";
	path: string;
}

/** Discriminated union of all supported marketplace source kinds */
export type MarketplaceSource =
	| MarketplaceSourceGitHub
	| MarketplaceSourceGit
	| MarketplaceSourceUrl
	| MarketplaceSourceFile
	| MarketplaceSourceDirectory;

/** Configuration for a single marketplace entry */
export interface MarketplaceConfig {
	source: MarketplaceSource;
	installLocation?: string;
}

/** Map of marketplace names to their configurations */
export type KnownMarketplaces = Record<string, MarketplaceConfig>;

/** A single plugin entry within a marketplace manifest */
export interface PluginEntry {
	name: string;
	version: string;
	source: string;
}

/** Top-level structure of a marketplace manifest file */
export interface MarketplaceManifest {
	name: string;
	plugins: PluginEntry[];
}

/** A single installed plugin record within the registry */
export interface InstalledPluginRecord {
	scope: string;
	installPath: string;
	version: string;
}

/** Registry of all installed plugins, keyed by plugin name */
export interface InstalledPluginsRegistry {
	version: number;
	plugins: Record<string, InstalledPluginRecord[]>;
}

/** Parsed contents of a skill file */
export interface ParsedSkill {
	frontmatter: Record<string, string>;
	body: string;
	pluginRoot: string | undefined;
}

/** All recognized error codes for SkillReaderError */
export type ErrorCode =
	| "SKILL_NOT_FOUND"
	| "INVALID_MARKETPLACE"
	| "MARKETPLACE_FETCH_FAILED"
	| "BASH_EXECUTION_FAILED"
	| "INVALID_ARGS"
	| "INTERNAL_ERROR";
