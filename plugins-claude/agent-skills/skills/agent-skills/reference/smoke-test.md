# Smoke-test delivery

Installing is delivery, not function. Verify both and keep the verdicts separate.

## Isolate every run

Point `HOME`, and `CODEX_HOME` for Codex, at throwaway directories before any install. Host state otherwise leaks between runs and a leftover registration reads as a pass. Create `CODEX_HOME` first: Codex aborts when the directory does not exist.

Isolation is rarely total. Use a throwaway working directory too: Claude still reads project `.claude/settings*.json`, and `opencode plugin <path>` writes `.opencode/opencode.json` under the current project rather than under `HOME`. A Claude install under a throwaway `HOME` still reported a marketplace "declared in user settings" when run from a configured repository, and `claude plugin enable` edited that repository's settings. Run host commands from the throwaway directory, pass source/plugin paths as absolute paths, and confirm what the run actually wrote instead of trusting the sandbox.

## Route and check per host

| Host | Install | Check | The check proves |
| --- | --- | --- | --- |
| Claude Code | `claude plugin marketplace add <root>`, then `claude plugin install <name>@<marketplace>` | `claude plugin details <name>` for inventory; an eval case or `claude -p` for execution | structural / behavioral |
| Codex | `codex plugin marketplace add <root>`, then `codex plugin add <name>@<marketplace>` | `codex plugin list` | structural |
| OpenCode | from a throwaway cwd, `opencode plugin <absolute-path>` | `opencode debug skill`, redirected to a file; `opencode run` for execution | structural / behavioral |
| Antigravity | `agy plugin install <local path or git URL with the in-repo path appended>` | `agy plugin list` | structural |

Codex traps: the subcommand is `add`, never `install`, and `<plugin>@<marketplace>` stays mandatory with a single marketplace configured. Read the plain table, not `--json` — through 0.150.1 the JSON form returns an empty `available` array while the table lists every uninstalled plugin. Installed files land under `$CODEX_HOME/plugins/cache/<marketplace>/<plugin>/<version>/`.

`opencode debug skill` emits whole skill bodies. Redirect it and search the file; piping to `head` truncates the JSON mid-string and reports a present skill as missing. It is the only host command that names everything loaded.

`agy plugin install` prints a per-component processed count and `agy plugin list` reports component kinds, never names. Installed files land in `~/.gemini/config/plugins/<name>/`.

## Assert on host identities

A directory name, frontmatter `name:`, and host-visible identity can be different strings. Read `name:` from each SKILL.md, then apply the host's namespace rule. Claude Code and Codex can distinguish the same leaf name in different plugins; do not flag their two entries named `cli` as a collision. OpenCode exposes flattened names such as `jsdoczoom-cli` and `claude-code-skill-reader-cli`. Assert against the names the host reports, not directory names or a raw global set of frontmatter values.

## Count occurrences

Two registered roots serving one host identity collide, and a duplicate satisfies any presence check. Count each loaded host identity rather than testing membership. Preserve plugin namespaces on hosts that have them; flatten only where that host's renderer does.

## A/B every causal claim

A patched install that succeeds does not show the patch caused it. Run the unpatched copy at the same version in the same harness, alternate the order, and repeat each arm. Two confidently reported findings dissolved under that treatment — a supposed `./` prefix loading failure, and a supposed suppression of global discovery by `config.skills.paths`. Both were single-run artifacts.

## Label the result

Mark each host `behavioral`, `structural`, or `blocked`, and never let a weaker result borrow a stronger one's word. A validated manifest, a listed file, or a successful install proves packaging. Only the host loading and running the skill proves function. Report an unauthenticated or unrunnable host as blocked.

## Reach the behavioral ceiling

Structural checks stop at packaging. To prove function, generate a fixture skill whose body carries a unique random sentinel, then invoke the host non-interactively — `claude -p`, `codex exec`, `opencode run`, `agy --print-timeout 45s -p='<prompt>'` — with one prompt: load that fixture and print its sentinel verbatim, nothing else. Antigravity's short `-p` consumes the next token as its prompt, so attach the value or put every option before `-p`. Capture stdout and stderr separately and require the exact sentinel in stdout. Classify each failure as CLI unavailable, unauthenticated, or resolution failure; they are different defects.

A single fixture proves the discovery route, not an inventory claim. To claim that every shipped skill loads, first assert the complete host-visible inventory and exact occurrence counts, then behaviorally invoke at least one skill from every installed plugin. If a host cannot enumerate skill names, invoke each expected host identity explicitly; a plugin list plus one successful skill does not prove that its siblings loaded.

Every host reaches behavioral this way, Antigravity included: `agy -p` refuses only while unauthenticated, and once a session exists it resolves an installed skill and prints its sentinel. Report a missing credential as `blocked` — a host you cannot authenticate is untested, not structurally capped. Never infer a behavioral result for one host from another.

Trap cleanup so installations, marketplace registrations, throwaway homes, and caches are removed even when a command fails. Record each host's CLI version beside its result: these surfaces move between releases.
