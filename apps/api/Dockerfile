# Build from the repo root (the API depends on packages/shared):
#   docker build -f apps/api/Dockerfile -t barakahfi-api .
#
# Four stages so the final image carries only what it needs to run:
#   build     - all dependencies, compiles shared + api
#   prod-deps - the API's production dependencies only (pnpm deploy)
#   migrate   - build stage as-is (has the Prisma CLI) for `prisma migrate deploy`
#   runtime   - prod-deps + compiled output, non-root

FROM node:24-alpine AS base
RUN npm install -g pnpm@12.18.0
WORKDIR /repo

FROM base AS build
# Manifests first so the dependency layer is cached until a package.json changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/
# apps/web is part of the workspace but not needed to build the API.
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @barakahfi/api exec prisma generate \
 && pnpm --filter @barakahfi/shared build \
 && pnpm --filter @barakahfi/api exec nest build

# Copy just the API and its production dependencies (no dev tools, no web app) to /out.
FROM build AS prod-deps
RUN pnpm --filter @barakahfi/api deploy --prod --legacy /out

FROM build AS migrate
# Release step, not a long-running service:
#   docker run --rm -e DATABASE_URL=... <image-built-with---target-migrate> \
#     pnpm --filter @barakahfi/api db:deploy
WORKDIR /repo/apps/api

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /out /app
COPY --from=build /repo/apps/api/dist /app/dist
USER node
WORKDIR /app
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
