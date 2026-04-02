# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim AS base

RUN apt-get update -qq && apt-get install --no-install-recommends -y ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build

WORKDIR /app

ENV HOME=/app
ENV XDG_CACHE_HOME=/app/.cache
ENV HF_HOME=/app/.cache/huggingface

COPY . .

RUN bun install --frozen-lockfile

WORKDIR /app/apps/agent

RUN bun run build

WORKDIR /app
RUN rm -rf node_modules && bun install --frozen-lockfile --production

WORKDIR /app/apps/agent
RUN bun dist/main.js download-files

FROM base

WORKDIR /app

ENV HOME=/app
ENV XDG_CACHE_HOME=/app/.cache
ENV HF_HOME=/app/.cache/huggingface

COPY --from=build /app /app

ENV NODE_ENV=production

WORKDIR /app/apps/agent

CMD [ "bun", "run", "start" ]
