#!/usr/bin/env node
// Identity no-op: goodfoot has no PostToolUse behavior today. This hook
// exists so the tri-platform hooks pattern has a real, non-dangling
// referent on every platform rather than an inert template.
process.exit(0);
