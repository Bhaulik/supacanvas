#!/usr/bin/env bash
# Supacanvas — one-liner installer
# Usage: curl -fsSL https://raw.githubusercontent.com/bhaulik/supacanvas/main/install.sh | bash
#
# What it does:
#   1. Installs Bun if not already present
#   2. Installs supacanvas globally from github:bhaulik/supacanvas
#   3. Prints next steps (supacanvas setup → wire into your AI client)

set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
dim()  { printf "\033[2m%s\033[0m\n" "$*"; }
ok()   { printf "\033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[33m⚠\033[0m %s\n" "$*"; }

bold "════════════════════════════════════════════"
bold "  Supacanvas — local-first MCP for AI views"
bold "════════════════════════════════════════════"
echo

# ----- 1. Bun -----
if ! command -v bun >/dev/null 2>&1; then
  echo "→ Bun not found. Installing…"
  curl -fsSL https://bun.sh/install | bash
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

# ----- 2. Supacanvas -----
echo "→ Installing supacanvas from github:bhaulik/supacanvas…"
bun install -g github:bhaulik/supacanvas

# ----- 3. Verify + next steps -----
echo
if command -v supacanvas >/dev/null 2>&1; then
  ok "supacanvas is installed at $(command -v supacanvas)"
  if command -v supa >/dev/null 2>&1; then
    ok "short alias 'supa' is also available"
  fi
else
  warn "supacanvas isn't on your PATH yet — Bun installs globals to ~/.bun/bin/."
  echo "  Add this to your shell profile:"
  echo '    export PATH="$HOME/.bun/bin:$PATH"'
  echo "  Then run: supacanvas setup"
  exit 0
fi

echo
bold "Next:"
echo "  supacanvas setup    # show MCP config + detect installed AI clients"
echo "  supacanvas serve    # start the viewer at http://localhost:7777"
echo
dim "  Then ask your AI: \"create a canvas with a working analog clock\""
