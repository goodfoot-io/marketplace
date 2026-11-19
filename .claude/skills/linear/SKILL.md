---
name: linear
description: You must use this skill when reading or managing Linear issues, including bug reports.
---

# Linear: the linctl CLI

Read and manage Linear issues, comments, and projects with `linctl` (on PATH,
auth preconfigured — never look for or supply an API key). In the devcontainer
the key is `LINCTL_API_KEY` from the gitignored `.devcontainer/.env`; the
milesrowan container instead gets it brokered by OneCLI. The workspace has one
team: `GOO` (Goodfoot Dev).

## Conventions

- Gate every session on `linctl whoami -j` → `"authenticated": true`. On
  `not authenticated` or connection errors, stop and report; do not retry
  with substitute credentials.
- Always pass `-j/--json` and parse with `jq`. (`-p/--plaintext` exists for
  human-readable output.)
- Empty results often arrive as info JSON (`{"info": "No issues found"}`),
  not an empty array — check the shape before indexing.
- `linctl <command> --help` gives per-command flags; `linctl docs` prints the
  full built-in documentation.

## Issues

    # List / search (search REQUIRES a query argument)
    linctl issue list --team GOO -j
    linctl issue list --assignee me --state "In Progress" -j
    linctl issue list --include-completed -j
    linctl issue search "login bug" --team GOO -j

    # Read
    linctl issue get GOO-24 -j

    # Create / update
    linctl issue create --team GOO --title "..." --labels "Bug,Agent Environment" --priority 3 -j
    linctl issue update GOO-24 --title "New title" --assignee me -s "In Progress" -j
    linctl issue assign GOO-24 -j        # assign to yourself

    # Attachments & relations
    linctl issue attach GOO-24 --pr <github-pr-url>
    linctl issue attach GOO-24 --url <link> --title "<what it is>"
    linctl issue attachment list GOO-24 -j
    linctl issue relation add GOO-24 --blocked-by/--blocks/--related/--duplicate GOO-M

- **Priority scale**: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low. 1 pushes a
  notification to the assignee — reserve it for genuine urgency.
- **Multi-line description**: pass `-d "$(cat <<'DESC' ... DESC)"`.
- **State names** are exact strings ("In Progress", "Done"); GOO's states are
  Backlog → Todo → In Progress → Done / Canceled / Duplicate.
- **Delete**: no subcommand; use GraphQL `issueDelete` with the issue UUID
  (`linctl issue get GOO-N -j | jq -r .id`). Destroys history — test issues
  and noise only.

## Comments

    linctl comment list GOO-24 -j
    linctl comment create GOO-24 --body "..." -j
    linctl comment get <commentId> -j
    linctl comment update <commentId> --body "..." -j
    linctl comment delete <commentId>

## Projects, teams, users, labels

    linctl project list --team GOO -j
    linctl project get <projectId> -j
    linctl team list -j
    linctl team members GOO -j
    linctl user me -j
    linctl label list --team GOO -j      # --team is REQUIRED here

## Raw GraphQL

Pass the query on stdin (heredoc) or via `--file`:

    linctl graphql <<EOF
    query { viewer { id } }
    EOF

The positional form (`linctl graphql '<query>'`) errors with
`provide only one query source` whenever stdin is an open pipe — which it is
in agent bash tools and SSH pipelines.

## Agent sessions

    linctl agent GOO-24 -j    # view the agent delegation/session for an issue
