# GitHub Plugin

A Claude Code plugin for GitHub operations using the Octokit SDK.

## Features

- **Issues**: Create, read, update, comment on, and manage issue labels
- **Pull Requests**: Create, review, merge, and get diffs
- **Files**: Read, create, update, and delete repository files
- **Git**: Create branches, list commits, work with refs
- **Search**: Search code, issues, repositories, and users
- **Actions**: List workflows, view runs, get job logs, trigger workflows

## Prerequisites

- `GITHUB_TOKEN` environment variable set with a valid Personal Access Token
- `tsx` installed globally (`yarn global add tsx`)
- `octokit` package installed (`yarn add octokit`)

## Quick Start

```typescript
import { Octokit } from "octokit";
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const { data: user } = await octokit.rest.users.getAuthenticated();
console.log("Logged in as:", user.login);
```

## Documentation Structure

- `skills/github/SKILL.md` - Main router and quick reference
- `skills/github/sdk/` - Detailed SDK documentation per topic
- `skills/github/advanced/` - Token setup and GraphQL patterns
- `skills/github/tests/` - SDK verification scripts

## Token Setup

See `skills/github/advanced/token-setup.md` for complete instructions on creating and configuring a GitHub Personal Access Token.
