import config from '../../eslint.config.mjs';
import globals from 'globals';

export default [
  ...config,
  {
    ignores: ['tests/fixtures/**/*']
  },
  {
    files: ['src/bin/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
];
