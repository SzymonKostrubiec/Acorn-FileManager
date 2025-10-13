#!/bin/bash
# ========================================
# Acorn CLI - Help Command
# Author: Szymon Kostrubiec (c) 2025
# License: MIT
# ========================================

cmd_help() {
    echo "
Acorn CLI (Squirrel Framework)

Commands:
  install         - setup project, create var/cache, storage, logs
  clear           - remove cache files
  dump-autoload   - regenerate autoload.nut and lock file
  doctor          - show environment info
  help            - show this help
"
}
