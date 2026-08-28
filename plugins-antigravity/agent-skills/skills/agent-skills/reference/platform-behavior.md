# Review per-platform behavior

Treat platform output as a dialect selected from one typed definition table, not as a family of copied documents. The platform table drives helpers, frontmatter allowlists, lint rules, and generated helper documentation together.

## Verified platform distinctions

- Claude Code uses `CLAUDE.md` for repository conventions, while Codex and OpenCode use `AGENTS.md`.
- Skill references retain namespaces for Claude Code and Codex. OpenCode drops the namespace. Codex and OpenCode use their native skill sigils where required; Claude Code invocation is a block-level Skill-tool form.
- Canonical agent IDs have three segments. Codex and OpenCode flatten the latter two segments for their native form; templates must not pre-flatten them.
- Claude Code agent effort slots use a model placeholder. Codex and OpenCode use an effort placeholder.
- Worktree, subagent, plugin-root, frontmatter, and destination syntax is platform-defined. Use helpers instead of spelling these values in portable templates.

Consult the sibling reference `helper-reference.md` for the current helper-by-platform classifications. A `verified` cell is grounded in a supported repository or host surface. A `provisional` cell is visibly tentative. An `unavailable` cell must fail during rendering rather than inherit a value from another platform.

## Dialect vs. substance

A helper keys on *rendering platform* — which tree a file is being published into. It does not, and must not, key on *subject matter* — which host's API or behavior a document is actually about. These coincide for a single-subject skill rendered three ways, so the two axes look identical. They are not. A plugin whose skills each teach a different host — one documenting Claude Code hooks, a sibling documenting Codex hooks — exposes the difference: the Claude-Code-hooks skill's build command, links, and examples stay about Claude Code in every rendered tree, including the Codex and OpenCode copies. Routing that through `it.variant()` because it "looks platform-shaped" renders a *wrong* document: the Codex tree's copy would start teaching Codex's command.

The test before reaching for a helper: does this value's correct form depend on which tree the file renders into, or on what the file is about? Only the former is dialect. Subject matter — a different API, a different capability set, a document that would be wrong if "corrected" to match its sibling — stays as undoctored prose in its own template, scoped with front-config `platforms:` when it should not render for a host at all.

## Porting review

Render each selected platform and review the output in that platform's dialect. Check exact bytes and inventory, including opaque assets, rather than comparing only Markdown meaning. In particular, inspect skill and agent references, conventions filenames, native frontmatter keys, logical destination roots, block-level invocation whitespace, and forbidden plugin-root variables inside skill Markdown.

Keep the declared platform set honest. A build target that intentionally renders zero files cannot be represented in Git and will be recreated only on machines that happen to run the build; omit unsupported targets instead of declaring empty output trees. Conversely, do not infer support from a generated directory alone. Confirm each shipped tree with the host's real skill-loading command, and record deliberate platform exceptions where the taught capability exists on only one host:

| Platform | Skill-loading check |
| --- | --- |
| Claude Code | `claude plugin list` |
| Codex | `codex plugin list --json` |
| OpenCode | `opencode debug skill` |
| Antigravity | `agy plugin list` |

`opencode debug skill` emits whole skill bodies. Redirect it to a file and search there; piping it to `head` truncates the JSON mid-string and reports a present skill as missing.

Multiple targets for one platform must receive the same already-rendered bytes. If two sources or normalized targets collide, or an output is nested inside an input tree, stop and correct the configuration rather than choosing a winner.

Judge byte-faithful ports against parsed frontmatter values and body bytes, not raw file bytes: `it.frontmatter()` may reflow a long `description`'s YAML folding even when the parsed value is unchanged. Build the equivalence check against a pinned pre-migration copy of the source (a git blob at a known revision), never against the migration's own rendered output — that only proves the renderer is self-consistent, not that it preserved the original.

## Distribution and verification

Installing is delivery, not function. One passing route per platform is not coverage: each host ships through several routes that fail independently — a marketplace, a direct git URL, a local path, an npm name, a packed tarball. Enumerate the routes, exercise the ones you claim, and say which you exercised.

Label every result `behavioral`, `structural`, or `blocked`. A weaker result never borrows the word "pass" from a stronger one: a validated manifest, a listed file, or a successful install proves packaging, and only the host loading and running the skill proves function. Report an unauthenticated or unrunnable host as blocked, not as passing.

When an installer rejects the package, clone the installer's source and read its detection logic instead of inferring it from the error text. Prove the fix by A/B against the unpatched published copy at the same version; a patched install that merely succeeds does not establish that the patch caused it.

Where a plugin ships a companion binary as per-platform npm packages, `npm pack` each one and run `file` on the binary inside to confirm it matches the package's declared `os`/`cpu`. A same-OS foreign architecture often runs under emulation and proves little; another OS's binary cannot run at all. Structural verification is the ceiling here.

### OpenCode's dual-purpose manifest

`plugins-opencode/<name>/package.json` is both the npm publishing manifest and a version-bearing release surface, so it is hand-maintained; only the generated skill leaf beneath it is build output.

The installer detects targets from that manifest alone, never from the module's exports. A package exposing only `exports["."]` is rejected with `No plugin targets found` even though the code is correct. Declare `main`, `exports["./tui"]`, or `exports["./server"]`. Adding one is inert for consumers: OpenCode patches its config with the package name, so runtime resolution still goes through `exports["."]`.
