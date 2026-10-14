/**
 * Bound correctness and optional smoke subprocesses and diagnose their actual progress without changing IPC liveness.
 * @summary Kill and drain owned process groups before reporting child failures.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { loadavg, tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

/** Per-child integration bound; real-context sequences may perform several cold fingerprints. */
export const integrationChildTimeout = 60_000;
/** Leave time for owned process termination, diagnostics and fixture cleanup. */
export const integrationTestTimeout = integrationChildTimeout + 15_000;

type Options = {
  environment?: NodeJS.ProcessEnv;
  expectedCode?: number;
  progress?: string;
  rejectStderr?: boolean;
  timeoutMs?: number;
  label: string;
};

/**
 * Run one owned process with bounded output and a whole-group deadline.
 * @param command - Executable to launch.
 * @param args - Literal executable arguments.
 * @param options - Owned diagnostic context and expected result.
 * @returns Captured standard output and error after exit.
 * @throws Process failures or deadline violations, with stage/output/load evidence.
 */
export function runProcess(
  command: string,
  args: string[],
  options: Options
): Promise<{ stdout: string; stderr: string }> {
  const started = performance.now();
  const timeoutMs = options.timeoutMs ?? integrationChildTimeout;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > integrationChildTimeout)
    throw new Error('smoke deadline must be positive and at most sixty seconds');
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.environment,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '',
      stderr = '',
      expired = false,
      lastOutputMs = 0;
    const deadline = setTimeout(() => {
      expired = true;
      try {
        if (child.pid !== undefined && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.stdout.on('data', (bytes: Buffer) => {
      stdout = (stdout + bytes.toString()).slice(-131072);
      lastOutputMs = performance.now() - started;
    });
    child.stderr.on('data', (bytes: Buffer) => {
      stderr = (stderr + bytes.toString()).slice(-131072);
      lastOutputMs = performance.now() - started;
    });
    child.on('error', (error) => {
      clearTimeout(deadline);
      reject(error);
    });
    child.on('close', async (code, signal) => {
      clearTimeout(deadline);
      if (!expired && code === (options.expectedCode ?? 0) && !(options.rejectStderr && stderr)) {
        resolve({ stdout, stderr });
        return;
      }
      const progress = options.progress
        ? await readFile(options.progress, 'utf8').catch(() => 'no checkpoint')
        : 'no checkpoint';
      const pressure = await readFile('/proc/pressure/cpu', 'utf8').catch(() => 'unavailable');
      reject(
        new Error(
          JSON.stringify({
            label: options.label,
            deadlineMs: timeoutMs,
            elapsedMs: performance.now() - started,
            expired,
            code,
            signal,
            lastOutputMs,
            load: loadavg(),
            cpuPressure: pressure,
            progress: progress.slice(-4096),
            stdout: stdout.slice(-4096),
            stderr: stderr.slice(-4096)
          })
        )
      );
    });
  });
}

/**
 * Run an isolated script with an owned progress sidecar, preserving stdout/stderr assertions.
 * @param source - Real worker/backend/integration script.
 * @param args - Node flags required by the fixture.
 * @param expectedCode - Expected process exit status.
 * @returns Exact bounded standard output.
 * @throws Script or deadline errors after group termination and fixture cleanup.
 */
export async function runScript(source: string, args: string[] = [], expectedCode = 0): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'vc-'));
  const entry = path.join(directory, 'child.mjs'),
    progress = path.join(directory, 'progress.json');
  const prelude = `import {writeFileSync as smokeWrite} from 'node:fs';
    const smokeStarted=performance.now();
    function smokeCheckpoint(stage) {const cpu=process.threadCpuUsage();smokeWrite(${JSON.stringify(progress)},JSON.stringify({stage,elapsedMs:performance.now()-smokeStarted,threadCpuMs:(cpu.user+cpu.system)/1000,rss:process.memoryUsage().rss}));}
    smokeCheckpoint('module loaded');\n`;
  try {
    await writeFile(entry, prelude + source);
    return (
      await runProcess(process.execPath, [...args, entry], {
        label: 'smoke script',
        progress,
        expectedCode,
        rejectStderr: true
      })
    ).stdout;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
