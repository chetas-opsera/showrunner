#!/usr/bin/env bash
# Link this checkout into Cursor as a skill. Idempotent; never overwrites existing files or links.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
CURSOR="${CURSOR_HOME:-$HOME/.cursor}"
HOME_LINK="${SHOWRUNNER_HOME:-$HOME/.showrunner}"

command -v node >/dev/null || { echo "node 18+ is required"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' || { echo "node 18+ is required"; exit 1; }

[ -d "$SRC/node_modules" ] || (cd "$SRC" && npm install --no-audit --no-fund)

if [ -e "$HOME_LINK" ]; then echo "exists, left alone: $HOME_LINK"; else ln -s "$SRC" "$HOME_LINK"; echo "linked  $HOME_LINK -> $SRC"; fi
mkdir -p "$CURSOR/skills"
if [ -e "$CURSOR/skills/showrunner" ]; then echo "exists, left alone: $CURSOR/skills/showrunner"
else ln -s "$SRC/skill" "$CURSOR/skills/showrunner"; echo "linked  $CURSOR/skills/showrunner -> $SRC/skill"; fi

echo; echo "Next: node $HOME_LINK/bin/showrunner.mjs setup   (one time)"
echo "      node $HOME_LINK/bin/showrunner.mjs doctor"
