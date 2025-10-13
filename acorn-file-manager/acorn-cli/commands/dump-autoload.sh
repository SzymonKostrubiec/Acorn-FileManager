#!/bin/bash
# ========================================
# Acorn CLI - Dump Autoload Command
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

cmd_dump-autoload() {
    PROJECT_ROOT="${1:-$PWD}"
    SCRIPT="$PROJECT_ROOT/acorn-cli/scripts/dump-autoload.sh"

    if [ ! -f "$SCRIPT" ]; then
        echo -e "${COLOR_RED}${ICON_ERROR} autoload.sh not found at $SCRIPT${COLOR_RESET}"
        return 1
    fi

    echo -e "${COLOR_CYAN}${ICON_INFO} Running autoload.sh...${COLOR_RESET}"

    (cd "$(dirname "$SCRIPT")" && bash "$(basename "$SCRIPT")" "$PROJECT_ROOT")
    
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}${ICON_OK} Autoload generated successfully.${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}${ICON_ERROR} Autoload generation failed.${COLOR_RESET}"
        return 1
    fi
}
