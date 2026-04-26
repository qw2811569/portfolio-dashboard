# VM HTTPS Setup

## Scope

This runbook enables HTTPS for the jcv-dev frontend now served by nginx from `dist/`.

- VM: `jcv-dev`
- static IP: `104.199.144.170`
- domain: `104-199-144-170.sslip.io`
- nginx site config: `deploy/nginx-jcv-https.conf`
- install script: `deploy/install-https.sh`

Do not run this against the production `bigstock` VM.

## Prerequisites

- `dist/` already deployed at `/var/www/app/current/dist`
- nginx already installed or installable with `apt`
- API process listening on `127.0.0.1:3000`
- port `80` reachable for Let's Encrypt HTTP-01 challenge
- port `443` allowed in GCP firewall
- `104-199-144-170.sslip.io` resolves to `104.199.144.170`

## Firewall

If the `allow-https` rule does not exist, create it from an authenticated shell:

```bash
gcloud compute firewall-rules create allow-https \
  --project jcv-dev-2026 \
  --network default \
  --allow tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --description "Allow HTTPS traffic to jcv-dev nginx"
```

Verify:

```bash
gcloud compute firewall-rules describe allow-https --project jcv-dev-2026
```

## Install

From the repo on `jcv-dev`:

```bash
sudo CERTBOT_EMAIL=ops@example.com deploy/install-https.sh
```

If `gcloud` is not installed on the VM, create the firewall rule from your workstation first, then run:

```bash
sudo ENABLE_GCLOUD_FIREWALL=0 CERTBOT_EMAIL=ops@example.com deploy/install-https.sh
```

The script:

1. Installs `nginx`, `certbot`, `python3-certbot-nginx`, and `curl` with `apt`.
2. Creates `/var/www/letsencrypt` for HTTP-01 challenges.
3. Installs a temporary HTTP-only nginx site for `104-199-144-170.sslip.io`.
4. Runs `certbot certonly --nginx` for the sslip.io domain.
5. Installs `deploy/nginx-jcv-https.conf` into `/etc/nginx/sites-available/jcv-dev-https.conf`.
6. Runs `nginx -t`, reloads nginx, and verifies `https://104-199-144-170.sslip.io/`.

## Manual Verification

```bash
curl -I http://104-199-144-170.sslip.io/
curl -I https://104-199-144-170.sslip.io/
curl -sS https://104-199-144-170.sslip.io/ | head
curl -sS -o /dev/null -w "%{http_code}\n" https://104-199-144-170.sslip.io/api/
sudo nginx -t
```

Expected:

- HTTP returns `301` to HTTPS.
- HTTPS returns a valid Let's Encrypt certificate.
- `/` serves the VM `dist/` build.
- `/api/` is proxied to `127.0.0.1:3000`; exact status can be `404`, `401`, or app-specific, but it must come from the local API process rather than nginx static fallback.

## Rollback

Restore the previous HTTP-only nginx site:

```bash
sudo cp deploy/nginx-jcv.conf /etc/nginx/sites-available/jcv.conf
sudo ln -sfn /etc/nginx/sites-available/jcv.conf /etc/nginx/sites-enabled/jcv.conf
sudo rm -f /etc/nginx/sites-enabled/jcv-dev-https.conf
sudo nginx -t
sudo systemctl reload nginx
```

If you need to remove the issued certificate after rollback:

```bash
sudo certbot delete --cert-name 104-199-144-170.sslip.io
```

If the firewall change must be rolled back:

```bash
gcloud compute firewall-rules delete allow-https --project jcv-dev-2026
```

## Renewal

The Debian/Ubuntu certbot package installs `certbot.timer`. Check it after install:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Let's Encrypt certificates renew around 30 days before expiry. Keep port `80` open because the installed nginx config serves `/.well-known/acme-challenge/` from `/var/www/letsencrypt` for renewal.
