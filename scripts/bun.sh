#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${BUN_BIN:-}" ]]; then
  bun_bin="${BUN_BIN}"
elif command -v bun >/dev/null 2>&1; then
  bun_bin="$(command -v bun)"
elif [[ -x "${HOME}/.bun/bin/bun" ]]; then
  bun_bin="${HOME}/.bun/bin/bun"
else
  echo "Bun was not found. Set BUN_BIN or install Bun in ~/.bun/bin/bun." >&2
  exit 1
fi

exec "${bun_bin}" "$@"
