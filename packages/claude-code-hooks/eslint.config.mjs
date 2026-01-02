import { makeConfig } from '../../eslint.config.mjs';
import jsdoc from 'eslint-plugin-jsdoc';

export default makeConfig(
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  // JSDoc plugin configuration for documentation enforcement on exports
  jsdoc.configs['flat/recommended-typescript'],
  {
    plugins: {
      jsdoc
    },
    rules: {
      // Require JSDoc for exported functions, classes, and types
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            ArrowFunctionExpression: true,
            ClassDeclaration: true,
            ClassExpression: true,
            FunctionDeclaration: true,
            FunctionExpression: true,
            MethodDefinition: true
          },
          contexts: [
            'ExportNamedDeclaration > TSTypeAliasDeclaration',
            'ExportNamedDeclaration > TSInterfaceDeclaration'
          ]
        }
      ],
      // Require @example in JSDoc for exported APIs
      'jsdoc/require-example': [
        'warn',
        {
          contexts: ['ExportNamedDeclaration > FunctionDeclaration', 'ExportNamedDeclaration > VariableDeclaration'],
          checkConstructors: false,
          checkGetters: false,
          checkSetters: false
        }
      ],
      // Require @returns documentation
      'jsdoc/require-returns': ['warn', { checkGetters: false }],
      // Require @param documentation
      'jsdoc/require-param-description': 'warn',
      // Check @example code validity
      'jsdoc/check-examples': 'off' // TypeScript examples need special handling
    }
  }
);
