#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vercel-ignore-test.XXXXXX")"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

ORIGIN="$TMP_DIR/origin.git"
SEED="$TMP_DIR/seed"
CLONE_SKIP="$TMP_DIR/clone-skip"
CLONE_BUILD="$TMP_DIR/clone-build"

git init --bare "$ORIGIN" >/dev/null
git clone "file://$ORIGIN" "$SEED" >/dev/null 2>&1

cd "$SEED"
git config user.name "Codex Test"
git config user.email "codex@example.com"

mkdir -p src
printf 'console.log("v1")\n' > src/app.js
printf '# test repo\n' > README.md
git add src/app.js README.md
git commit -m "initial watched commit" >/dev/null
git push origin HEAD >/dev/null 2>&1
BASE_SHA="$(git rev-parse HEAD)"

printf '\nnoop change\n' >> README.md
git add README.md
git commit -m "unrelated change" >/dev/null
git push origin HEAD >/dev/null 2>&1
UNRELATED_HEAD_SHA="$(git rev-parse HEAD)"

git clone --depth=1 "file://$ORIGIN" "$CLONE_SKIP" >/dev/null 2>&1
cd "$CLONE_SKIP"
IGNORE_COMMAND="$(node -e "const fs=require('fs');process.stdout.write(JSON.parse(fs.readFileSync('$ROOT_DIR/vercel.json','utf8')).ignoreCommand)")"
if VERCEL_GIT_PREVIOUS_SHA="$BASE_SHA" sh -c "$IGNORE_COMMAND"; then
  printf 'PASS skip-build when only unrelated files changed\n'
else
  printf 'FAIL skip-build scenario should have exited 0\n' >&2
  exit 1
fi

cd "$SEED"
printf 'console.log("v2")\n' > src/app.js
git add src/app.js
git commit -m "watched change" >/dev/null
git push origin HEAD >/dev/null 2>&1

git clone --depth=1 "file://$ORIGIN" "$CLONE_BUILD" >/dev/null 2>&1
cd "$CLONE_BUILD"
if VERCEL_GIT_PREVIOUS_SHA="$UNRELATED_HEAD_SHA" sh -c "$IGNORE_COMMAND"; then
  printf 'FAIL build scenario should have exited 1\n' >&2
  exit 1
fi

printf 'PASS trigger-build when watched files changed\n'
