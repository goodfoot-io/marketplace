# Branch-Specific Environment Configuration

This directory contains branch-specific environment configuration files that coordinate shared external dev resources (databases, APIs, infrastructure) across your team.

## Migration from Git Hooks

**NOTE:** This project previously used git hooks to manage per-branch environment files. That system has been replaced with `direnv` for better reliability, cross-platform compatibility, and git workflow support.

The old git hooks have been disabled (`.githooks/post-checkout.disabled` and `.githooks/post-merge.disabled`).

## Key Concept: Shared Resources + Personal Secrets

This system separates two types of configuration:

### 1. Shared Team Configuration (Committed to Git)
**Files:** `environment/.env.branch.<branch-name>`

These files are **committed to git** and shared across your team. They contain:
- ✅ Shared dev resource endpoints (e.g., `dev-postgres.example.com`)
- ✅ Branch-specific infrastructure names (e.g., `myapp-main-stack`)
- ✅ Feature flags and non-secret configuration
- ✅ Coordinated external resource identifiers

**Why committed?** So everyone on the same branch uses the same shared dev resources.

### 2. Personal Overrides (Never Committed)
**Files:** `.env.local` and `environment/.env.branch.<branch-name>.env.local`

These files are **gitignored** and never committed. They contain:
- ❌ Passwords, API keys, tokens, secrets
- ❌ Machine-specific configuration (local ports, paths)
- ❌ Personal developer preferences

**Why gitignored?** Secrets should never be in git, and each developer needs different credentials.

## How It Works

The project uses [direnv](https://direnv.net/) to automatically load environment variables based on your current git branch when you `cd` into the project directory.

### File Loading Order

When you enter the workspace, direnv loads files in this priority order:

1. **Shared branch config** (committed): `environment/.env.branch.main`
2. **Branch-specific secrets** (gitignored): `environment/.env.branch.main.env.local`
3. **Global personal config** (gitignored): `.env.local`

Later files override earlier ones, so your personal secrets take precedence.

### Architecture

1. **`.envrc`** (in project root) - Detects current branch and loads the appropriate environment files
2. **`environment/.env.branch.<branch-name>`** (COMMITTED) - Shared team configuration for external resources
3. **`environment/.env.branch.<branch-name>.env.local`** (gitignored) - Personal secrets for this branch
4. **`.env.local`** (gitignored) - Personal overrides that apply to all branches
5. **`environment/.env.branch.template`** (committed) - Template for creating new branch configurations

## Setup Instructions

### 1. Install direnv

**macOS:**
```bash
brew install direnv
```

**Ubuntu/Debian:**
```bash
sudo apt install direnv
```

**Windows (WSL or Git Bash):**
```bash
# Use your WSL package manager
sudo apt install direnv  # WSL Ubuntu
```

**Other platforms:** See https://direnv.net/docs/installation.html

### 2. Enable direnv in your shell

Add this to your shell config file:

**For Bash** (`~/.bashrc`):
```bash
eval "$(direnv hook bash)"
```

**For Zsh** (`~/.zshrc`):
```bash
eval "$(direnv hook zsh)"
```

**For Fish** (`~/.config/fish/config.fish`):
```fish
direnv hook fish | source
```

Then reload your shell:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### 3. Allow the .envrc file

Navigate to the project and allow direnv to load the configuration:

```bash
cd /workspace
direnv allow
```

You'll see output like:
```
direnv: loading /workspace/.envrc
direnv: ✓ Loading environment for branch 'main'
```

### 4. Add your personal secrets

Create a personal override file for secrets (gitignored):

```bash
# Branch-specific secrets (recommended)
cat > environment/.env.branch.main.env.local << 'EOF'
DATABASE_PASSWORD=my_secret_password
DATABASE_USER=john.doe
API_KEY=sk-my-personal-key
EOF

# OR global secrets (applies to all branches)
cat > .env.local << 'EOF'
DATABASE_PASSWORD=my_secret_password
API_KEY=sk-my-personal-key
EOF
```

### 5. Verify it works

```bash
cd /workspace
# direnv: loading /workspace/.envrc
# direnv: ✓ Loading environment for branch 'main'
# direnv: ✓ Loading branch-specific personal overrides

echo $DATABASE_HOST
# (shared value from committed file)

echo $DATABASE_PASSWORD
# (your personal secret from .env.local)
```

## Daily Usage

### Switching Branches

direnv automatically reloads when you change directories, and **automatically copies environment settings from the previous branch**:

```bash
# On main branch with environment/.env.branch.main configured
git checkout -b feature-auth
cd .  # Or just cd to any subdirectory

# direnv: loading /workspace/.envrc
# direnv: ⚠ No environment file for branch 'feature-auth'
# direnv:   Copying from previous branch 'main'
# direnv:   Created environment/.env.branch.feature-auth
# direnv: ✓ Loading environment for branch 'feature-auth'

# Your environment is now ready to use!
# The new branch inherited all shared config from 'main'
```

**What got copied:** The shared team configuration (committed file)
**What didn't get copied:** Your personal secrets (they'll still load from `.env.local`)

