<golden-rule>
Run the smallest set of checks that covers the credible failure modes of the change; expand validation at dependency boundaries, under uncertainty, and at integration gates.

Resolve every warning and failure from the required checks, including ones you did not cause; never dismiss them as "pre-existing" or "unrelated". A required check blocked by an infrastructure error is a blocking condition; do not proceed.
</golden-rule>

<workspace>
Greenfield Yarn 4.x monorepo, packages in `./packages/`. Use Yarn, never `npm`; prefer local over origin branches. No migrations, backwards compatibility, or fallbacks. Choose the "right way" over the "easy way"; prefer fail-closed workflows over fail-open. When asked to commit, commit to the current local branch — never create a new branch first, even on `main`.

Packages are independent. Never run build/lint/test repo-wide (e.g. `yarn workspaces foreach -A run <script>` from the root, or a root-level `yarn test`/`yarn validate`). Run validation scoped to the specific package(s) you changed, e.g. `yarn workspace <package-name> run test`.
</workspace>

<tools>
# ast-grep

Use for structural, AST-based search or rewrite when plain-text/regex grep is too imprecise or fragile.

- Omitted syntax is not wildcarded: `fn($$$) { $$$ }` silently gets 0 matches against a function with a return-type annotation. Add `$$$` slots for everything present in the actual code (`fn($$$A): $$$B { $$$C }`).
- String literals match by exact quote style (`"x"` ≠ `'x'`), so finding all import sites of a module needs one pattern per distinct path form in use (`./x.js`, `../a/x.js`, dynamic `import('./x.js')`).
- Bash: single-quote patterns containing `$$$` — double quotes mangle the sigil.
- `scan` rule's `language` must match the file extension exactly — `typescript` silently skips `.tsx`; run a second rule with `language: tsx` (no combined `languages: [...]` list).
- Minimal valid `-r`/`--inline-rules` YAML (nesting is strict, no shorthand):
  ```yaml
  id: no-console-log
  language: typescript
  rule:
    pattern: console.log($$$)
  severity: warning
  message: Remove leftover console.log
  ```

# jsdoczoom

Use to explore or validate a TypeScript file's JSDoc without reading its full source.

- Selector is `<path>@<depth>` (e.g. `jsdoczoom packages/foo/bar.ts@3`); drill deeper by re-running with the returned header/`next_id` as the selector. Returned depth can differ from requested (barrel-gated dirs remap) — trust the returned value.
- `--explain-rule <id>` gives rationale plus a passing example for turning a lint hit into a fix.

</tools>
