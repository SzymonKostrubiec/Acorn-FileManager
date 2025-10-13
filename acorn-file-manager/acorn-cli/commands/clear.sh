#!/bin/bash
# ========================================
# Acorn CLI - Clear Command
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

cmd_clear() {
    local PROJECT_ROOT="$1"
    [ -z "$PROJECT_ROOT" ] && PROJECT_ROOT="$PWD"

    local CACHE_DIR="$PROJECT_ROOT/var/cache"

    if [ -d "$CACHE_DIR" ]; then
        rm -rf "$CACHE_DIR"/*
        echo "✅ Cache cleared at $CACHE_DIR."
    else
        echo "⚠️ No cache to clear at $CACHE_DIR."
    fi
}
