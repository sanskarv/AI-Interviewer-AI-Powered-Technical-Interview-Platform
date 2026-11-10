# Deployment

The app is two services plus a database:

| Service  | What it is                             | Port | Required env                                                                              |
|----------|----------------------------------------|------|-------------------------------------------------------------------------------------------|
| backend  | Express API (Bun), Prisma + PostgreSQL | 3001 | `DATABASE_URL`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, optional `OPENAI_KEY`, `PROXY_URL` |
| frontend | React UI served by `Bun.serve`         | 3000 | `BUN_PUBLIC_BACKEND_URL` (public URL of the backend)                                      |
| db       | PostgreSQL 16                          | 5432 | (none)                                                                                    |

Both services have a Dockerfile that must be built from the **repository root**
(the monorepo needs the root lockfile). The backend container runs
`prisma migrate deploy` on startup, so the database schema is created
automatically on first boot.

## Option 1: Render (free tier, no server to manage)

1. Push this repository to GitHub.
2. In Render: **New -> Blueprint**, select the repo. Render reads `render.yaml`
   and creates a free Postgres database and two web services.
3. When prompted, fill in `GEMINI_API_KEY`, `DEEPGRAM_API_KEY` (and
   `OPENAI_KEY` if you use the OpenAI Realtime route). Leave
   `BUN_PUBLIC_BACKEND_URL` empty for now.
4. After the backend finishes deploying, copy its URL
   (`https://ai-interviewer-backend-xxxx.onrender.com`), open the frontend
   service -> **Environment**, set `BUN_PUBLIC_BACKEND_URL` to that URL, and
   save. Render redeploys the frontend.
5. Open the frontend URL. `GET <backend-url>/health` should return `{"status":"ok"}`.

Notes: free web services sleep after 15 minutes idle (the first request takes
about 30s to wake). Free Postgres on Render expires after 30 days unless upgraded.

## Option 2: Docker Compose (any VPS, or locally)

```bash
cp .env.example .env
# edit .env: GEMINI_API_KEY, DEEPGRAM_API_KEY, BUN_PUBLIC_BACKEND_URL
docker compose up --build -d
```

Frontend: http://localhost:3000, backend: http://localhost:3001.

On a VPS, set `BUN_PUBLIC_BACKEND_URL` to the address the browser will use to
reach the backend (for example `https://api.your-domain.com`) and put a
reverse proxy (Caddy, nginx, Traefik) in front of ports 3000 and 3001 for TLS.
The microphone (Deepgram speech-to-text) only works on `https://` or
`localhost`, so TLS is required for a public deployment.

## Option 3: Railway / Fly.io / any Docker host

Create two services from this repo, each with the repo root as the build
context and the Dockerfile path set to `apps/backend/Dockerfile` or
`apps/frontend/Dockerfile`. Attach a Postgres instance and set the env vars
from the table above.

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `GEMINI_API_KEY`: Google Gemini, used for question generation and scoring.
- `DEEPGRAM_API_KEY`: Deepgram, used to mint short-lived browser tokens.
- `OPENAI_KEY`: optional, only for `POST /api/v1/session/:id` (OpenAI Realtime).
- `PROXY_URL`: optional HTTPS proxy for GitHub API calls.
- `PORT`: port each service listens on (defaults: backend 3001, frontend 3000).
- `BUN_PUBLIC_BACKEND_URL`: frontend only; inlined into the browser bundle
  when the frontend server starts, so change it and restart to take effect.
