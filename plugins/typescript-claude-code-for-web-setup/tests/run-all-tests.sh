#!/bin/bash

# Master test runner for typescript-claude-code-for-web-setup plugin

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================"
echo "Running All Tests for web-setup Plugin"
echo "========================================"
echo ""

# Run basic functionality tests
echo "1. Running basic functionality tests..."
"$SCRIPT_DIR/test-web-setup.sh"
echo ""

# Run security and validation tests
echo "2. Running security and validation tests..."
"$SCRIPT_DIR/test-web-setup-security.sh"
echo ""

echo "========================================"
echo "All Test Suites Passed!"
echo "========================================"

exit 0
