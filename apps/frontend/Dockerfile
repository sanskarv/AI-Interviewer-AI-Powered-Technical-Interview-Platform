# Build from the repository root:
#   docker build -f apps/frontend/Dockerfile -t ai-interviewer-frontend .
FROM oven/bun:1.3 AS base
WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json bun.lock turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages ./packages
RUN bun install --frozen-lockfile

COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend

# Bun bundles src/index.html at startup in production mode and inlines
# BUN_PUBLIC_* variables (see bunfig.toml), so BUN_PUBLIC_BACKEND_URL
# must be present in the container environment.
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "src/index.ts"]
