/** Build the required platform-local Node-API v8 addon using vendored Node 24.16 headers. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux' && process.platform !== 'darwin') {
  throw new Error('vitest-cache native metadata requires Linux or macOS');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'build', 'Release');
mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(path.join(output, '.metadata-'));
try {
  const flags = process.platform === 'darwin' ? ['-bundle', '-undefined', 'dynamic_lookup'] : ['-shared'];
  const build = spawnSync(
    process.env.CC || 'cc',
    [
      '-O2',
      '-std=c11',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-fPIC',
      '-DNAPI_VERSION=8',
      ...flags,
      '-I',
      path.join(root, 'native', 'node-api'),
      path.join(root, 'native', 'metadata.c'),
      '-o',
      path.join(temporary, 'metadata.node')
    ],
    { cwd: root, stdio: 'inherit', timeout: 120_000 }
  );
  if (build.error) throw build.error;
  if (build.status !== 0) throw new Error(`Required native metadata build failed (${build.status})`);
  renameSync(path.join(temporary, 'metadata.node'), path.join(output, 'metadata.node'));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
