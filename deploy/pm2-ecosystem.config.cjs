const path = require('node:path')

// Derive REPO_ROOT from the file's own location (deploy/ → ..) so it works on any host
// regardless of where the repo is checked out. Previously hardcoded to my local path,
// which broke the VM webhook when pm2 reloaded without DEPLOY_REPO_DIR in the shell env.
const REPO_ROOT = process.env.DEPLOY_REPO_DIR || path.resolve(__dirname, '..')

module.exports = {
  apps: [
    {
      name: 'jcv-api',
      script: path.join(REPO_ROOT, 'scripts', 'vercel-api-server.mjs'),
      cwd: REPO_ROOT,
      interpreter: 'node',
      autorestart: true,
      watch: false,
      time: true,
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000',
        VERCEL_API_ROOT: path.join(REPO_ROOT, 'api'),
      },
    },
    {
      name: 'agent-bridge',
      script: path.join(REPO_ROOT, 'agent-bridge-standalone', 'server.mjs'),
      cwd: REPO_ROOT,
      interpreter: 'node',
      autorestart: true,
      watch: false,
      time: true,
      env: {
        NODE_ENV: 'production',
        BRIDGE_HOST: '127.0.0.1',
        BRIDGE_PORT: '9527',
        WORKSPACE_ROOT: REPO_ROOT,
      },
    },
    {
      name: 'jcv-deploy-webhook',
      script: path.join(REPO_ROOT, 'scripts', 'vm-deploy-webhook.mjs'),
      cwd: REPO_ROOT,
      interpreter: 'node',
      autorestart: true,
      watch: false,
      time: true,
      env: {
        NODE_ENV: 'production',
        WEBHOOK_HOST: '127.0.0.1',
        WEBHOOK_PORT: '3010',
        WEBHOOK_PATH: '/github/webhook',
        DEPLOY_REPO_DIR: REPO_ROOT,
        DEPLOY_BRANCH: 'main',
        DEPLOY_DIST_SOURCE_DIR: 'dist',
        DEPLOY_TARGET_ROOT: '/var/www/app',
        ATOMIC_DEPLOY_SCRIPT: path.join(REPO_ROOT, 'scripts', 'vm-atomic-deploy.sh'),
        PM2_ECOSYSTEM: path.join(REPO_ROOT, 'deploy', 'pm2-ecosystem.config.cjs'),
        PM2_ONLY: 'jcv-api,agent-bridge,jcv-deploy-webhook',
        // R31+1: NODE_ENV=production above makes npm 8+ omit devDependencies on `npm ci`,
        // and pm2 had cached an older `DEPLOY_INSTALL_COMMAND=npm install --ignore-scripts`
        // which compounded the issue (dev deps never installed → vite missing → build failed
        // silently → `dist/` stayed stale → user saw R31 bug-fix UI for 2 days). Pin the
        // install command here so dev deps (vite / @vitejs/plugin-react / vitest) are always
        // installed before `npm run build`.
        DEPLOY_INSTALL_COMMAND: 'npm ci --include=dev',
      },
    },
  ],
}
