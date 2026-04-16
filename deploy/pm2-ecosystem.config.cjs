const path = require('node:path')

const REPO_ROOT = process.env.DEPLOY_REPO_DIR || '/home/chenkuichen/app/test'

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
        DEPLOY_DIST_DIR: '/var/www/app/dist',
        PM2_ECOSYSTEM: path.join(REPO_ROOT, 'deploy', 'pm2-ecosystem.config.cjs'),
        PM2_ONLY: 'jcv-api,agent-bridge,jcv-deploy-webhook',
      },
    },
  ],
}
