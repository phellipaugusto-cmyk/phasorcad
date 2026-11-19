#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale em https://nodejs.org e tente de novo."
  exit 1
fi
node scripts/serve.mjs --open
