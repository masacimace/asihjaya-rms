# syntax=docker/dockerfile:1

# Keep this tag aligned with package-lock.json Playwright version.
# Noble is Ubuntu 24.04 and already contains Chromium plus its runtime libraries.
FROM mcr.microsoft.com/playwright:v1.61.0-noble AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps

ARG NPM_REGISTRY=https://registry.npmjs.org/

COPY package.json package-lock.json ./

RUN npm config set registry "${NPM_REGISTRY}" \
    && npm ci \
      --fetch-retries=5 \
      --fetch-retry-factor=2 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN groupadd --system nodejs \
    && useradd --system \
        --gid nodejs \
        --create-home \
        --home-dir /home/nextjs \
        nextjs \
    && mkdir -p /app/.data/uploads \
    && chown -R nextjs:nodejs /app/.data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The PDF renderer imports Playwright dynamically, so Next.js standalone tracing
# cannot discover these packages automatically. Keep the runtime package beside
# the matching browser bundle already available in /ms-playwright.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/playwright-core ./node_modules/playwright-core

VOLUME ["/app/.data/uploads"]

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
