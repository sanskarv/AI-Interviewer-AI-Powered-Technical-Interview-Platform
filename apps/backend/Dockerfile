# Build from the repository root:
#   docker build -f apps/backend/Dockerfile -t ai-interviewer-backend .
FROM oven/bun:1.3 AS base
WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install workspace dependencies first so this layer is cached.
COPY package.json bun.lock turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages ./packages
RUN bun install --frozen-lockfile

# Copy the backend source and generate the Prisma client.
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN bunx prisma generate

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Apply pending migrations, then start the API.
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run index.ts"]