### Customizing Branch Configuration

After creating a new branch, customize its shared configuration:

```bash
# Edit the shared config (will be committed)
vim environment/.env.branch.feature-auth

# Change branch-specific infrastructure
# DATABASE_NAME=myapp_feature_auth
# K8S_NAMESPACE=myapp-feature-auth
# API_ENDPOINT=https://api-feature-auth.dev.example.com

# Commit the shared configuration
git add environment/.env.branch.feature-auth
git commit -m "Add environment config for feature-auth branch"

# Push so team members can use the same resources
git push origin feature-auth
```

### Adding Personal Secrets

Your personal secrets don't need to be recreated for each branch - they're loaded globally:

```bash
# Option 1: Branch-specific secrets (if credentials differ per branch)
vim environment/.env.branch.feature-auth.env.local
# DATABASE_PASSWORD=my_password
# API_KEY=my_key_for_this_branch

# Option 2: Global secrets (same credentials for all branches)
vim .env.local
# DATABASE_PASSWORD=my_password
# API_KEY=my_personal_key
```

### Team Member Clones Your Branch

```bash
# Another developer checks out your feature branch
git checkout feature-auth
cd .

# direnv: ✓ Loading environment for branch 'feature-auth'
# They get the shared configuration automatically!

echo $DATABASE_HOST
# dev-postgres.example.com (from committed config)

echo $K8S_NAMESPACE
# myapp-feature-auth (from committed config)

# But they need to add their own secrets
vim .env.local
# DATABASE_PASSWORD=their_password
# API_KEY=their_personal_key
```

## File Organization

```
/workspace/
  .envrc                                        # direnv configuration (committed)
  .env.local                                    # Personal secrets, all branches (gitignored)

  environment/
    .env.branch.template                        # Template (committed)
    .env.branch.main                            # Main shared config (COMMITTED)
    .env.branch.main.env.local                  # Main secrets (gitignored)
    .env.branch.feature-auth                    # Feature shared config (COMMITTED)
    .env.branch.feature-auth.env.local          # Feature secrets (gitignored)
    README.md                                   # This file (committed)
    ARCHITECTURE.md                             # Design documentation (committed)
```

## What to Put in These Files

### ✅ DO Commit (Shared Configuration)

In `environment/.env.branch.<branch-name>`:

```bash
# Shared dev resource endpoints
DATABASE_HOST=dev-postgres.example.com
DATABASE_NAME=myapp_main
DATABASE_PORT=5432

API_ENDPOINT=https://api-main.dev.example.com
REDIS_HOST=dev-redis.example.com

# Branch-specific infrastructure
AWS_STACK_NAME=myapp-main-stack
K8S_NAMESPACE=myapp-main
CLOUDFLARE_ZONE=main.dev.example.com

# Feature flags
ENABLE_NEW_AUTH=false
DEBUG_MODE=true
LOG_LEVEL=debug

# Environment identifier
ENVIRONMENT=main
```

### ❌ DON'T Commit (Personal Secrets)

In `.env.local` or `environment/.env.branch.<branch-name>.env.local`:

```bash
# Passwords and credentials
DATABASE_PASSWORD=my_secret_password
DATABASE_USER=john.doe

# API keys and tokens
API_KEY=sk-...
AUTH_TOKEN=eyJ...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Personal preferences
LOCAL_DEV_PORT=8080
EDITOR=vim
```

### 🚨 If You Accidentally Commit Secrets

```bash
# 1. Remove from the committed file
vim environment/.env.branch.main
# Delete the secret lines

# 2. Move secrets to personal override
vim environment/.env.branch.main.env.local
# Add the secrets here

# 3. Commit the fix
git add environment/.env.branch.main
git commit -m "Remove secrets from shared environment config"

# 4. IMPORTANT: Rotate the exposed credentials!
# The secret is in git history - it must be rotated
```

