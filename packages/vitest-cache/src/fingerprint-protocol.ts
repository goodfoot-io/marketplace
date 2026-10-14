/**
 * Coarse fingerprint commands: paths and small descriptions cross threads, file bytes do not.
 * @summary Share the bounded worker protocol without importing host runner state.
 */
export type FingerprintCommand =
  | { kind: 'json'; values: unknown[] }
  | {
      kind: 'local';
      phase: number;
      root: string;
      folder: string | null;
      files: string[];
      declarations: string[];
      executables: string[];
      execution: unknown;
    }
  | {
      kind: 'closure';
      phase: number;
      root: string;
      folder: string | null;
      paths: string[];
      toolchain: string[];
      toolchainRoot: string;
    }
  | { kind: 'release'; phase: number };
/** A request identifier matches exactly one in-flight command per worker. */
export type FingerprintRequest = { id: number; command: FingerprintCommand };
/** Completed worker observations, or a fail-closed operation error. */
export type FingerprintResponse = { id: number; value: unknown } | { id: number; error: string };

/** Cumulative completed-phase counters from the original worker-side digest backend. */
export type FingerprintStatistics = {
  filesRead: number;
  globs: number;
  executables: number;
  reused: number;
  computed: number;
  bytesRead: number;
  filesStatted: number;
  directoriesRead: number;
};
/** Stable checked counter names, excluding worker wall times that cannot be added meaningfully. */
export const fingerprintStatisticNames: (keyof FingerprintStatistics)[] = [
  'filesRead',
  'globs',
  'executables',
  'reused',
  'computed',
  'bytesRead',
  'filesStatted',
  'directoriesRead'
];
/**
 * Construct independent empty observation counters for an unused role or fresh controller.
 * @returns Zeroed backend counters.
 */
export function emptyFingerprintStatistics(): FingerprintStatistics {
  return {
    filesRead: 0,
    globs: 0,
    executables: 0,
    reused: 0,
    computed: 0,
    bytesRead: 0,
    filesStatted: 0,
    directoriesRead: 0
  };
}
