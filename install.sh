#!/usr/bin/env bash
# Plate — one-liner installer
# Usage: curl -fsSL https://raw.githubusercontent.com/bhaulik/plate/main/install.sh | bash
#
# What it does:
#   1. Installs Bun if not already present
#   2. Installs plate globally from github:bhaulik/plate
#   3. Prints next steps (plate setup → wire into your AI client)

set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
dim()  { printf "\033[2m%s\033[0m\n" "$*"; }
ok()   { printf "\033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[33m⚠\033[0m %s\n" "$*"; }

bold "════════════════════════════════════════"
bold "  Plate — local-first MCP for AI views"
bold "════════════════════════════════════════"
echo

# ----- 1. Bun -----
if ! command -v bun >/dev/null 2>&1; then
  echo "→ Bun not found. Installing…"
  curl -fsSL https://bun.sh/install | bash
  # Bun installs to ~/.bun/bin by default. Make it usable for the rest of this script.
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

if ! command -v bun >/dev/null 2>&1; then
  warn "Bun installed but not yet on PATH for this shell."
  echo "  Add this to your ~/.zshrc or ~/.bashrc, then re-run:"
  echo '    export PATH="$HOME/.bun/bin:$PATH"'
  exit 1
fi
ok "Bun $(bun --version)"

# ----- 2. Plate -----
echo "→ Installing plate from github:bhaulik/plate…"
bun install -g github:bhaulik/plate

# ----- 3. Verify + next steps -----
echo
if command -v plate >/dev/null 2>&1; then
  ok "plate is installed at $(command -v plate)"
else
  warn "plate isn't on your PATH yet — Bun installs globals to ~/.bun/bin/."
  echo "  Add this to your shell profile:"
  echo '    export PATH="$HOME/.bun/bin:$PATH"'
  echo "  Then run: plate setup"
  exit 0
fi

echo
bold "Next:"
echo "  plate setup    # show MCP config + detect installed AI clients"
echo "  plate serve    # start the viewer at http://localhost:7777"
echo
dim "  Then ask your AI: \"create a plate with a working analog clock\""
