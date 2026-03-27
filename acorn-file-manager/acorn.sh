#!/bin/bash
# ========================================
# Acorn CLI - Main Loader
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

find_project_root() {
    local dir="$PWD"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/acorn-cli/scripts" ]; then
            echo "$dir"
            return 0
        fi
        dir=$(dirname "$dir")
    done
    return 1
}

load_command() {
    local cmd="$1"
    local PROJECT_ROOT="$2"
    local CMD_FILE="$PROJECT_ROOT/acorn-cli/commands/$cmd.sh"

    if [ -f "$CMD_FILE" ]; then
        source "$CMD_FILE"
    else
        echo "❌ Unknown command: $cmd"
        echo ">>> Use acorn help"
        return 1
    fi
}

acorn() {
    local PROJECT_ROOT
    PROJECT_ROOT=$(find_project_root)

    if [ -z "$PROJECT_ROOT" ]; then
        echo "❌ Could not find project root"
        return 1
    fi

    if [ $# -eq 0 ]; then
        load_command "help" "$PROJECT_ROOT"
        return
    fi

    local CMD="$1"
    shift

    load_command "$CMD" "$PROJECT_ROOT"

    if declare -f "cmd_$CMD" > /dev/null; then
        "cmd_$CMD" "$PROJECT_ROOT" "$@"
    else
        echo "❌ Command function not found: cmd_$CMD"
    fi
}
