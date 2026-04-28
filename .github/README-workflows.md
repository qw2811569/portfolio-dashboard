# CI Workflows

目前正式 workflow 位於 `.github/workflows/ci.yml`。

## CI

- Trigger: pull request to `main`, push to `main`
- Runtime: Node.js 20 on Ubuntu
- Setup: `npm ci`, Playwright Chromium install
- Verification: starts local Vite server on `127.0.0.1:3002`, then runs `npm run verify:local`
- Deploy: none; CI fails closed and does not deploy
