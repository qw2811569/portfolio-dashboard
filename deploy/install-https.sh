#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${DOMAIN:-104-199-144-170.sslip.io}"
EXPECTED_DOMAIN="104-199-144-170.sslip.io"
SITE_NAME="${SITE_NAME:-jcv-dev-https}"
WEB_ROOT="${WEB_ROOT:-/var/www/app/current/dist}"
ACME_ROOT="${ACME_ROOT:-/var/www/letsencrypt}"
NGINX_SITE_AVAILABLE="${NGINX_SITE_AVAILABLE:-/etc/nginx/sites-available/${SITE_NAME}.conf}"
NGINX_SITE_ENABLED="${NGINX_SITE_ENABLED:-/etc/nginx/sites-enabled/${SITE_NAME}.conf}"
CONFIG_SOURCE="${CONFIG_SOURCE:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nginx-jcv-https.conf}"
GCP_PROJECT="${GCP_PROJECT:-jcv-dev-2026}"
GCP_NETWORK="${GCP_NETWORK:-default}"
ENABLE_GCLOUD_FIREWALL="${ENABLE_GCLOUD_FIREWALL:-1}"
VERIFY_API_PATH="${VERIFY_API_PATH:-}"

log() {
  printf '[install-https] %s\n' "$*"
}

die() {
  printf '[install-https] ERROR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    die "run with sudo on the jcv-dev VM"
  fi
}

ensure_domain_matches_config() {
  if [[ "$DOMAIN" != "$EXPECTED_DOMAIN" ]]; then
    die "DOMAIN=$DOMAIN does not match deploy/nginx-jcv-https.conf server_name $EXPECTED_DOMAIN"
  fi
}

reload_nginx() {
  systemctl reload nginx || systemctl restart nginx
}

install_packages() {
  log "installing nginx, certbot nginx plugin, curl"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx curl ca-certificates
}

ensure_firewall_rule() {
  if [[ "$ENABLE_GCLOUD_FIREWALL" != "1" ]]; then
    log "skipping gcloud firewall rule because ENABLE_GCLOUD_FIREWALL=$ENABLE_GCLOUD_FIREWALL"
    return
  fi

  if ! command -v gcloud >/dev/null 2>&1; then
    log "gcloud is not installed; create allow-https from an authenticated workstation if needed"
    return
  fi

  if gcloud compute firewall-rules describe allow-https --project "$GCP_PROJECT" >/dev/null 2>&1; then
    log "firewall rule allow-https already exists in project $GCP_PROJECT"
    return
  fi

  log "creating firewall rule allow-https in project $GCP_PROJECT"
  gcloud compute firewall-rules create allow-https \
    --project "$GCP_PROJECT" \
    --network "$GCP_NETWORK" \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTPS traffic to jcv-dev nginx"
}

install_http_challenge_site() {
  log "installing temporary HTTP challenge site"
  [[ -d "$WEB_ROOT" ]] || die "WEB_ROOT does not exist: $WEB_ROOT"
  install -d -m 0755 "$ACME_ROOT" "$(dirname "$NGINX_SITE_AVAILABLE")" "$(dirname "$NGINX_SITE_ENABLED")"

  cat > "$NGINX_SITE_AVAILABLE" <<NGINX
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  root ${WEB_ROOT};
  index index.html;

  location ^~ /.well-known/acme-challenge/ {
    root ${ACME_ROOT};
    default_type "text/plain";
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
NGINX

  ln -sfn "$NGINX_SITE_AVAILABLE" "$NGINX_SITE_ENABLED"
  if [[ "${DISABLE_DEFAULT_SITE:-1}" == "1" ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi
  nginx -t
  reload_nginx
}

issue_certificate() {
  log "requesting Let's Encrypt certificate for $DOMAIN"
  local certbot_args=(
    certonly
    --nginx
    --domain "$DOMAIN"
    --non-interactive
    --agree-tos
    --keep-until-expiring
  )

  if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
    certbot_args+=(--email "$CERTBOT_EMAIL")
  else
    certbot_args+=(--register-unsafely-without-email)
  fi

  certbot "${certbot_args[@]}"
}

install_https_site() {
  log "installing final HTTPS nginx config from $CONFIG_SOURCE"
  [[ -f "$CONFIG_SOURCE" ]] || die "missing nginx config: $CONFIG_SOURCE"
  install -m 0644 "$CONFIG_SOURCE" "$NGINX_SITE_AVAILABLE"
  ln -sfn "$NGINX_SITE_AVAILABLE" "$NGINX_SITE_ENABLED"
  nginx -t
  reload_nginx
}

verify_https() {
  local root_url="https://${DOMAIN}/"
  log "verifying $root_url"
  curl -fsS --retry 5 --retry-delay 2 -o /tmp/jcv-dev-https-root.html "$root_url"

  if [[ -n "$VERIFY_API_PATH" ]]; then
    log "verifying https://${DOMAIN}${VERIFY_API_PATH}"
    curl -fsS --retry 5 --retry-delay 2 -o /tmp/jcv-dev-https-api.out "https://${DOMAIN}${VERIFY_API_PATH}"
  fi
}

main() {
  require_root
  ensure_domain_matches_config
  install_packages
  ensure_firewall_rule
  install_http_challenge_site
  issue_certificate
  install_https_site
  verify_https
  log "done: https://${DOMAIN}/"
}

main "$@"
