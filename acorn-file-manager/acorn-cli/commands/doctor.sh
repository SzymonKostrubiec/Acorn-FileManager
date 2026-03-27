#!/bin/bash
# ========================================
# Acorn CLI - Doctor Command
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

cmd_doctor() {
    local PROJECT_ROOT="$1"
    [ -z "$PROJECT_ROOT" ] && PROJECT_ROOT="$PWD"

    echo "ℹ️ Bash version: $(bash --version | head -n1)"
    echo "ℹ️ Project root: $PROJECT_ROOT"
    echo "ℹ️ Cache directory: $PROJECT_ROOT/var/cache"
    echo "ℹ️ Storage directory: $PROJECT_ROOT/var/storage"
    echo "ℹ️ Logs directory: $PROJECT_ROOT/var/logs"

    if [ -f "$PROJECT_ROOT/acorn.json" ]; then
        echo "ℹ️ acorn.json: found"
    else
        echo "⚠️ acorn.json: not found"
    fi
}
