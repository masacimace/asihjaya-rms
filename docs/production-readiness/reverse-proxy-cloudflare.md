# Reverse Proxy, Domain, and Cloudflare

## Architecture

Browser
→ Cloudflare proxied DNS
→ Full (strict)
→ Authenticated Origin Pulls
→ Caddy
→ 127.0.0.1:3000
→ Next.js container

## Domain

- Primary: https://ajsystem.id
- Redirect: https://www.ajsystem.id → https://ajsystem.id
- Origin IP: stored outside repository
- Cloudflare proxy: enabled
- SSL mode: Full (strict)
- Cache policy: bypass dynamic application
- Authenticated Origin Pulls: global, enabled

## Public Ports

- 22/tcp: SSH
- 80/tcp: Caddy HTTP redirect and ACME
- 443/tcp: Caddy HTTPS
- PostgreSQL is not published
- Next.js binds to 127.0.0.1:3000

## Caddy Hardening

- Cloudflare CIDRs configured as trusted proxies
- trusted_proxies_strict enabled
- CF-Connecting-IP used as the primary client IP header
- strict_sni_host enabled
- Cloudflare AOP client certificate required and verified
- Request body maximum: 25 MB
- Header timeout: 10 seconds
- Body read timeout: 5 minutes
- Client write timeout: 5 minutes
- Idle timeout: 2 minutes
- Upstream dial timeout: 5 seconds
- Upstream response-header timeout: 120 seconds

## Application Proxy Configuration

- TRUST_PROXY=true
- TRUST_PROXY_HOPS=2
- SERVER_ACTION_BODY_SIZE_LIMIT=20mb
- IMAGE_MAX_UPLOAD_MB=5

No credentials or secret values are stored in this document.

## Cloudflare Settings

- DNS `@`: proxied
- DNS `www`: proxied
- SSL/TLS: Full (strict)
- Universal SSL: active
- Global Authenticated Origin Pulls: enabled
- Dynamic application cache rule: bypass
- No browser challenge is applied to login, API, POS, or transaction routes

## Validation Evidence

- Public health endpoint returns HTTP 200
- Database health returns connected
- Public response contains `server: cloudflare`
- Dynamic response is not a cache HIT
- Direct-origin HTTPS fails during TLS handshake
- Normal Cloudflare request succeeds
- Invalid Host does not reach the application
- 23 MiB test request reaches application
- 26 MiB test request is rejected with HTTP 413
- Login and session tested from desktop and smartphone

## AOP Recovery

If public access fails after an AOP change:

1. Keep the SSH session open.
2. Restore the previous Caddyfile.
3. Validate Caddy configuration.
4. Reload Caddy.
5. Disable Global Authenticated Origin Pulls in Cloudflare if required.
6. Re-test public and loopback health endpoints.

## Update Cloudflare IP Ranges

Download the current official lists:

- `https://www.cloudflare.com/ips-v4`
- `https://www.cloudflare.com/ips-v6`

Validate all entries as CIDR values, regenerate the Caddy trusted-proxy
list, run `caddy validate`, then reload Caddy.

Never reload an invalid configuration.
