export {
	discoverCachedSkill,
	discoverPluginSkill,
	discoverSkill,
	splitSkillName,
} from "./discovery.js";
export { SkillReaderError } from "./errors.js";
export type { FrontmatterResult } from "./frontmatter.js";
export { parseFrontmatter } from "./frontmatter.js";
export {
	findSkillInMarketplace,
	resolveMarketplace,
	withTempDir,
} from "./marketplace.js";
export type { ProcessContentOptions } from "./processor.js";
export { processContent } from "./processor.js";
export type {
	ErrorCode,
	InstalledPluginRecord,
	InstalledPluginsRegistry,
	KnownMarketplaces,
	MarketplaceConfig,
	MarketplaceManifest,
	MarketplaceSource,
	MarketplaceSourceDirectory,
	MarketplaceSourceFile,
	MarketplaceSourceGit,
	MarketplaceSourceGitHub,
	MarketplaceSourceUrl,
	ParsedSkill,
	PluginEntry,
	SkillLocation,
} from "./types.js";
