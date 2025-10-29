import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import 'eslint-import-resolver-typescript';

export function makeConfig(...configs) {
  return tseslint.config(
    ...configs,
    {
      ignores: ['**/*.cjs', 'eslint.config.mjs', 'print.mjs', 'dependencies.ts', 'inverse-dependencies.ts', '.worktrees/**', 'documentation/**', 'reports/**']
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    importPlugin.flatConfigs.recommended,
    {
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }],

        
        '@typescript-eslint/no-misused-promises': [
          'error',
          {
            checksVoidReturn: false
          }
        ],
        'import/no-named-as-default': ['off'],
        'import/no-named-as-default-member': ['off'],
        'import/order': [
          'error',
          {
            alphabetize: {
              order: 'asc',
              caseInsensitive: true
            },
            pathGroups: [
              {
                pattern: '@hotline/*',
                group: 'internal'
              },
              {
                pattern: 'react',
                group: 'external',
                position: 'before'
              }
            ],
            groups: ['type', 'builtin', 'external', 'internal', 'index', 'sibling', 'parent', 'object']
          }
        ]
      },
      settings: {
        'import/parsers': {
          '@typescript-eslint/parser': ['.ts', '.tsx', '.js', '.jsx']
        },
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`

            project: ['packages/**/tsconfig.json']
          }
        }
      }
    },
    {
      files: ['**/test/**/*.ts', '**/*.test.ts'],
      rules: {
        'import/namespace': 'off'  // Sinon types don't export stub in namespace, but it exists at runtime
      }
    },
    prettierConfig
  );
}

export default makeConfig({
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname
    }
  }
});
