# syntax=docker/dockerfile:1

# Use the official Bun base image.
ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-slim AS base

# Install required system packages, then clean up the apt cache for a smaller image
# ca-certificates: enables TLS/SSL for securely fetching dependencies and calling HTTPS services
# --no-install-recommends keeps the image minimal
RUN apt-get update -qq && apt-get install --no-install-recommends -y ca-certificates && rm -rf /var/lib/apt/lists/*

# --- Build stage ---
# Install dependencies, build the project, and prepare production assets
FROM base AS build

# Create a new directory for our application code
# And set it as the working directory
WORKDIR /app

# Copy the dependency file first, for more efficient layer caching
COPY package.json ./

# Install dependencies using Bun.
RUN bun install

# Copy all remaining application files into the container
# This includes source code, configuration files, and dependency specifications
# (Excludes files specified in .dockerignore)
COPY . .

# Build the project
# Your package.json must contain a "build" script, such as `"build": "tsc"`
RUN bun run build

# Pre-download any ML models or files the agent needs
# This ensures the container is ready to run immediately without downloading
# dependencies at runtime, which improves startup time and reliability
# Your package.json must contain a "download-files" script, such as `"download-files": "bun run build && bun dist/agent.js download-files"`
RUN bun run download-files

# Remove dev dependencies for a leaner production image
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# --- Production stage ---
FROM base

# Create a non-privileged user that the app will run under
# See https://docs.docker.com/build/building/best-practices/#user
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/app" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

WORKDIR /app

# Copy the built application with correct ownership in a single layer
# This avoids expensive recursive chown operations on node_modules
COPY --from=build --chown=appuser:appuser /app /app

USER appuser

# Set runtime to production mode
ENV NODE_ENV=production

# Run the application
# The "start" command tells the worker to connect to LiveKit and begin waiting for jobs.
# Your package.json must contain a "start" script, such as `"start": "bun dist/agent.js start"`
CMD [ "bun", "run", "start" ]
