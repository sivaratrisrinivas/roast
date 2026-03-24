#!/usr/bin/env bash
set -euo pipefail

outdir="${ROAST_CLIENT_OUTDIR:-dist}"

rm -rf "${outdir}"
exec "$(dirname "$0")/bun.sh" build ./index.html --outdir "${outdir}" --target=browser "$@"
