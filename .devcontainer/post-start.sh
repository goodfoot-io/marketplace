#!/bin/bash

set -e

# Allow direnv to load .envrc
# This runs on every container start to ensure .envrc is always approved
echo "Approving direnv configuration..."
cd /workspace && direnv allow
echo "✓ direnv configuration approved"
