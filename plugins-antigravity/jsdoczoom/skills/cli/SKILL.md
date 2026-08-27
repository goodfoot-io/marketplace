---
name: cli
description: Run `npx jsdoczoom -h` for help
---

Run this command and report its output:

```bash
npx jsdoczoom -h 2>&1 | sed 's/\(npx \)\?jsdoczoom/npx jsdoczoom/g'
```
