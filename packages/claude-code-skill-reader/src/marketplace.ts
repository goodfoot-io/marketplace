import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { SkillReaderError } from "./errors.js";
import type {
	MarketplaceManifest,
	MarketplaceSource,
	SkillLocation,
} from "./types.js";

/**
 * Creates a temporary directory, runs a callback with it, and cleans up
 * the directory afterwards (even if the callback throws).
 */
export function withTempDir<T>(fn: (dir: string) => T): T {
	const dir = mkdtempSync(join(tmpdir(), "skill-reader-"));
	try {
		return fn(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * Clones a GitHub repository into targetDir using SSH, falling back to HTTPS.
 */
export function fetchGithubSource(repo: string, targetDir: string): void {
	try {
		execSync(`git clone --depth 1 git@github.com:${repo}.git ${targetDir}`, {
			stdio: "pipe",
		});
	} catch {
		try {
			execSync(
				`git clone --depth 1 https://github.com/${repo}.git ${targetDir}`,
				{ stdio: "pipe" },
			);
		} catch (httpsErr) {
			throw new SkillReaderError(
				"MARKETPLACE_FETCH_FAILED",
				`Failed to clone GitHub repo ${repo}: ${String(httpsErr)}`,
			);
		}
	}
}

/**
 * Clones a generic git URL into targetDir.
 */
export function fetchGitSource(url: string, targetDir: string): void {
	try {
		execSync(`git clone --depth 1 ${url} ${targetDir}`, { stdio: "pipe" });
	} catch (err) {
		throw new SkillReaderError(
			"MARKETPLACE_FETCH_FAILED",
			`Failed to clone git repository ${url}: ${String(err)}`,
		);
	}
}

/**
 * Downloads a URL to targetPath using curl.
 */
export function fetchUrlSource(url: string, targetPath: string): void {
	try {
		execSync(`curl -sL -o ${targetPath} ${url}`);
	} catch (err) {
		throw new SkillReaderError(
			"MARKETPLACE_FETCH_FAILED",
			`Failed to fetch URL ${url}: ${String(err)}`,
		);
	}
}

/**
 * Resolves a marketplace source to a local directory path.
 */
export function resolveMarketplace(
	source: MarketplaceSource,
	tempDir: string,
): string {
	switch (source.source) {
		case "directory": {
			if (!existsSync(source.path)) {
				throw new SkillReaderError(
					"INVALID_MARKETPLACE",
					`Marketplace directory does not exist: ${source.path}`,
				);
			}
			return source.path;
		}
		case "file": {
			return dirname(source.path);
		}
		case "github": {
			fetchGithubSource(source.repo, tempDir);
			return tempDir;
		}
		case "git": {
			fetchGitSource(source.url, tempDir);
			return tempDir;
		}
		case "url": {
			fetchUrlSource(source.url, join(tempDir, "marketplace.json"));
			return tempDir;
		}
	}
}

/**
 * Searches a marketplace directory for a specific plugin's skill file.
 * Tries `.claude-plugin/marketplace.json` first, then `marketplace.json` at root.
 */
export function findSkillInMarketplace(
	marketplacePath: string,
	pluginName: string,
	skillName: string,
): SkillLocation | undefined {
	const candidatePaths = [
		join(marketplacePath, ".claude-plugin", "marketplace.json"),
		join(marketplacePath, "marketplace.json"),
	];

	let manifestPath: string | undefined;
	for (const candidate of candidatePaths) {
		if (existsSync(candidate)) {
			manifestPath = candidate;
			break;
		}
	}

	if (!manifestPath) {
		throw new SkillReaderError(
			"INVALID_MARKETPLACE",
			`No marketplace.json found in ${marketplacePath}`,
		);
	}

	let rawManifest: unknown;
	try {
		rawManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch (err) {
		throw new SkillReaderError(
			"INVALID_MARKETPLACE",
			`Failed to parse marketplace.json: ${String(err)}`,
		);
	}

	// Validate the manifest structure
	if (
		typeof rawManifest !== "object" ||
		rawManifest === null ||
		!Array.isArray((rawManifest as Record<string, unknown>).plugins)
	) {
		throw new SkillReaderError(
			"INVALID_MARKETPLACE",
			`Invalid marketplace manifest: missing plugins array`,
		);
	}

	const manifest = rawManifest as MarketplaceManifest;

	// Find the plugin entry
	const pluginEntry = manifest.plugins.find(
		(entry) => entry.name === pluginName,
	);
	if (!pluginEntry) {
		return undefined;
	}

	// Resolve the skill file path
	const pluginRoot = resolve(marketplacePath, pluginEntry.source);
	const candidates = [
		join(pluginRoot, "skills", skillName, "SKILL.md"),
		join(pluginRoot, "commands", `${skillName}.md`),
	];

	for (const candidatePath of candidates) {
		if (existsSync(candidatePath)) {
			return {
				path: candidatePath,
				baseDir: dirname(candidatePath),
				pluginRoot,
			};
		}
	}

	return undefined;
}
