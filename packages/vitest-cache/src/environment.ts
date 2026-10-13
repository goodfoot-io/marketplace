/**
 * Normalize execution-visible environment and reject unfingerprinted loaders.
 *
 * @summary Normalize execution-visible environment and reject unfingerprinted loaders.
 */
import path from 'node:path';

/**
 * The reviewed environment contract for cached Vitest runs.
 *
 * Session metadata identifies an agent session, a trace, a terminal/editor
 * program, or Turborepo's task hash, UI mode or invocation directory. It is
 * removed from both the environment that cached suites execute with and from
 * the result key. Removing it from execution keeps the key honest: a test
 * cannot observe a value the key ignores.
 *
 * Launcher and cache-control variables come from Yarn or control this cache.
 * They are kept in the process environment (nested Yarn and
 * build commands need them) but are not part of the key.
 *
 * Every other variable is significant.
 */
const SESSION_NAMES = new Set([
  'CLAUDECODE',
  'AI_AGENT',
  'TRACEPARENT',
  'TRACESTATE',
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'TERM_SESSION_ID',
  'WINDOWID',
  'TMUX',
  'TMUX_PANE',
  'STY',
  'WT_SESSION',
  'WT_PROFILE_ID',
  'SSH_TTY',
  'SSH_CLIENT',
  'SSH_CONNECTION',
  'XDG_SESSION_ID',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'DBUS_SESSION_BUS_ADDRESS',
  'COLUMNS',
  'LINES',
  // Task-wide invalidation, presentation and launch-directory metadata are not
  // per-file inputs. TURBO_INVOCATION_DIR is the absolute directory the turbo
  // command was typed in, so keying it would split results by worktree and by
  // root versus package invocation. Keep other TURBO_* variables significant,
  // including TURBO_IS_MFE ports.
  'TURBO_HASH',
  'TURBO_IS_TUI',
  'TURBO_INVOCATION_DIR'
]);
const SESSION_PREFIXES = /^(?:CODEX_|CLAUDE_|CCR_|ANTIGRAVITY_|GEMINI_|AGY_|VSCODE_|ITERM_|KONSOLE_|GNOME_TERMINAL_)/;

const LAUNCHER_NAMES = new Set([
  '_',
  'SHLVL',
  'PWD',
  'OLDPWD',
  'INIT_CWD',
  'PROJECT_CWD',
  'BERRY_BIN_FOLDER',
  'COREPACK_ROOT',
  'COREPACK_ENABLE_DOWNLOAD_PROMPT',
  'NODE',
  'DISABLE_TEST_CACHE'
]);
const LAUNCHER_PREFIXES = /^(?:GOODFOOT_VITEST_|npm_|YARN_)/;

function isSessionVariable(name: string) {
  return SESSION_NAMES.has(name) || SESSION_PREFIXES.test(name);
}

/**
 * Remove session metadata from an environment object in place.
 *
 * @param environment - Mutable execution environment; session metadata keys are deleted in place.
 */
export function stripSessionEnvironment(environment = process.env) {
  for (const name of Object.keys(environment)) {
    if (isSessionVariable(name)) delete environment[name];
  }
}

/**
 * PATH entries are literal inputs, except Yarn's temporary launcher folders and `node_modules/.bin` folders inside the active worktree. The latter link to installed packages whose identity the package closure hashes, so a second worktree's equivalent installation keys identically. A path under one worktree can be a shared, literal input in another, so other entries stay literal.
 *
 * @param name - Environment variable name.
 * @param value - Original variable value.
 * @param worktree - Active worktree for local launcher path normalization, when known.
 * @returns Literal value or normalized PATH excluding temporary Yarn launcher entries.
 */
export function environmentValue(name: string, value: string, worktree?: string) {
  if (name !== 'PATH') return value;
  return value
    .split(path.delimiter)
    .filter((entry) => !/^xfs-/.test(path.basename(entry)))
    .map((entry) => {
      if (!worktree || path.basename(entry) !== '.bin' || path.basename(path.dirname(entry)) !== 'node_modules')
        return entry;
      const relative = path.relative(worktree, entry);
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? `<worktree>/${relative}` : entry;
    })
    .join(path.delimiter);
}

/**
 * Sorted significant [name, value] pairs for the result key.
 *
 * @param environment - Execution-visible environment.
 * @param worktree - Active worktree for local launcher normalization.
 * @returns Sorted significant name/value pairs, excluding session and launcher metadata.
 */
export function keyedEnvironment(environment: NodeJS.ProcessEnv, worktree?: string): [string, string][] {
  return Object.entries(environment)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .filter(([name]) => !isSessionVariable(name) && !LAUNCHER_NAMES.has(name) && !LAUNCHER_PREFIXES.test(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => [
      name,
      name === 'GOODFOOT_TEST_OUTPUT_RESULT' ? 'enabled' : environmentValue(name, value, worktree)
    ]);
}

const PRELOAD =
  /^(?:--(?:require|import|loader|experimental-loader|inspect(?:-brk|-wait|-port)?|cpu-prof|heap-prof|experimental-test-coverage)|-r)(?:=|$)/;

/**
 * Node options that load or observe code outside the fingerprinted graph. `--import tsx` is accepted: the caller hashes the installed tsx package. Returns `{ reason }` when the run cannot be reused or published, otherwise `{ toolchain }` naming installed loaders to fingerprint.
 *
 * @param execArgv - Node command-line flags.
 * @param environment - Execution environment containing NODE_OPTIONS and loader variables.
 * @returns Explicit unsupported-loader reason or selected tsx toolchain inputs to fingerprint.
 * @throws {Error} When the collected Node option tokens contain a missing entry.
 */
export function nodeLoaderPolicy(
  execArgv: string[] = process.execArgv,
  environment: NodeJS.ProcessEnv = process.env
): { reason: string } | { toolchain: string[] } {
  const toolchain = new Set<string>();
  const tokens = [...execArgv, ...(environment.NODE_OPTIONS ?? '').split(/\s+/).filter(Boolean)];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) throw new Error('Missing Node option token');
    const normalizedToken = token.replaceAll('_', '-');
    if (!PRELOAD.test(normalizedToken)) continue;
    const inline = token.includes('=') ? token.slice(token.indexOf('=') + 1) : undefined;
    const value =
      inline ??
      (/^--inspect|^--cpu-prof|^--heap-prof|^--experimental-test-coverage/.test(normalizedToken)
        ? undefined
        : tokens[++index]);
    if (/^--import/.test(normalizedToken) && value === 'tsx') {
      toolchain.add('tsx');
      continue;
    }
    return { reason: `Node option ${token}${value ? ` ${value}` : ''} loads or observes unfingerprinted code` };
  }
  for (const name of Object.keys(environment)) {
    if (/^(?:NODE_PATH|NODE_V8_COVERAGE|TS_NODE_.+|TSX_.+)$/.test(name) && environment[name])
      return { reason: `${name} changes module loading or instrumentation` };
  }
  return { toolchain: [...toolchain].sort() };
}
