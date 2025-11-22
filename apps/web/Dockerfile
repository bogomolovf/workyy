FROM node:20-slim AS base
WORKDIR /app
COPY ../../package.json ../../pnpm-workspace.yaml ../../pnpm-lock.yaml* ./ 
RUN corepack enable

FROM base AS deps
COPY ../../pnpm-workspace.yaml ./
COPY ../../package.json ./
COPY ../.. .
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter web build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY apps/web/next.config.ts ./apps/web/next.config.ts
COPY apps/web/package.json ./apps/web/package.json
CMD ["pnpm", "--filter", "web", "start"]

