# Agent skills manual behavioral smoke

Run these checks after the deterministic build and local install validations. They intentionally remain manual because they invoke authenticated agents.

1. Record `claude --version`, `codex --version`, and `opencode --version` in the release evidence.
2. Create isolated temporary home, config, and cache directories; install the local plugin/package and arrange a generated fixture skill whose body contains a unique random sentinel.
3. Invoke `claude -p`, `codex exec`, and `opencode run` with the exact prompt: `Load the generated fixture skill and print its sentinel verbatim. Print nothing else.`
4. Capture stdout and stderr separately and require the exact sentinel in stdout. Classify failures as CLI unavailable, unauthenticated, or skill-resolution failure.
5. Trap cleanup so the local plugin installation, marketplace registration, temporary homes, and caches are removed even when a command fails.

Antigravity is validation-only until an authoritative non-interactive CLI and conventions are available; do not infer a behavioral smoke from another host.
