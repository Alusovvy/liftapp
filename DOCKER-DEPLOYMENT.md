# Deploying Liftwise to your OVH VPS with Docker

This is the Docker version of [`DEPLOYMENT.md`](DEPLOYMENT.md). It reaches
the same end state — Liftwise behind Nginx, on your domain, over HTTPS —
but the Node app runs inside a container instead of directly on the host
via systemd. **The host still runs Nginx and Certbot directly** (not
containerized): TLS renewal via certbot's systemd timer is simple and
proven, and it means `deploy/nginx-liftwise.conf` needs zero changes from
the non-Docker guide. Only the "install Node, `npm ci`, `npm run build`,
run it as a systemd service" part is replaced by Docker.

Follow the steps in order — get HTTPS working (steps 1–8) **before**
creating any accounts (step 9). Liftwise's session cookies are marked
`Secure` once `NODE_ENV=production` is set, so signing in only works once
the site is actually served over HTTPS.

## 0. Before you start

- A domain (or subdomain) with an **A record pointing at your VPS's public
  IPv4 address** (and an AAAA record if the VPS has IPv6). Confirm it
  resolves (`dig +short your-domain.tld`) before step 7.
- SSH access to the VPS (a Debian/Ubuntu image, as OVH provides by
  default).

## 1. Point your domain at the VPS

In your domain registrar/DNS provider:

```text
liftwise.example.com.   A      203.0.113.10
```

## 2. Initial server setup

```bash
ssh root@your-vps-ip
apt update && apt upgrade -y
```

Note what this guide does **not** need on the host, compared to the
non-Docker path: no Node.js, no `build-essential`, no native-module
toolchain — all of that lives inside the image.

## 3. Install Docker Engine

Docker's official convenience script (adds Docker's own apt repo and
installs Engine + the `compose` plugin):

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

## 4. Install Nginx and Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx sqlite3
```

`sqlite3` is the CLI client, installed on the **host** (not in the
container) so backups and log queries in steps 12–13 can read the database
file directly through the bind mount.

## 5. Firewall

```bash
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw enable
```

The container's port is published to `127.0.0.1` only (see the
`docker-compose.yml` shipped in the repo) — it is never reachable directly
from outside the VPS, only through Nginx.

## 6. Get the code onto the server

```bash
mkdir -p /opt/liftwise
git clone <your-repo-url> /opt/liftwise
cd /opt/liftwise
```

## 7. Configure the environment and data directory

```bash
mkdir -p /opt/liftwise/data
# Fixed UID 1001 to match the "liftwise" user baked into the image
# (see Dockerfile) — without this the container can't write to the
# bind-mounted volume.
chown -R 1001:1001 /opt/liftwise/data

cp .env.example .env
openssl rand -base64 48   # copy the output into .env below
```

Edit `.env` and replace the placeholder with the value you just generated:

```text
SESSION_SECRET=paste-the-random-value-from-openssl-here
```

`.env` is gitignored — it never leaves this server. `NODE_ENV`, `PORT`,
`LIFTWISE_DB_PATH`, and `TRUST_PROXY` are already set correctly in
`docker-compose.yml` and don't need to be touched.

## 8. Build the image and extract the static frontend for Nginx

Nginx serves the built frontend (`dist/`) directly from disk, the same way
it does in the non-Docker setup — only now `dist/` is produced inside the
Docker build instead of by running `npm run build` on the host. Extract it
with `docker cp` so the host never needs Node.js installed at all:

```bash
cd /opt/liftwise
docker compose build
docker create --name liftwise-dist-extract liftwise:latest
docker cp liftwise-dist-extract:/app/dist /opt/liftwise/dist
docker rm liftwise-dist-extract
```

Re-run this whenever you rebuild the image (step 14) so Nginx serves the
matching frontend for whatever backend version is running.

## 9. Start the container

```bash
docker compose up -d
docker compose ps                          # should show "healthy" after ~10s
curl http://127.0.0.1:3001/api/session     # should print {"authenticated":false}
```

If it's not healthy, check `docker compose logs -f app`.

## 10. Configure Nginx and get a TLS certificate

This step is **identical** to the non-Docker guide — the config file
proxies to `127.0.0.1:3001`, which is exactly where the container publishes
its port:

```bash
cp /opt/liftwise/deploy/nginx-liftwise.conf /etc/nginx/sites-available/liftwise
sed -i 's/YOUR_DOMAIN/liftwise.example.com/' /etc/nginx/sites-available/liftwise
ln -s /etc/nginx/sites-available/liftwise /etc/nginx/sites-enabled/liftwise
nginx -t
systemctl reload nginx
```

Confirm plain HTTP works first:
`http://liftwise.example.com/modern.html` should load the app shell (sign-in
screen, no accounts yet — expected).

