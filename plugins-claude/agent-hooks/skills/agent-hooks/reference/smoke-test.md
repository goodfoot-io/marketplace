# Hook smoke tests

Prove a compiled hook is installed **and fires**. A manifest on disk, a validated bundle, and a successful build all prove packaging. Only an observed effect proves the hook ran.

## Label every result

| Label | Earned by |
| --- | --- |
| `behavioral` | The hook ran and its effect was observed |
| `structural` | Artifacts exist and parse; nothing was executed |
| `blocked` | Host unavailable, unauthenticated, or unimplemented |

A weaker result never borrows the word "pass" from a stronger one. Report an unauthenticated host as blocked, never as passing.

## Two levels, run both

**Artifact level** — unauthenticated, scriptable, safe in CI. Drive the compiled bundle directly and assert its output envelope.

**Host level** — authenticated, manual. Run the real host, trigger a real event, and assert the effect. This is the only level that proves registration and wiring; the artifact level cannot see a manifest the host never loaded.

Passing the artifact level while the host level is blocked is a `structural` result for installation, not a `behavioral` one.

## Isolate first

Run every install into a throwaway `HOME`, and a throwaway `CODEX_HOME` that you create before invoking Codex — Codex errors if it points at a missing path. Use a throwaway working directory too: Claude reads project `.claude/settings*.json`, while `opencode plugin <path>` writes a project-local `.opencode/opencode.json` under the current directory. Leftover state from a previous run is the most common cause of a smoke test that passes without proving anything. Trap cleanup so temporary homes, project configs, caches, and registrations are removed even when a step fails.

## Procedure

1. **Record versions.** Capture each host CLI's version in the release evidence. A behavioral claim is scoped to the version that produced it.
2. **Compile.** Build the hook, targeting the throwaway tree.
3. **Install.** Put the manifest where the host discovers it, per that host's installation reference.
4. **Trigger.** Cause the event the hook subscribes to.
5. **Observe.** Assert the effect. Assert on the log line or the output envelope — never on file existence alone.

Before compiling a fixture, inventory the hooks the distribution actually declares. Check every hook-bearing plugin root, event key, matcher, and executable reference for that host. A platform directory containing no hook component means "not shipped", not "loaded"; report that gap explicitly instead of borrowing a pass from the SDK's factory/conformance tests. Conversely, one sentinel hook proves the host's loading route, not that every shipped manifest entry was discovered.

## The observable

Build or run with a log file and read it back; the logger is silent by default and writes nothing until a path is set.

```bash
export AGENT_HOOKS_LOG_FILE="$SMOKE_HOME/hooks.log"
```

Each entry is one JSON line carrying `hookType`, so a smoke test can assert the exact hook fired rather than merely that something logged:

```bash
jq -e 'select(.hookType == "PreToolUse")' "$AGENT_HOOKS_LOG_FILE"
```

Emit a unique random sentinel from the handler and require that exact sentinel in the log. A sentinel distinguishes this run's evidence from a stale file; a generic message does not.

Never add `console.log` to a handler to observe it. Stdout is the protocol on hosts that drive hooks over stdio; printing corrupts it and the run fails for a reason unrelated to what you were testing.

## Per-host triggers

The compiled artifact differs by host, so the artifact-level check differs too.

| Host | Compiled form | Artifact-level check | Host-level trigger |
| --- | --- | --- | --- |
| Claude Code | stdio executable + manifest | Pipe a synthetic event JSON to the bundle | `claude -p` with a prompt that forces the tool call |
| Codex | stdio executable + manifest | Pipe a synthetic event JSON to the bundle | `codex exec` with the same prompt |
| OpenCode | plugin module, no manifest | Import the module and assert its default export | `opencode run` with the same prompt |
| Antigravity | stdio executable + manifest | Pipe a synthetic event JSON to the bundle | `agy --print-timeout 45s -p='<prompt>'` with the same prompt |

Pipe synthetic input only in the wire shape the host's own reference documents; a hand-invented envelope tests your guess, not the contract.

OpenCode compiles to in-process plugin modules with no stdio driver and no manifest, so it has no pipe-based check. Its build already imports each output and rejects a module whose default export does not match the loader contract — that validation is `structural`, and only running the host makes it `behavioral`.

Antigravity reaches `behavioral`. Install with `agy plugin install <dir>`; `agy plugin list` must report `hooks` in `components`. Its throwaway `HOME` needs `~/.gemini/antigravity-cli/antigravity-oauth-token` copied in, or `agy -p` opens an interactive OAuth flow and hangs. Report a missing credential as `blocked`.

The host must expose an observable from the fixture. A loader warning, an enabled status, a manifest inventory, or a host invocation that happens to use the matching tool is still structural when the hook is an identity no-op. Require the sentinel log entry or another hook-caused effect before calling it behavioral.

Codex disables hook execution on Windows. Manifests still parse, so a structural check passes there while no hook ever runs — record Windows as `blocked` for behavioral claims.

## Prove causation

A patched run that merely succeeds does not establish that the patch caused it. A/B against the unpatched build at the same version, run both orders, and repeat. Confident single-run findings about host behavior are routinely wrong in both directions — that a thing works, and that it does not.

When a host rejects an artifact, read the host's own detection logic instead of inferring it from the error text.
