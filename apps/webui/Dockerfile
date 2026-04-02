# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.11

FROM oven/bun:${BUN_VERSION}-slim AS build

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY . .

RUN bun install --frozen-lockfile

WORKDIR /app/apps/webui

RUN bun run build

FROM oven/bun:${BUN_VERSION}-slim

WORKDIR /app

COPY --from=build /app/apps/webui/dist apps/webui/dist
COPY --from=build /app/apps/webui/server.js apps/webui/server.js

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "apps/webui/server.js"]
