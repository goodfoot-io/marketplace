#!/usr/bin/env node

import { build, lint } from "./index.js";
import type {
  BuildOptions,
  BuildResult,
  LintOptions,
  LintResult,
  OutputTarget,
  Platform,
  TransactionResidue,
} from "./types.js";
import { PLATFORMS } from "./types.js";

export type CliCommand = "build" | "lint";

export interface ParsedCliArgs {
  readonly command?: CliCommand;
  readonly root?: string;
  readonly targets: readonly string[];
  readonly platforms: readonly string[];
  readonly patterns: readonly string[];
  readonly platformDirs: readonly string[];
  readonly help: boolean;
  readonly version: boolean;
}

export interface ValidatedCliArgs extends Omit<BuildOptions, "targets"> {
  readonly command: CliCommand;
  readonly targets: readonly OutputTarget[];
  readonly platforms?: readonly Platform[];
}

export function parseArgs(argv: readonly string[]): ParsedCliArgs {
  let command: CliCommand | undefined;
  let root: string | undefined;
  const targets: string[] = [];
  const platforms: string[] = [];
  const patterns: string[] = [];
  const platformDirs: string[] = [];
  let help = false;
  let version = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "build" || arg === "lint") {
      if (command) throw new Error("Only one command may be specified");
      command = arg;
    } else if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--version" || arg === "-v") version = true;
    else if (arg === "--root") {
      root = argv[++index];
      if (!root) throw new Error("--root requires DIR");
    } else if (arg === "--target") {
      const target = argv[++index];
      if (!target) throw new Error("--target requires PLATFORM=DIR");
      targets.push(target);
    } else if (arg === "--platform") {
      const platform = argv[++index];
      if (!platform) throw new Error("--platform requires PLATFORM");
      platforms.push(platform);
    } else if (arg === "--platform-dir") {
      const mapping = argv[++index];
      if (!mapping) throw new Error("--platform-dir requires PLATFORM:KIND=PATH");
      platformDirs.push(mapping);
    } else if (arg?.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else if (arg) patterns.push(arg);
  }
  return { command, root, targets, platforms, platformDirs, patterns, help, version };
}

export function validateArgs(args: ParsedCliArgs): ValidatedCliArgs {
  if (!args.command) throw new Error("A build or lint command is required");
  if (!args.targets.length) throw new Error("At least one --target is required");
  if (!args.patterns.length) throw new Error("At least one file or glob is required");
  const parsePlatform = (value: string): Platform => {
    if (!(PLATFORMS as readonly string[]).includes(value)) throw new Error(`Unknown platform: ${value}`);
    return value as Platform;
  };
  const targets = args.targets.map((target): OutputTarget => {
    const separator = target.indexOf("=");
    if (separator < 1 || separator === target.length - 1) throw new Error(`Malformed target: ${target}`);
    return { platform: parsePlatform(target.slice(0, separator)), outDir: target.slice(separator + 1) };
  });
  const platforms = args.platforms.length ? args.platforms.map(parsePlatform) : undefined;
  const platformDirs: NonNullable<BuildOptions["platformDirs"]> = {};
  for (const mapping of args.platformDirs) {
    const match = /^([^:]+):(skills|agents|hooks|plugin|conventions)=(.+)$/.exec(mapping);
    if (!match) throw new Error(`Malformed platform directory: ${mapping}`);
    const platform = parsePlatform(match[1] ?? "");
    const kind = match[2] as "skills" | "agents" | "hooks" | "plugin" | "conventions";
    const path = match[3] ?? "";
    const directories = platformDirs[platform] ?? {};
    if (directories[kind] !== undefined) throw new Error(`Duplicate platform directory: ${platform}:${kind}`);
    directories[kind] = path;
    platformDirs[platform] = directories;
  }
  return {
    command: args.command,
    root: args.root ?? process.cwd(),
    targets,
    platforms,
    patterns: [...new Set(args.patterns)].sort(),
    platformDirs,
  };
}

const HELP =
  "Usage: agent-skills <build|lint> [--root DIR] --target PLATFORM=DIR [--target ...] [--platform PLATFORM] [--platform-dir PLATFORM:KIND=PATH] <file-or-glob...>\n";
export interface CliDependencies {
  readonly build: (options: BuildOptions) => Promise<BuildResult>;
  readonly lint: (options: LintOptions) => Promise<LintResult>;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}
const DEFAULT_DEPENDENCIES: CliDependencies = {
  build,
  lint,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};
export function formatResidueWarnings(residues: readonly TransactionResidue[]): string[] {
  return [...residues]
    .sort((left, right) =>
      `${left.kind}\0${left.path}\0${left.error}`.localeCompare(`${right.kind}\0${right.path}\0${right.error}`),
    )
    .map((item) => `Warning: publication succeeded; cleanup residue [${item.kind}] ${item.path}: ${item.error}\n`);
}
export async function run(
  argv: readonly string[] = process.argv.slice(2),
  dependencies: CliDependencies = DEFAULT_DEPENDENCIES,
): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      dependencies.stdout(HELP);
      return 0;
    }
    if (parsed.version) {
      dependencies.stdout("1.0.26\n");
      return 0;
    }
    const options = validateArgs(parsed);
    if (options.command === "lint") {
      const result = await dependencies.lint(options);
      if (!result.ok)
        for (const item of result.diagnostics)
          dependencies.stderr(
            `${item.sourcePath}:${item.location?.line ?? 1}:${item.location?.column ?? 1} [${item.rule}] ${item.message}\n`,
          );
      return result.ok ? 0 : 1;
    }
    const result = await dependencies.build(options);
    for (const item of result.written)
      dependencies.stdout(`${item.target.platform}=${item.target.outDir}: ${item.files.join(", ")}\n`);
    for (const warning of formatResidueWarnings(result.residues)) dependencies.stderr(warning);
    return 0;
  } catch (error) {
    dependencies.stderr(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

const invoked = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invoked) process.exitCode = await run();
