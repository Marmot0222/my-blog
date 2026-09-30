# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV COREPACK_HOME=/opt/corepack
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate \
  && chmod -R a+rX "$COREPACK_HOME"

FROM base AS pruner
RUN pnpm add --global turbo@2.10.5
COPY . .
RUN turbo prune @ting-lab/web @ting-lab/media-server --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ ./
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
COPY --from=pruner /app/content ./content
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION
RUN pnpm --filter @ting-lab/web build

FROM builder AS tools
ENV NODE_ENV=production
ENV COREPACK_ENABLE_NETWORK=0
USER node
RUN --network=none test "$(pnpm --version)" = "9.15.9"
CMD ["pnpm", "--help"]

FROM tools AS media-runner
EXPOSE 3100
CMD ["pnpm", "--filter", "@ting-lab/media-server", "start"]

FROM node:22-bookworm-slim AS web-runner
ARG APP_VERSION=unknown
ENV NODE_ENV=production
ENV APP_VERSION=$APP_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/content ./content
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
