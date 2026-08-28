/**
 * Yarn's builtin `compat/typescript` patch targets the legacy JS compiler
 * package layout (e.g. `lib/_tsc.js`). It hard-errors against the TypeScript 7
 * native (Go) compiler package and the `@typescript/typescript6` compat shim,
 * which don't ship those files. We don't use Yarn PnP, so the patch isn't
 * semantically needed — this strips it from the `typescript` descriptor so
 * Yarn installs the plain package instead.
 *
 * @see https://github.com/yarnpkg/berry/issues/7191
 */
module.exports = {
  name: "plugin-disable-typescript-compat",
  factory: (require) => {
    const { structUtils } = require("@yarnpkg/core");

    return {
      hooks: {
        reduceDependency: async (dependency) => {
          if (structUtils.stringifyIdent(dependency) !== "typescript") return dependency;
          if (!dependency.range.startsWith("patch:")) return dependency;

          const source = dependency.range.match(/^patch:([^#]+)/)?.[1];
          if (!source) return dependency;

          return {
            ...dependency,
            range: structUtils.parseDescriptor(decodeURIComponent(source)).range,
          };
        },
      },
    };
  },
};
