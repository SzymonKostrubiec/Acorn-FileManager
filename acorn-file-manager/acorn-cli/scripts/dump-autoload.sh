#!/bin/bash
# ========================================
# Acorn Framework - Dump Autoload
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

set -e
set -u
set -o pipefail

PROJECT_ROOT="${1:-$PWD}"
ACORN_JSON="$PROJECT_ROOT/acorn.json"
LOCK_FILE="$PROJECT_ROOT/acorn.lock"

if [ ! -f "$ACORN_JSON" ]; then
    echo "❌ acorn.json not found at $ACORN_JSON"
    exit 1
fi

AUTOLOAD_OUTPUT=$(jq -r '.config.autoload_output_file' "$ACORN_JSON")
AUTOLOAD_OUTPUT="$PROJECT_ROOT/$AUTOLOAD_OUTPUT"

FILES=()
shopt -s globstar nullglob

mapfile -t PACKAGES < <(jq -c '.packages[]?' "$ACORN_JSON")

for pkg in "${PACKAGES[@]}"; do
    NAME=$(echo "$pkg" | jq -r '.name')
    PATH_REL=$(echo "$pkg" | jq -r '.autoload.repos[0].path // empty')
    PKG_JSON="$PROJECT_ROOT/$PATH_REL/acorn.json"

    if [ ! -f "$PKG_JSON" ]; then
        echo "⚠️ acorn.json not found for package $NAME at $PKG_JSON"
        continue
    fi

    mapfile -t PATTERNS < <(jq -r '.autoload.files[]?' "$PKG_JSON")
    for pattern in "${PATTERNS[@]}"; do
        for f in "$PROJECT_ROOT/$PATH_REL"/$pattern; do
            [ -f "$f" ] && FILES+=("${f#$PROJECT_ROOT/}")
        done
    done
done

shopt -u globstar nullglob

mkdir -p "$(dirname "$AUTOLOAD_OUTPUT")"
{
    echo "/* ============================================= */"
    echo "/* Acorn Framework - Autoload File */"
    echo "/* Author: Szymon Kostrubiec (c) 2025 */"
    echo "/* License: MIT */"
    echo "/* ============================================= */"
    echo "return ["
    for f in "${FILES[@]}"; do
        echo "  \"$f\","
    done
    echo "]"
} > "$AUTOLOAD_OUTPUT"

echo "✅ Autoload generated at $AUTOLOAD_OUTPUT"

jq -n --argjson files "$(printf '%s\n' "${FILES[@]}" | jq -R . | jq -s .)" \
    '{autoload: $files}' > "$LOCK_FILE"

echo "ℹ️ Lock file created at $LOCK_FILE"
