declare module '@joplin/turndown-plugin-gfm' {
  interface TurndownPlugin {
    (turndownService: unknown): void;
  }

  export const gfm: TurndownPlugin;
}
