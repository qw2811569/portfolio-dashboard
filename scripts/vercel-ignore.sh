#!/usr/bin/env bash
set +e

if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  exit 1
fi

git fetch --depth=1 origin "$VERCEL_GIT_PREVIOUS_SHA" 2>/dev/null || exit 1

git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- src/ api/ index.html vite.config.js vercel.json package.json

case $? in
  0) exit 0 ;;
  1) exit 1 ;;
  *) exit 1 ;;
esac
