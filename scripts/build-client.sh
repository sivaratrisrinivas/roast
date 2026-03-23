#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
exec "$(dirname "$0")/bun.sh" build ./index.html --outdir dist --target=browser "$@"
