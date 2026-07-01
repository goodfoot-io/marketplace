# empty stdin selector bypass

**Why:** The empty-stdin guard (`stdin !== undefined && stdin.trim().length > 0`) is the behavioral fix that caused the 1.2.5 release; the version and changelog entry document exactly this change, so modifying the guard or its semantics requires updating the release record, and updating the release record implies the guard was changed.

**Anchors:**

- packages/jsdoczoom/package.json#L3
- packages/jsdoczoom/CHANGELOG.md#L3-L4
- packages/jsdoczoom/src/cli.ts#L552
