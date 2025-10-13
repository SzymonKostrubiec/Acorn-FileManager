#!/bin/bash
# ========================================
# Acorn CLI - Install Command
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

cmd_install() {
    local PROJECT_ROOT="$1"
    [ -z "$PROJECT_ROOT" ] && PROJECT_ROOT="$PWD"

    local ACORN_JSON="$PROJECT_ROOT/acorn.json"
    local LOCK_FILE="$PROJECT_ROOT/acorn.lock"

    if [ ! -f "$ACORN_JSON" ]; then
        echo "❌ acorn.json not found in $PROJECT_ROOT"
        return 1
    fi

    local CACHE_DIR=$(jq -r '.config.cache_dir // empty' "$ACORN_JSON")
    local STORAGE_DIR=$(jq -r '.config.storage_dir // empty' "$ACORN_JSON")
    local LOGS_DIR=$(jq -r '.config.logs_dir // empty' "$ACORN_JSON")
    local AUTOLOAD_FILE=$(jq -r '.config.autoload_output_file // empty' "$ACORN_JSON")

    if [ -z "$CACHE_DIR" ] || [ -z "$STORAGE_DIR" ] || [ -z "$LOGS_DIR" ] || [ -z "$AUTOLOAD_FILE" ]; then
        echo "❌ Missing required config keys in acorn.json: cache_dir, storage_dir, logs_dir, autoload_output_file"
        return 1
    fi

    for dir in "$CACHE_DIR" "$STORAGE_DIR" "$LOGS_DIR"; do
        mkdir -p "$PROJECT_ROOT/$dir"
        chmod 775 "$PROJECT_ROOT/$dir"
        touch "$PROJECT_ROOT/$dir/.placeholder" 2>/dev/null || true
        echo "✅ Directory ready: $PROJECT_ROOT/$dir"
    done

    if [ ! -f "$LOCK_FILE" ]; then
        mapfile -t PACKAGES < <(jq -c '.packages[]?' "$ACORN_JSON")
        for pkg in "${PACKAGES[@]}"; do
            mapfile -t REPOS < <(echo "$pkg" | jq -c '.autoload.repos[]?')
            for repo in "${REPOS[@]}"; do
                local URL=$(echo "$repo" | jq -r '.url')
                local BRANCH=$(echo "$repo" | jq -r '.branch')
                local PATH_REL=$(echo "$repo" | jq -r '.path')
                local TARGET="$PROJECT_ROOT/$PATH_REL"

                if [ -d "$TARGET/.git" ]; then
                    echo "♻️ Updating repo $URL at $TARGET"
                    git -C "$TARGET" fetch origin "$BRANCH"
                    git -C "$TARGET" reset --hard "origin/$BRANCH"
                else
                    echo "⬇️ Cloning repo $URL to $TARGET"
                    git clone --branch "$BRANCH" "$URL" "$TARGET"
                fi
            done
        done
    else
        echo "ℹ️ Lock file exists, skipping repo fetch"
    fi

    "$PROJECT_ROOT/acorn-cli/scripts/dump-autoload.sh" "$PROJECT_ROOT"

    echo "✅ Project installed successfully."
}
