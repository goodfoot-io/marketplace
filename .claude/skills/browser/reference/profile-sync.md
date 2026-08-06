---
title: Profile sync
summary: The persistent local Chrome profile that keeps sessions logged in across tasks.
---

# Profile sync

`bin/start-chrome.sh` launches Chrome with `--user-data-dir=$HOME/.cache/browser-use-skill/profile` — a persistent profile, not a tempdir. Cookies, localStorage, and IndexedDB all survive across `start-chrome.sh`/`stop-chrome.sh` cycles, so signing in once keeps later sessions in this container logged in. This is local to this container instance only — it doesn't sync anywhere.

## Resetting it

To log out of everything:

```bash
bash /workspace/.claude/skills/browser/bin/stop-chrome.sh
rm -rf "$HOME/.cache/browser-use-skill/profile"
bash /workspace/.claude/skills/browser/bin/start-chrome.sh
```
