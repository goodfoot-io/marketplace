declare module 'glob-gitignore' {
  import * as glob from 'glob';

  function glob(patterns: string | string[], options?: glob.Options): Promise<string[]>;
  function sync(patterns: string | string[], options?: glob.Options): string[];

  export { glob, sync };
}
