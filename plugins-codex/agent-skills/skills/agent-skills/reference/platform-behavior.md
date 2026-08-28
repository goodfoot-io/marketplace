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

Keep the declared platform set honest. A build target that intentionally renders zero files cannot be represented in Git and will be recreated only on machines that happen to run the build; omit unsupported targets instead of declaring empty output trees. Conversely, do not infer support from a generated directory alone. Confirm each shipped tree with the host's real check, and record deliberate platform exceptions where the taught capability exists on only one host. Hosts differ in what their checks prove, and only two can name a loaded skill:

| Platform | Structural check | Behavioral check |
| --- | --- | --- |
| Claude Code | `claude plugin eval`; `claude plugin details <name>` for a component inventory | Invoke a sentinel-bearing skill with `claude -p` |
| OpenCode | `opencode debug skill` names every loaded skill | Invoke a sentinel-bearing skill with `opencode run` |
| Codex | `codex plugin list` reports id, version, source, and install status — no component inventory | Invoke a sentinel-bearing skill with `codex exec` |
| Antigravity | `agy plugin list` reports component kinds, never skill names | From an authenticated session, invoke a sentinel-bearing skill with `agy --print-timeout 45s -p='<prompt>'` |

`opencode debug skill` emits whole skill bodies. Redirect it to a file and search there; piping it to `head` truncates the JSON mid-string and reports a present skill as missing.

Use Codex's table output, not `--json`: through 0.150.1 the JSON mode returns an empty `available` array even when the table lists every uninstalled plugin, so automation must not read availability from it. Installing has three more traps: the subcommand is `codex plugin add`, not `install`; it demands `<plugin>@<marketplace>` even with one marketplace configured; and `CODEX_HOME` must already exist. A Codex install lands under `$CODEX_HOME/plugins/cache/<marketplace>/<plugin>/<version>/`.

Multiple targets for one platform must receive the same already-rendered bytes. If two sources or normalized targets collide, or an output is nested inside an input tree, stop and correct the configuration rather than choosing a winner.

Judge byte-faithful ports against parsed frontmatter values and body bytes, not raw file bytes: `it.frontmatter()` may reflow a long `description`'s YAML folding even when the parsed value is unchanged. Build the equivalence check against a pinned pre-migration copy of the source (a git blob at a known revision), never against the migration's own rendered output — that only proves the renderer is self-consistent, not that it preserved the original.

## Distribution and verification

Installing is delivery, not function. One passing route per platform is not coverage: hosts ship through several independently-failing routes — marketplace, git URL, local path, npm name, packed tarball. Enumerate them, exercise the ones you claim, and say which.

Label every result `behavioral`, `structural`, or `blocked`. A weaker result never borrows "pass" from a stronger one: a validated manifest, a listed file, or a successful install proves packaging; only the host loading and running the skill proves function. Report an unauthenticated or unrunnable host as blocked.

When an installer rejects the package, read its source's detection logic instead of inferring from the error text. Prove the fix by A/B against the unpatched copy at the same version; a patched install that merely succeeds does not establish causation.

Where a plugin ships a companion binary as per-platform npm packages, `npm pack` each and run `file` on the binary to confirm it matches the declared `os`/`cpu`. A same-OS foreign architecture often runs under emulation and proves little; another OS's binary cannot run at all. Structural verification is the ceiling.

### OpenCode plugin and skill delivery

`plugins-opencode/<name>/package.json` is both the npm publishing manifest and a version-bearing release surface, so it is hand-maintained; only the generated skill leaf beneath it is build output.

The installer detects targets from that manifest alone, never from the module's exports. A package exposing only `exports["."]` is rejected with `No plugin targets found` even though the code is correct. Declare `main`, `exports["./tui"]`, or `exports["./server"]`. Adding one is inert for consumers: OpenCode patches its config with the package name, so runtime resolution still goes through `exports["."]`.

`config.plugin` and `config.skills` are disjoint keys and `opencode plugin <path>` appends only to the former, so a bare install delivers the module without any skill it bundles. That is a default, not a platform limit: the plugin `Hooks` interface includes `config`, which mutates the resolved config before use, so a plugin can register its own skill leaf and make the bare install sufficient.

```javascript
const own = join(dirname(fileURLToPath(import.meta.url)), "skills");

export default async function plugin() {
  return {
    config: async (config) => {
      config.skills ??= {};
      const paths = config.skills.paths ?? [];
      if (!paths.includes(own)) config.skills.paths = [...paths, own];
    },
  };
}
```

Resolve that path from `import.meta.url`; the package installs outside the repository, so `process.cwd()` and literals both break. Deduplicate against paths already present, because a developer working in the source repository normally registers the same leaf by hand. Skip a leaf another registered root already serves — duplicate names across two roots collide.
