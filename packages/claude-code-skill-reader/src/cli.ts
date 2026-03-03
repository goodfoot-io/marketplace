#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	discoverCachedSkill,
	discoverPluginSkill,
	discoverSkill,
	splitSkillName,
} from "./discovery.js";
import { SkillReaderError } from "./errors.js";
import { parseFrontmatter } from "./frontmatter.js";
import {
	findSkillInMarketplace,
	resolveMarketplace,
	withTempDir,
} from "./marketplace.js";
import { processContent } from "./processor.js";
import type { MarketplaceSource } from "./types.js";

const HELP_TEXT = `Usage: claude-code-skill-reader [options] <skill-name> [skill-name...]

Read and process Claude Code skills with full fidelity.

Options:
  -h, --help                   Show this help text
  -v, --version                Show version number
  --no-bash                    Skip bash execution
  --raw                        Output unprocessed SKILL.md body
  --marketplace <json-string>  Resolve skills from a marketplace source
  --use-cached                 Fall back to cached plugin downloads when skill is not found locally

Skill Names:
  Plain name:     my-skill        (searches .claude/skills/ and .claude/commands/)
  Plugin name:    plugin:skill    (searches installed plugin skills and commands)

Exit codes:
  0  Success
  1  Error
`;

/** Parsed CLI arguments */
interface ParsedArgs {
	help: boolean;
	version: boolean;
	noExecuteBash: boolean;
	raw: boolean;
	useCached: boolean;
	marketplace: MarketplaceSource | undefined;
	skillNames: string[];
}

/**
 * Parse CLI arguments into flags and positional args.
 */
function parseArgs(args: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		help: false,
		version: false,
		noExecuteBash: false,
		raw: false,
		useCached: false,
		marketplace: undefined,
		skillNames: [],
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "-h" || arg === "--help") {
			parsed.help = true;
			continue;
		}
		if (arg === "-v" || arg === "--version") {
			parsed.version = true;
			continue;
		}
		if (arg === "--no-bash") {
			parsed.noExecuteBash = true;
			continue;
		}
		if (arg === "--raw") {
			parsed.raw = true;
			continue;
		}
		if (arg === "--use-cached") {
			parsed.useCached = true;
			continue;
		}
		if (arg === "--marketplace") {
			const jsonStr = args[i + 1];
			i++;
			try {
				parsed.marketplace = JSON.parse(jsonStr) as MarketplaceSource;
			} catch (err) {
				throw new SkillReaderError(
					"INVALID_ARGS",
					`Invalid marketplace JSON: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			continue;
		}

		// Unknown flag
		if (arg.startsWith("-")) {
			throw new SkillReaderError("INVALID_ARGS", `Unrecognized option: ${arg}`);
		}

		// Positional arg — skill name
		parsed.skillNames.push(arg);
	}

	return parsed;
}

/**
 * Write an error to stderr as JSON and set exit code.
 */
function writeError(error: unknown): void {
	if (error instanceof SkillReaderError) {
		void process.stderr.write(`${JSON.stringify(error.toJSON())}\n`);
		process.exitCode = 1;
		return;
	}

	const message = error instanceof Error ? error.message : String(error);
	void process.stderr.write(
		`${JSON.stringify({ error: { code: "INTERNAL_ERROR", message } })}\n`,
	);
	process.exitCode = 1;
}

/**
 * Handle --help flag by printing help text.
 */
function handleHelp(): void {
	void process.stdout.write(HELP_TEXT);
}

/**
 * Handle --version flag by reading and printing version from package.json.
 */
function handleVersion(): void {
	const pkgPath = resolve(
		dirname(fileURLToPath(import.meta.url)),
		"..",
		"package.json",
	);
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
		version: string;
	};
	void process.stdout.write(`${pkg.version}\n`);
}

/**
 * Main CLI entry point. Exported for testability.
 */
export async function main(args: string[]): Promise<void> {
	try {
		const parsed = parseArgs(args);

		// Handle early-exit flags
		if (parsed.help) {
			handleHelp();
			return;
		}
		if (parsed.version) {
			handleVersion();
			return;
		}

		// Validate that skill names were provided
		if (parsed.skillNames.length === 0) {
			throw new SkillReaderError(
				"INVALID_ARGS",
				"No skill names provided. Use --help for usage.",
			);
		}

		// Process each skill name
		for (const name of parsed.skillNames) {
			const { pluginName, skillName } = splitSkillName(name);

			// Try local discovery
			let location = pluginName
				? discoverPluginSkill(pluginName, skillName)
				: discoverSkill(skillName, process.cwd());

			// If not found and --use-cached, try cache fallback
			if (!location && parsed.useCached) {
				location = discoverCachedSkill(pluginName, skillName);
			}

			// If not found and marketplace provided, try marketplace resolution
			if (!location && parsed.marketplace && pluginName) {
				const marketplace = parsed.marketplace;
				location = withTempDir((tempDir) => {
					const marketplacePath = resolveMarketplace(marketplace, tempDir);
					return findSkillInMarketplace(marketplacePath, pluginName, skillName);
				});
			}

			// Still not found
			if (!location) {
				throw new SkillReaderError(
					"SKILL_NOT_FOUND",
					`Skill not found: ${name}`,
				);
			}

			// Read and process the skill file
			const content = readFileSync(location.path, "utf-8");
			const { body } = parseFrontmatter(content);

			if (parsed.raw) {
				// Output body as-is
				void process.stdout.write(`${body}\n`);
			} else {
				// Process content (bash execution + CLAUDE_PLUGIN_ROOT replacement)
				const processed = processContent(body, {
					pluginRoot: location.pluginRoot,
					executeBash: !parsed.noExecuteBash,
				});
				void process.stdout.write(`${processed}\n`);
			}
		}
	} catch (error: unknown) {
		writeError(error);
	}
}

// Auto-invoke when run as CLI
function isDirectRun(): boolean {
	if (!process.argv[1]) return false;
	const scriptPath = process.argv[1].replace(/\\/g, "/");
	return (
		import.meta.url.endsWith(scriptPath) || import.meta.url.endsWith("/cli.js")
	);
}

if (isDirectRun()) {
	main(process.argv.slice(2)).catch(() => {});
}
