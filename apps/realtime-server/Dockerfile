FROM node:20-slim AS base
WORKDIR /app
COPY ../../package.json ../../pnpm-workspace.yaml ../../pnpm-lock.yaml* ./
RUN corepack enable

FROM base AS deps
COPY ../.. .
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter realtime-server build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/realtime-server/dist ./apps/realtime-server/dist
COPY apps/realtime-server/package.json ./apps/realtime-server/package.json
CMD ["node", "apps/realtime-server/dist/index.js"]

