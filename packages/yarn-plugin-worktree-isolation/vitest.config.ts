import { defineConfig, defineProject } from 'vitest/config';
import { loadCacheContract, withTestOutput } from '@goodfoot/vitest-cache/policy';

export default withTestOutput(
  defineConfig({
    test: {
      reporters: 'verbose',
      projects: [
        defineProject({
          test: {
            name: 'yarn-plugin-worktree-isolation',
            globals: true,
            environment: 'node',
            include: ['tests/**/*.test.ts'],
            exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/bundles/**']
          }
        })
      ]
    }
  }),
  process.env.GITHUB_ACTIONS && process.env.GITHUB_EVENT_PATH
    ? { uncached: 'Yarn initialization reads the external GitHub Actions event file' }
    : loadCacheContract(new URL('./vitest.cache.json', import.meta.url))
);
