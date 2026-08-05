# Deploying Liftwise to your own VPS

This walks through putting Liftwise on an OVH VPS you already have, behind
Nginx, on a domain you already own. It assumes a Debian/Ubuntu VPS and root
(or sudo) SSH access. Config files referenced below live in [`deploy/`](deploy/).

Follow the steps in order — in particular, get HTTPS working (steps 1–7)
**before** creating any accounts (step 8). Liftwise's session cookies are
marked `Secure` once `NODE_ENV=production` is set, so logging in only works
once the site is actually served over HTTPS.

## 0. Before you start

- A domain (or subdomain) with an **A record pointing at your VPS's public
  IPv4 address**. DNS propagation can take a few minutes to a few hours —
  confirm it's resolving (`dig +short your-domain.tld`) before step 6.
- SSH access to the VPS.

## 1. Point your domain at the VPS

In your domain registrar/DNS provider, add an A record (and an AAAA record
if your VPS has IPv6) for the (sub)domain you want, e.g.:

```text
liftwise.example.com.   A      203.0.113.10
```

## 2. Initial server setup

SSH in and update the system:

```bash
ssh root@your-vps-ip
apt update && apt upgrade -y
```

Install Node.js 24 (match whatever version you develop with — this project
was built and tested against 24; the exact major version matters somewhat
because `better-sqlite3` and `argon2` are native modules that ship
prebuilt binaries per Node ABI version), Nginx, Certbot, and basic build
tools (only needed as a fallback if no prebuilt binary matches your exact
Node/OS combination):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx git build-essential sqlite3
node --version   # confirm it installed
```

Open the firewall for SSH, HTTP, and HTTPS only (the Node API stays on
`127.0.0.1:3001`, reachable only from Nginx on the same machine):

```bash
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw enable
```

## 3. Create a dedicated system user

Don't run the app as root:

```bash
adduser --system --group --home /opt/liftwise liftwise
mkdir -p /var/lib/liftwise
chown liftwise:liftwise /var/lib/liftwise
```

## 4. Get the code onto the server and build it

```bash
git clone <your-repo-url> /opt/liftwise
cd /opt/liftwise
npm ci
npm run build
chown -R liftwise:liftwise /opt/liftwise
```

`npm run build` produces the static `dist/` folder Nginx will serve.
Re-run `npm ci && npm run build` (step 12) whenever you deploy an update.

## 5. Configure the environment

Generate a real session secret and write the production environment file
(this file holds a secret — keep it out of git, which it already is not
part of):

```bash
openssl rand -base64 48
```

```bash
cat > /opt/liftwise/.env.production <<'EOF'
NODE_ENV=production
PORT=3001
LIFTWISE_DB_PATH=/var/lib/liftwise/liftwise.sqlite3
SESSION_SECRET=paste-the-random-value-from-openssl-here
TRUST_PROXY=1
EOF
chown liftwise:liftwise /opt/liftwise/.env.production
chmod 600 /opt/liftwise/.env.production
```

`TRUST_PROXY=1` tells Express to read the real client IP from the
`X-Forwarded-For` header Nginx sets (see `deploy/nginx-liftwise.conf`) —
without it, every request in `request_logs` would show Nginx's own address.
Do **not** set `ALLOW_TEST_ENDPOINTS` here; that flag exists only for the
Playwright test suite and must never be enabled in production.

## 6. Install and start the backend as a systemd service

```bash
cp /opt/liftwise/deploy/liftwise.service /etc/systemd/system/liftwise.service
systemctl daemon-reload
systemctl enable --now liftwise
systemctl status liftwise   # should show "active (running)"
curl http://127.0.0.1:3001/api/session   # should print {"authenticated":false}
```

If it didn't start, check `journalctl -u liftwise -n 50` for the error.

## 7. Configure Nginx and get a TLS certificate

```bash
cp /opt/liftwise/deploy/nginx-liftwise.conf /etc/nginx/sites-available/liftwise
sed -i 's/YOUR_DOMAIN/liftwise.example.com/' /etc/nginx/sites-available/liftwise   # use your real domain
ln -s /etc/nginx/sites-available/liftwise /etc/nginx/sites-enabled/liftwise
nginx -t   # syntax check
systemctl reload nginx
```

Confirm plain HTTP works first: `http://liftwise.example.com/modern.html`
should load the app shell (it will show a sign-in screen with no accounts
yet — that's expected).

Now get a certificate; certbot edits the Nginx config in place to add the
HTTPS server block and an HTTP→HTTPS redirect:

```bash
certbot --nginx -d liftwise.example.com
```

Certbot's systemd timer renews the certificate automatically; no extra
cron job is needed for that part.

Confirm `https://liftwise.example.com/modern.html` loads over HTTPS with a
valid certificate before continuing.

## 8. Create accounts

Accounts are invite-only — there's no signup form. Create one per person
directly on the server:

```bash
cd /opt/liftwise
sudo -u liftwise npx tsx server/scripts/create-user.ts alex "a strong password"
sudo -u liftwise npx tsx server/scripts/create-user.ts sam "a different strong password"
```

Re-run the same command with an existing username to reset that person's
password later.

## 9. Sign in and verify

Visit `https://liftwise.example.com/modern.html`, sign in with one of the
accounts you just created, and confirm you can create a starter profile and
log a workout. Have each friend sign in with their own account.

## 10. Back up the database

The SQLite file at `/var/lib/liftwise/liftwise.sqlite3` is now the only
copy of everyone's data — back it up. A simple nightly cron job using
SQLite's own `.backup` command (safe to run against a live database):

```bash
mkdir -p /var/backups/liftwise
cat > /etc/cron.daily/liftwise-backup <<'EOF'
#!/bin/sh
sqlite3 /var/lib/liftwise/liftwise.sqlite3 ".backup /var/backups/liftwise/liftwise-$(date +\%F).sqlite3"
find /var/backups/liftwise -name '*.sqlite3' -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/liftwise-backup
```

This keeps 30 days of daily backups locally. Consider also copying
`/var/backups/liftwise` somewhere off the VPS periodically (e.g. with
`rsync` or `rclone` to another host) so a lost or corrupted VPS disk
doesn't take the only copy with it.

## 11. Traffic logs

Every request is logged to the `request_logs` table (method, path, status,
duration, the signed-in user if any, and IP — never request bodies, so
passwords and workout data never appear here). Query it directly on the
server:

```bash
sqlite3 /var/lib/liftwise/liftwise.sqlite3 \
  "SELECT occurred_at, method, path, status, duration_ms, user_id, ip
   FROM request_logs ORDER BY id DESC LIMIT 20;"
```

This table grows without an automatic cap. If it gets large, prune old
rows the same way the backup script prunes old files, e.g. add to the cron
job above:

```bash
sqlite3 /var/lib/liftwise/liftwise.sqlite3 \
  "DELETE FROM request_logs WHERE occurred_at < datetime('now', '-90 days');"
```

## 12. Deploying an update later

```bash
cd /opt/liftwise
sudo -u liftwise git pull
sudo -u liftwise npm ci
sudo -u liftwise npm run build
systemctl restart liftwise
```

Nginx needs no changes for a normal update — it always serves whatever is
currently in `dist/` and proxies to the same backend port.

## Troubleshooting

- **`systemctl status liftwise` shows failed** — check `journalctl -u
liftwise -n 50`. A missing `SESSION_SECRET` in production is a common
  cause; the server refuses to start without one.
- **Sign-in redirects back to the sign-in screen** — usually means the site
  is being loaded over plain HTTP after `NODE_ENV=production` was set
  (Secure cookies aren't sent over HTTP). Confirm you're on `https://`.
- **502 from Nginx on `/api/...`** — the backend isn't running or isn't
  listening on the port Nginx is proxying to; check `systemctl status
liftwise` and that `PORT` in `.env.production` matches
  `deploy/nginx-liftwise.conf`'s `proxy_pass`.
- **`npm ci` fails building `better-sqlite3` or `argon2`** — these are
  native modules; if no prebuilt binary matches your Node version/OS, npm
  falls back to compiling from source, which needs `build-essential`
  (installed in step 2) and can take a minute or two — this is normal, not
  an error, unless it prints an actual failure.
