# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:24-bookworm-slim AS build

# python3 + build-essential are only a fallback: better-sqlite3 and argon2
# are native modules that normally install prebuilt binaries, but npm falls
# back to compiling from source if none match this image's Node ABI/platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
# scripts/ must be present before `npm ci`: its postinstall hook
# (provision-lint-typescript.mjs) runs as part of the install itself.
COPY scripts ./scripts
# --legacy-peer-deps: the root typescript devDependency is ahead of what
# typescript-eslint's peer range currently allows. typescript-eslint is a
# lint-only devDependency (never present in the runtime image, and pruned
# below), so skipping strict peer resolution here is safe.
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build \
  && npm prune --omit=dev --legacy-peer-deps

# ---- runtime ----------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Fixed UID/GID so a host bind-mount's ownership is predictable (see
# DOCKER-DEPLOYMENT.md's chown step).
RUN groupadd --system --gid 1001 liftwise \
  && useradd --system --uid 1001 --gid liftwise --home /app liftwise \
  && mkdir -p /data \
  && chown -R liftwise:liftwise /app /data

# server/app.ts imports directly from src/domain and
# src/infrastructure/local-storage — the server runs its TypeScript
# source through tsx rather than a separate compiled server build, so
# both server/ and src/ must be present at runtime, not just dist/.
COPY --from=build --chown=liftwise:liftwise /app/node_modules ./node_modules
COPY --from=build --chown=liftwise:liftwise /app/package.json ./package.json
COPY --from=build --chown=liftwise:liftwise /app/dist ./dist
COPY --from=build --chown=liftwise:liftwise /app/server ./server
COPY --from=build --chown=liftwise:liftwise /app/src ./src

USER liftwise
EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/session').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/tsx", "server/index.ts"]
