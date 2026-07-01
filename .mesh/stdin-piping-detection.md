# stdin piping detection

**Why:** The stdin piping detection (`!process.stdin.isTTY`) implementation and its version release (1.2.4) with changelog documentation ensure that CLI commands correctly handle piped input; updates to version and changelog must stay synchronized with the implementation when the fix is modified.

**Anchors:**

- packages/jsdoczoom/package.json#L3
- packages/jsdoczoom/CHANGELOG.md#L3
- packages/jsdoczoom/src/cli.ts#L721-L724
