import config from '../../eslint.config.mjs';

export default [
  ...config,
  {
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' }
      }
    }
  }
];
