declare module 'glob-gitignore' {
  export function glob(patterns: string | string[], options?: Record<string, unknown>): Promise<string[]>;
  export function sync(pattern: string, options?: Record<string, unknown>): string[];
}