## Troubleshooting

### direnv not loading

**Problem:** Variables aren't being set when you cd into the directory.

**Solution:**
1. Check direnv is installed: `direnv version`
2. Check hook is enabled: Add eval hook to shell config
3. Reload shell: `source ~/.zshrc` or open new terminal
4. Allow the .envrc: `direnv allow`

### "command not found: direnv" in container

**Problem:** Devcontainer doesn't have direnv installed.

**Solution:** The Dockerfile has been updated to install direnv. Rebuild the container:
```bash
# In VS Code: Cmd/Ctrl + Shift + P
# Run: "Dev Containers: Rebuild Container"
```

### .envrc blocked

**Problem:** `direnv: error /workspace/.envrc is blocked`

**Solution:** This is a security feature. Review the `.envrc` file and run:
```bash
direnv allow
```

### Variables not updating

**Problem:** Changed .env file but variables didn't update.

**Solution:** direnv caches based on file modification time. Force reload:
```bash
direnv reload
# or
cd . # Changing directory triggers reload
```

### Shared config not available on team member's machine

**Problem:** Team member doesn't see the shared configuration.

**Solution:** They need to pull the latest changes:
```bash
git pull origin feature-branch
cd .  # Reload direnv
```

The shared config file `environment/.env.branch.feature-branch` should now be present.

### Personal secrets not loaded

**Problem:** Personal secrets aren't being loaded.

**Solution:** Verify your `.env.local` file exists and has correct syntax:
```bash
# Check file exists
ls -la .env.local

# Check file contents (be careful, contains secrets!)
cat .env.local

# Reload direnv
cd .
```

## Advanced Usage

### Per-Branch Secrets

If you need different credentials for different branches:

```bash
# Main branch credentials
vim environment/.env.branch.main.env.local
DATABASE_PASSWORD=main_password
API_KEY=main_api_key

# Feature branch credentials
vim environment/.env.branch.feature-auth.env.local
DATABASE_PASSWORD=feature_password
API_KEY=feature_api_key
```

### Monorepo per-package environments

Create nested `.envrc` files in package directories:

```bash
# /workspace/packages/api/.envrc
source_up  # Load parent .envrc first
export PACKAGE_NAME="api"
dotenv_if_exists ".env.api.local"
```

### Dynamic configuration

Load from external services in `.envrc`:

```bash
# .envrc
if command -v aws &> /dev/null; then
    export DATABASE_URL=$(aws ssm get-parameter \
        --name "/dev/database-url" \
        --query Parameter.Value \
        --output text 2>/dev/null)
fi
```

## CI/CD Considerations

direnv **does not run in CI/CD environments** because they don't have interactive shells. This is intentional and correct.

For CI/CD, use native environment variable configuration:

**GitHub Actions:**
```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  ENVIRONMENT: ci
  # Load from committed config if needed
  DATABASE_HOST: dev-postgres.example.com
```

**GitLab CI:**
```yaml
variables:
  ENVIRONMENT: "ci"
  DATABASE_URL: $CI_DATABASE_URL
```

## Comparison: Old System vs New System

| Aspect | Git Hooks (Old) | direnv (New) |
|--------|-----------------|--------------|
| **Automatic loading** | On `git checkout` | On `cd` |
| **Shared config committed** | ✅ Yes | ✅ Yes |
| **Auto-copy to new branches** | ✅ Yes | ✅ Yes |
| **Secrets separation** | ❌ No | ✅ .env.local files |
| **Auto-commits** | ❌ Yes (noise) | ✅ No |
| **Manual control** | ❌ No | ✅ Yes |
| **Cross-platform** | ❌ Symlink issues | ✅ Works everywhere |
| **Git workflows** | ❌ Breaks rebase/bisect | ✅ No interference |
| **Security** | ❌ Command injection | ✅ Secure |
| **Merge conflicts** | ❌ Frequent | ✅ Rare |
| **Worktrees** | ❌ Broken | ✅ Supported |

## Questions?

For more information:
- Design documentation: See `environment/ARCHITECTURE.md`
- direnv documentation: https://direnv.net/
- direnv GitHub: https://github.com/direnv/direnv
- Common use cases: https://github.com/direnv/direnv/wiki

For project-specific questions, see the main project README or ask your team.
