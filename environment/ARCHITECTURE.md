# Branch-Specific Environment Architecture

## Overview

This system uses **direnv** to automatically load branch-specific environment configurations that coordinate with shared external dev resources (databases, APIs, infrastructure, etc.).

## Key Principle: Shared Resources, Personal Secrets

The architecture separates two types of configuration:

### 1. Shared Team Configuration (Committed to Git)
**Files:** `environment/.env.branch.<branch-name>`

These files are **committed to the repository** and shared across the team. They contain:
- ✅ Shared dev resource hostnames (e.g., `dev-postgres.example.com`)
- ✅ Branch-specific infrastructure names (e.g., `myapp-main-stack`)
- ✅ API endpoints for the branch
- ✅ Feature flags
- ✅ Non-secret configuration that coordinates external resources

**Why committed?** So all team members on the same branch use the same shared dev resources.

### 2. Personal Overrides (Gitignored, Never Committed)
**Files:** `.env.local` or `environment/.env.branch.<branch-name>.env.local`

These files are **never committed** (gitignored). They contain:
- ❌ Passwords, API keys, tokens, secrets
- ❌ Machine-specific configuration (local ports, paths)
- ❌ Personal developer preferences

**Why gitignored?** Secrets should never be in git, and each developer may need different credentials.

## File Loading Priority

When you `cd` into the workspace, direnv loads environment variables in this order:

1. **Branch-specific shared config** (committed)
   ```
   environment/.env.branch.main
   ```

2. **Branch-specific personal overrides** (gitignored)
   ```
   environment/.env.branch.main.env.local
   ```

3. **Root personal overrides** (gitignored, applies to all branches)
   ```
   .env.local
   ```

Later files **override** earlier files, so personal secrets take precedence.

## Example: Main Branch Configuration

### Committed File: `environment/.env.branch.main`
```bash
# Shared by whole team - coordinates external resources
DATABASE_HOST=dev-postgres.example.com
DATABASE_NAME=myapp_main
DATABASE_PORT=5432

API_ENDPOINT=https://api-main.dev.example.com
REDIS_HOST=dev-redis.example.com

AWS_STACK_NAME=myapp-main-stack
K8S_NAMESPACE=myapp-main

ENVIRONMENT=main
DEBUG_MODE=true
LOG_LEVEL=debug
```

### Gitignored File: `environment/.env.branch.main.env.local`
```bash
# Personal secrets - never committed
DATABASE_PASSWORD=my_secret_password
DATABASE_USER=john.doe

API_KEY=sk-personal-api-key-here
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Personal preference: use local port instead
DATABASE_PORT=5433  # Overrides the shared 5432
```

### Result When Loaded
```bash
# Shared team config
DATABASE_HOST=dev-postgres.example.com  # From shared
DATABASE_NAME=myapp_main                # From shared

# Personal override
DATABASE_PASSWORD=my_secret_password    # From personal
DATABASE_USER=john.doe                  # From personal
DATABASE_PORT=5433                      # From personal (overrides 5432)

# All other shared config
API_ENDPOINT=https://api-main.dev.example.com
REDIS_HOST=dev-redis.example.com
AWS_STACK_NAME=myapp-main-stack
```

## Workflow Examples

### Creating a New Feature Branch

```bash
git checkout -b feature-new-auth
cd .  # Trigger direnv

# direnv: loading /workspace/.envrc
# direnv: ⚠ No environment file for branch 'feature-new-auth'
# direnv:   Copying from previous branch 'main'
# direnv:   Created environment/.env.branch.feature-new-auth
# direnv: ✓ Loading environment for branch 'feature-new-auth'
```

**What happened:**
1. direnv detected you switched to a new branch
2. Automatically copied `environment/.env.branch.main` → `environment/.env.branch.feature-new-auth`
3. The new branch inherits all shared team configuration from main

**Next steps:**
```bash
# Edit the shared config for this feature branch
vim environment/.env.branch.feature-new-auth

# Change branch-specific infrastructure
# DATABASE_NAME=myapp_feature_new_auth
# K8S_NAMESPACE=myapp-feature-new-auth

# Commit the shared configuration
git add environment/.env.branch.feature-new-auth
git commit -m "Add environment config for feature-new-auth branch"

# Push so team members can use the same resources
git push origin feature-new-auth
```

### Adding Personal Secrets

```bash
# Create personal override file (gitignored)
vim environment/.env.branch.feature-new-auth.env.local

# Add your secrets
# DATABASE_PASSWORD=my_password
# API_KEY=my_personal_key

# Reload direnv
cd .

# direnv: ✓ Loading branch-specific personal overrides
```

### Team Member Clones the Branch

```bash
# Another developer checks out your feature branch
git checkout feature-new-auth
cd .

# direnv: ✓ Loading environment for branch 'feature-new-auth'
# They get the shared configuration automatically!

# Shared config loaded: DATABASE_HOST, API_ENDPOINT, K8S_NAMESPACE, etc.
echo $DATABASE_HOST
# dev-postgres.example.com

# But they need to add their own secrets
vim environment/.env.branch.feature-new-auth.env.local
# DATABASE_PASSWORD=their_password
# API_KEY=their_personal_key
```

