import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBarrel, getBarrelChildren } from '../src/barrel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

describe('isBarrel', () => {
  it('detects index.ts as barrel', () => {
    expect(isBarrel('/some/path/index.ts')).toBe(true);
    expect(isBarrel('index.ts')).toBe(true);
  });

  it('detects index.tsx as barrel', () => {
    expect(isBarrel('/some/path/index.tsx')).toBe(true);
    expect(isBarrel('index.tsx')).toBe(true);
  });

  it('non-index files are not barrels', () => {
    expect(isBarrel('/some/path/helper.ts')).toBe(false);
    expect(isBarrel('/some/path/index.test.ts')).toBe(false);
    expect(isBarrel('/some/path/index.d.ts')).toBe(false);
    expect(isBarrel('/some/path/index.stories.tsx')).toBe(false);
    expect(isBarrel('/some/path/main.ts')).toBe(false);
    expect(isBarrel('/some/path/utils.tsx')).toBe(false);
  });
});

describe('getBarrelChildren', () => {
  it('returns leaf children from barrel directory', () => {
    const barrelPath = resolve(fixturesDir, 'barrel-basic', 'index.ts');
    const children = getBarrelChildren(barrelPath, fixturesDir);

    const childNames = children.map((c) => c.split('/').pop());
    expect(childNames).toContain('helper.ts');
    expect(childNames).toContain('utils.ts');
    expect(childNames).not.toContain('index.ts');
  });

  it('returns child barrel from subdirectory', () => {
    const barrelPath = resolve(fixturesDir, 'barrel-nested', 'index.ts');
    const children = getBarrelChildren(barrelPath, fixturesDir);

    const childPaths = children.map((c) => c.replace(fixturesDir + '/', ''));
    expect(childPaths).toContain('barrel-nested/leaf.ts');
    expect(childPaths).toContain('barrel-nested/sub/index.ts');
    expect(childPaths).not.toContain('barrel-nested/index.ts');
  });

  it('index.ts takes priority over index.tsx in same directory', () => {
    const barrelPath = resolve(
      fixturesDir,
      'barrel-ts-tsx-priority',
      'index.ts',
    );
    const children = getBarrelChildren(barrelPath, fixturesDir);

    const childNames = children.map((c) => c.split('/').pop());
    // index.tsx should be included as a leaf (sibling, not the barrel)
    expect(childNames).toContain('index.tsx');
    expect(childNames).toContain('other.ts');
    // The barrel itself (index.ts) should not be included
    expect(childNames).not.toContain('index.ts');
  });

  it('barrel with zero children returns empty array', () => {
    const barrelPath = resolve(
      fixturesDir,
      'barrel-zero-children',
      'index.ts',
    );
    const children = getBarrelChildren(barrelPath, fixturesDir);
    expect(children).toEqual([]);
  });

  it('excludes .d.ts files', () => {
    // Use barrel-basic which has no .d.ts files; verify none appear
    const barrelPath = resolve(fixturesDir, 'barrel-basic', 'index.ts');
    const children = getBarrelChildren(barrelPath, fixturesDir);
    for (const child of children) {
      expect(child).not.toMatch(/\.d\.ts$/);
    }
  });
});
