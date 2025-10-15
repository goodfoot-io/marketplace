#!/bin/bash

# TypeScript Server Cleanup Script
# Prevents memory exhaustion from orphaned tsserver processes

echo "=== TypeScript Server Cleanup ==="
echo "Current time: $(date)"

# Count processes before cleanup
BEFORE_COUNT=$(ps aux | grep -E "tsserver|typescript-language-server" | grep -v grep | wc -l)
echo "Processes before cleanup: $BEFORE_COUNT"

# Kill orphaned TypeScript processes (parent PID = 1)
echo "Cleaning orphaned processes..."
ps aux | grep -E "typescript-language-server|tsserver" | grep -v grep | awk '{print $2}' | while read pid; do
    ppid=$(ps -o ppid= -p $pid 2>/dev/null | tr -d ' ')
    if [ -z "$ppid" ] || [ "$ppid" = "1" ]; then
        kill -9 $pid 2>/dev/null && echo "  Killed orphaned PID: $pid"
    fi
done

# Kill defunct/zombie processes
echo "Cleaning defunct processes..."
ps aux | grep -E "\[.*defunct\]" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null

# Kill idle CCLSP processes (without children)
echo "Cleaning idle CCLSP processes..."
ps aux | grep cclsp | grep -v grep | awk '{print $2}' | while read pid; do
    if ! pgrep -P $pid > /dev/null 2>&1; then
        kill -9 $pid 2>/dev/null && echo "  Killed idle CCLSP PID: $pid"
    fi
done

# Kill excessive TypeScript servers (keep only 10 newest)
echo "Limiting TypeScript servers to 10 instances..."
ps aux --sort=-start_time | grep -E "tsserver|typescript-language-server" | grep -v grep | awk 'NR>10 {print $2}' | xargs -r kill -9 2>/dev/null

# Count processes after cleanup
AFTER_COUNT=$(ps aux | grep -E "tsserver|typescript-language-server" | grep -v grep | wc -l)
echo "Processes after cleanup: $AFTER_COUNT"
echo "Cleaned up: $((BEFORE_COUNT - AFTER_COUNT)) processes"

# Show memory status
echo ""
echo "Memory status:"
free -h | grep Mem

echo "=== Cleanup completed ==="