## Security Best Practices

### ✅ DO Commit (Shared Configuration)

```bash
# Hostnames and endpoints
DATABASE_HOST=dev-db.example.com
API_ENDPOINT=https://api.dev.example.com

# Non-secret resource identifiers
AWS_STACK_NAME=myapp-dev
S3_BUCKET_NAME=myapp-dev-assets
CLOUDFLARE_ZONE=dev.example.com

# Feature flags
ENABLE_NEW_FEATURE=true
DEBUG_MODE=true

# Database names (not passwords!)
DATABASE_NAME=myapp_dev
REDIS_DB=0
```

### ❌ DON'T Commit (Personal Secrets)

```bash
# Passwords and credentials - use .env.local
DATABASE_PASSWORD=secret123
DATABASE_USER=john.doe

# API keys and tokens - use .env.local
API_KEY=sk-...
AUTH_TOKEN=eyJ...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Personal preferences - use .env.local
LOCAL_PORT=8080
EDITOR=vim
```

### 🚨 If You Accidentally Commit Secrets

```bash
# 1. Remove from git immediately
git rm --cached environment/.env.branch.feature-name

# 2. Add to .env.local instead
mv environment/.env.branch.feature-name environment/.env.branch.feature-name.env.local

# 3. Recreate shared config without secrets
cp environment/.env.branch.template environment/.env.branch.feature-name
# Edit to add only non-secret shared config

# 4. Commit the fix
git add environment/.env.branch.feature-name
git commit -m "Remove secrets from environment config"

# 5. Rotate the exposed credentials!
# The secret is in git history - it must be rotated
```

## Migration from Old System

### What Changed

**Old System (Git Hooks):**
- ❌ Auto-committed environment files on every branch switch
- ❌ Committed symlink `.env.branch`
- ❌ Noisy git history with hook-generated commits
- ❌ Broke git workflows (rebase, bisect, worktrees)
- ❌ Security issues (unquoted variables, command injection)

**New System (direnv):**
- ✅ Environment files are committed **only when you explicitly commit them**
- ✅ No symlinks needed
- ✅ Clean git history (no automatic commits)
- ✅ Works with all git workflows
- ✅ Secure implementation
- ✅ Separates shared config (committed) from secrets (gitignored)

### What Stayed the Same

- ✅ Automatic environment loading when switching branches
- ✅ Auto-copy from previous branch when creating new branches
- ✅ Shared team configuration coordinating external resources
- ✅ Files are in the repository for team collaboration

## Comparison: Old vs New

| Aspect | Old (Git Hooks) | New (direnv) |
|--------|-----------------|--------------|
| **Shared config committed** | ✅ Yes | ✅ Yes |
| **Auto-load on branch switch** | ✅ Yes | ✅ Yes |
| **Auto-copy to new branches** | ✅ Yes | ✅ Yes |
| **Secrets separation** | ❌ No clear pattern | ✅ .env.local files |
| **Auto-commits** | ❌ Yes (noise) | ✅ No |
| **Manual commit control** | ❌ No | ✅ Yes |
| **Git workflows** | ❌ Breaks rebase/bisect | ✅ Works perfectly |
| **Security** | ❌ Command injection | ✅ Secure |
| **Cross-platform** | ❌ Symlink issues | ✅ Works everywhere |

## File Organization

```
/workspace/
  .envrc                                    # direnv config (committed)
  .env.local                                # Personal secrets, all branches (gitignored)

  environment/
    .env.branch.template                    # Template (committed)
    .env.branch.main                        # Main branch config (COMMITTED)
    .env.branch.main.env.local              # Main branch secrets (gitignored)
    .env.branch.feature-auth                # Feature branch config (COMMITTED)
    .env.branch.feature-auth.env.local      # Feature branch secrets (gitignored)
    README.md                               # User guide (committed)
    ARCHITECTURE.md                         # This file (committed)
```

## When to Create Branch-Specific Config

Create a committed branch config file when:
- ✅ The branch uses different external infrastructure (different DB, API, k8s namespace)
- ✅ The branch has different feature flags or configuration
- ✅ The team needs to coordinate on shared resources for this branch

Don't create a separate config when:
- ❌ It's a short-lived branch with identical infrastructure to parent
- ❌ Only personal dev preferences differ (use .env.local)
- ❌ The branch will be deleted soon after merge

## Advantages Over Old System

1. **Explicit Control**: You decide when to commit environment changes
2. **Clean History**: No automatic commits cluttering `git log`
3. **Better Security**: Clear separation between shared config and secrets
4. **Git Workflows**: Works with rebase, bisect, cherry-pick, worktrees
5. **Cross-Platform**: No symlink issues on Windows
6. **Team Coordination**: Shared configs ensure everyone uses the same resources
7. **Personal Privacy**: Secrets stay local, never in git history

## Questions?

- See `environment/README.md` for usage guide
- See `MIGRATION-TO-DIRENV.md` for migration details
- See direnv documentation: https://direnv.net/
