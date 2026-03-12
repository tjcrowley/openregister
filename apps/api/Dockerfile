FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json packages/types/
COPY packages/events/package.json packages/events/
COPY packages/validation/package.json packages/validation/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./
RUN pnpm run build --filter=@openregister/types
RUN pnpm run build --filter=@openregister/events
RUN pnpm run build --filter=@openregister/validation
RUN pnpm run build --filter=@openregister/api

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm@9
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
