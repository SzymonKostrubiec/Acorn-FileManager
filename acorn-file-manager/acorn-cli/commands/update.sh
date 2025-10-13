#!/bin/bash
# ========================================
# Acorn CLI - Update Command
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

cmd_update() {
    local PROJECT_ROOT="$1"
    [ -z "$PROJECT_ROOT" ] && PROJECT_ROOT="$PWD"

    local ACORN_JSON="$PROJECT_ROOT/acorn.json"
    local LOCK_FILE="$PROJECT_ROOT/acorn.lock"

    if [ ! -f "$ACORN_JSON" ]; then
        echo "❌ acorn.json not found at $PROJECT_ROOT"
        return 1
    fi

    local PACKAGES
    mapfile -t PACKAGES < <(jq -c '.packages[]?' "$ACORN_JSON")

    if [ ${#PACKAGES[@]} -eq 0 ]; then
        echo "ℹ️ No packages found to update."
        return
    fi

    for pkg in "${PACKAGES[@]}"; do
        local NAME
        NAME=$(echo "$pkg" | jq -r '.name')
        local REPOS
        mapfile -t REPOS < <(echo "$pkg" | jq -c '.autoload.repos[]?')

        if [ ${#REPOS[@]} -eq 0 ]; then
            echo "ℹ️ Package $NAME has no repos to update."
            continue
        fi

        for repo in "${REPOS[@]}"; do
            local URL BRANCH PATH_REL TARGET
            URL=$(echo "$repo" | jq -r '.url')
            BRANCH=$(echo "$repo" | jq -r '.branch')
            PATH_REL=$(echo "$repo" | jq -r '.path')
            TARGET="$PROJECT_ROOT/$PATH_REL"

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

    "$PROJECT_ROOT/acorn-cli/scripts/dump-autoload.sh" "$PROJECT_ROOT"

    echo "✅ Update complete. Autoload regenerated."
}
