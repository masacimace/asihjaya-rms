# syntax=docker/dockerfile:1

# Keep this tag aligned with package-lock.json Playwright version.
# Noble is Ubuntu 24.04 and the official Playwright image provides Node.js 24.
FROM mcr.microsoft.com/playwright:v1.61.0-noble AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Jakarta
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

FROM base AS toolchain

ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG NPM_VERSION=11.9.0

RUN npm config set registry "${NPM_REGISTRY}" \
    && npm install --global "npm@${NPM_VERSION}" \
    && node --version \
    && npm --version

FROM toolchain AS deps

COPY package.json package-lock.json .npmrc ./
COPY vendor ./vendor

RUN npm ci \
      --fetch-retries=5 \
      --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000

FROM toolchain AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    npm run build:clean

FROM base AS runner
WORKDIR /app

ARG APP_REVISION=unknown
ARG APP_BUILD_DATE=unknown

LABEL org.opencontainers.image.title="Asihjaya RMS" \
      org.opencontainers.image.description="Asihjaya Finishing RMS and POS production runtime" \
      org.opencontainers.image.revision="${APP_REVISION}" \
      org.opencontainers.image.created="${APP_BUILD_DATE}"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV INTERNAL_RENDER_ORIGIN=http://127.0.0.1:3000
ENV HOME=/tmp
ENV TMPDIR=/tmp
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 10001 nodejs \
    && useradd --system \
        --uid 10001 \
        --gid nodejs \
        --create-home \
        --home-dir /home/nextjs \
        nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The PDF renderer imports Playwright dynamically, so Next.js standalone tracing
# cannot discover these packages automatically. Keep the runtime package beside
# the matching browser bundle already available in /ms-playwright.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/playwright-core ./node_modules/playwright-core

RUN mkdir -p /app/.data/uploads /app/.next/cache \
    && chown -R nextjs:nodejs /app/.data /app/.next/cache

USER nextjs
EXPOSE 3000

# Image-level liveness only. Production Compose overrides this with the database
# readiness endpoint so a container is healthy only after PostgreSQL is reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
