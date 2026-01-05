#  Release with Skill

**TL;DR:** [`@goodfoot/claude-code-hooks`](https://www.npmjs.com/package/@goodfoot/claude-code-hooks) is a TypeScript build system for Claude Code hooks. The [`claude-code-hooks:sdk` skill](https://github.com/goodfoot-io/marketplace/blob/main/plugins/claude-code-hooks/skills/sdk/SKILL.md) teaches Claude how to use it. Libraries ship with trained experts now.

---

A library is lyrics without the tune. Here's the README. Here's an example. Now figure out how it's supposed to sound.

The [`goodfoot-io/marketplace`](https://github.com/goodfoot-io/marketplace) ships the []`claude-code-hooks:sdk`](https://github.com/goodfoot-io/marketplace/blob/main/plugins/claude-code-hooks/skills/sdk/SKILL.md) tune. Install the plugin and Claude becomes a colleague who's already made every mistake, who knows which error message means what, who can look at a codebase and immediately spot what's missing.

We're not just shipping software anymore. We're boxing up customer service and shipping that too.

Think about what happens when a developer adopts a new library. They skim the README. They copy an example. They hit an error, Google it, find a GitHub issue from 2019 marked "stale" by a bot. They try something. It doesn't work. They try something else. Eventually, through persistence or luck, they get it running. This is how expertise has been transmitted since the first programmer told the second programmer to just read the man pages.

A skill absorbs all of this. Packaged into a file. Deployed to every user at once.

The `claude-code-hooks:sdk` skill exists because writing hooks by hand produces the same problems every time. Exit codes one integer apart meaning completely different things. Stdout being both essential and forbidden. The most common debugging technique in JavaScript (that would be `console.log`) being the one thing guaranteed to corrupt the JSON protocol. The `export default` that the CLI requires, the compiler ignores, and the error message won't mention.

The skill encodes what most of us would learn after the third frustrated GitHub issue: which hook types can allow versus deny versus block (three different things), why rebuilding after every edit matters, why the logger exists and `console.log` doesn't.

So here's what happens. A developer installs the plugin:

```bash
claude plugin marketplace add goodfoot-io/marketplace && claude plugin install claude-code-hooks@goodfoot
```

And then types a single sentence:

```bash
claude "Load the 'claude-code-hooks:sdk' skill then scaffold a new hook package in ./packages/hooks that outputs to '.claude/hooks/hooks.json' and which ports the existing hooks from ./.claude/hooks"
```

Claude loads the skill. It reads the existing bash scripts (the ones with lovingly handcrafted `>&2` redirections and `jq` incantations) and converts them to TypeScript. Beautiful TypeScript. The kind with type guards and discriminated unions, the kind that briefly makes developers feel like they know what they're doing. Claude knows which hook types can block versus deny. It knows to use `logger.info` instead of `console.log`. It knows `export default` is mandatory. It knows all of this because the skill told it, and Claude is an excellent student. It builds. It verifies. It does not guess.

The developer typed one sentence. The library came with an expert included.

This shipped the song.