Now get a certificate; certbot edits the Nginx config in place to add the
HTTPS server block and an HTTP→HTTPS redirect:

```bash
certbot --nginx -d liftwise.example.com
```

Certbot's systemd timer renews the certificate automatically. Confirm
`https://liftwise.example.com/modern.html` loads over HTTPS with a valid
certificate before continuing.

## 11. Create accounts

Accounts are invite-only — there's no signup form. Run the provisioning
script **inside the running container** so it uses the same
`LIFTWISE_DB_PATH` the app is writing to:

```bash
cd /opt/liftwise
docker compose exec app node_modules/.bin/tsx server/scripts/create-user.ts alex "a strong password"
docker compose exec app node_modules/.bin/tsx server/scripts/create-user.ts sam "a different strong password"
```

Re-run the same command with an existing username to reset that person's
password later.

## 12. Sign in and verify

Visit `https://liftwise.example.com/modern.html`, sign in, and confirm you
can create a starter profile and log a workout. Have each friend sign in
with their own account.

## 13. Back up the database

Because `/opt/liftwise/data` is a host bind mount (not an opaque Docker
volume), the host's `sqlite3` CLI can back it up directly, exactly like the
non-Docker guide:

```bash
mkdir -p /var/backups/liftwise
cat > /etc/cron.daily/liftwise-backup <<'EOF'
#!/bin/sh
sqlite3 /opt/liftwise/data/liftwise.sqlite3 ".backup /var/backups/liftwise/liftwise-$(date +\%F).sqlite3"
find /var/backups/liftwise -name '*.sqlite3' -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/liftwise-backup
```

Keeps 30 days of daily backups locally. Periodically copy
`/var/backups/liftwise` off the VPS too (`rsync`/`rclone` to another host)
so a lost or corrupted VPS disk doesn't take the only copy with it.

## 14. Traffic logs

Same table, same direct query, no `docker exec` needed since the host can
read the file:

```bash
sqlite3 /opt/liftwise/data/liftwise.sqlite3 \
  "SELECT occurred_at, method, path, status, duration_ms, user_id, ip
   FROM request_logs ORDER BY id DESC LIMIT 20;"
```

Prune old rows if the table grows large:

```bash
sqlite3 /opt/liftwise/data/liftwise.sqlite3 \
  "DELETE FROM request_logs WHERE occurred_at < datetime('now', '-90 days');"
```

## 15. Deploying an update later

```bash
cd /opt/liftwise
git pull
docker compose build
docker create --name liftwise-dist-extract liftwise:latest
rm -rf /opt/liftwise/dist
docker cp liftwise-dist-extract:/app/dist /opt/liftwise/dist
docker rm liftwise-dist-extract
docker compose up -d          # recreates the container on the new image
```

Nginx needs no changes for a normal update — it always serves whatever is
currently in `/opt/liftwise/dist` and proxies to the same container port.

## Troubleshooting

- **`docker compose ps` never shows "healthy"** — check
  `docker compose logs -f app`. A missing `SESSION_SECRET` in `.env` is a
  common cause; the server refuses to start without one in production.
- **Container restarts in a loop with a permissions error writing to
  `/data`** — the bind-mounted `/opt/liftwise/data` directory doesn't match
  the container's fixed UID. Re-run `chown -R 1001:1001 /opt/liftwise/data`.
- **Sign-in redirects back to the sign-in screen** — usually means the site
  is being loaded over plain HTTP after `NODE_ENV=production` was set
  (Secure cookies aren't sent over HTTP). Confirm you're on `https://`.
- **502 from Nginx on `/api/...`** — the container isn't running or isn't
  publishing to the port Nginx expects; check `docker compose ps` and that
  `docker-compose.yml`'s `ports:` still reads `127.0.0.1:3001:3001`.
- **`docker compose build` fails compiling `better-sqlite3` or `argon2`**
  — these are native modules; if no prebuilt binary matches the image's
  Node version/platform, npm compiles from source inside the build stage,
  which needs `python3`/`build-essential` (already installed there) and can
  take a minute or two — normal, not an error, unless it prints an actual
  build failure.
- **`dist/` on the host looks stale after a rebuild** — the `docker cp`
  extraction step (8 or 15) was skipped or targeted the wrong container
  name; re-run it after every `docker compose build`.

## Why not containerize Nginx and Certbot too?

You can, but it trades a working, low-maintenance setup for more moving
parts: certificate renewal needs a webroot or DNS challenge shared with the
Nginx container, plus either a cron job or a renewal sidecar (e.g.
`nginx-proxy` + `acme-companion`, or switching to Caddy for automatic
HTTPS). Since `deploy/nginx-liftwise.conf` and certbot's systemd timer
already work reliably at the host level, this guide keeps them there and
only containerizes the part that actually benefits from it — the Node app
and its native-module toolchain.
