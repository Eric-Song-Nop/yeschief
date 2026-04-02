# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "start"]
