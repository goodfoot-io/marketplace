import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globals: false,
    // Several specs here exercise guards that only exist because they act on
    // the real repository, so they have to mutate it: the untracked-content
    // refusal plants a file in plugins-voice/voice/skills, and generated-fresh runs
    // a real build that renames every declared tree. The build driver's target
    // allow-list admits only the four canonical trees, so those fixtures
    // cannot be relocated to a scratch path without giving up the thing under
    // test. Run files one at a time instead — in parallel, any sibling that
    // enumerates a generated tree can observe another file's fixture, which
    // showed up as a single failing test that moved between files run to run
    // and never reproduced when the file was run alone.
    fileParallelism: false,
    // The generated-fresh spec runs two full esbuild bundle builds; everything
    // else is filesystem/git work. Defaults are fine except for that one.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
