# Deployment

The app is two services plus a database:

| Service  | What it is                             | Port | Required env                                                                              |
|----------|----------------------------------------|------|-------------------------------------------------------------------------------------------|
| backend  | Express API (Bun), Prisma + PostgreSQL | 3001 | `DATABASE_URL`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, optional `OPENAI_KEY`, `PROXY_URL` |
| frontend | React UI served by `Bun.serve`         | 3000 | `BUN_PUBLIC_BACKEND_URL` (public URL of the backend)                                      |
| db       | PostgreSQL                             | 5432 | (none)                                                                                    |

Both services have a Dockerfile that must be built from the **repository root**
(the monorepo needs the root lockfile). The backend container runs
`prisma migrate deploy` on startup, so the database schema is created
automatically on first boot.

## Option 1: Render + Neon (free, no server to manage)

Render's free web services never expire, but Render's free Postgres is deleted
30 days after creation. So the database lives on [Neon](https://neon.tech),
whose free plan is permanent and needs no credit card.

1. **Create the database on Neon.** Sign up at neon.tech, create a project
   (any name, Postgres 16 or 17, region closest to Render's `oregon`
   is `US West`), and copy the connection string from the dashboard
   (**Connect** -> **Connection string**). It looks like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.
2. **Push this repository to GitHub.**
3. In Render: **New -> Blueprint**, select the repo. Render reads `render.yaml`
   and creates two web services.
4. When prompted, fill in `DATABASE_URL` (the Neon string), `GEMINI_API_KEY`
   and `DEEPGRAM_API_KEY`. `OPENAI_KEY` can stay empty. Leave
   `BUN_PUBLIC_BACKEND_URL` empty for now.
5. After the backend finishes deploying, copy its URL
   (`https://ai-interviewer-backend-xxxx.onrender.com`), open the frontend
   service -> **Environment**, set `BUN_PUBLIC_BACKEND_URL` to that URL, and
   save. Render redeploys the frontend.
6. Open the frontend URL. `GET <backend-url>/health` should return `{"status":"ok"}`.

Notes: free Render web services sleep after 15 minutes idle (the first request
takes about 30 to 50 seconds to wake). Neon's free compute also suspends when
idle and wakes in under a second on the next query.

## Option 2: Docker Compose (any VPS, or locally)

```bash
cp .env.example .env
# edit .env: GEMINI_API_KEY, DEEPGRAM_API_KEY, BUN_PUBLIC_BACKEND_URL
docker compose up --build -d
```

Frontend: http://localhost:3000, backend: http://localhost:3001. Compose runs
its own Postgres container, so no Neon database is needed here.

On a VPS, set `BUN_PUBLIC_BACKEND_URL` to the address the browser will use to
reach the backend (for example `https://api.your-domain.com`) and put a
reverse proxy (Caddy, nginx, Traefik) in front of ports 3000 and 3001 for TLS.
The microphone (Deepgram speech-to-text) only works on `https://` or
`localhost`, so TLS is required for a public deployment.

## Option 3: Railway / Fly.io / any Docker host

Create two services from this repo, each with the repo root as the build
context and the Dockerfile path set to `apps/backend/Dockerfile` or
`apps/frontend/Dockerfile`. Point `DATABASE_URL` at a Postgres instance and set
the env vars from the table above.

## Environment variables

- `DATABASE_URL`: PostgreSQL connection string (Neon strings include `?sslmode=require`).
- `GEMINI_API_KEY`: Google Gemini, used for question generation and scoring.
- `DEEPGRAM_API_KEY`: Deepgram, used to mint short-lived browser tokens.
- `OPENAI_KEY`: optional, only for `POST /api/v1/session/:id` (OpenAI Realtime).
- `PROXY_URL`: optional HTTPS proxy for GitHub API calls.
- `PORT`: port each service listens on (defaults: backend 3001, frontend 3000).
- `BUN_PUBLIC_BACKEND_URL`: frontend only; inlined into the browser bundle
  when the frontend server starts, so change it and restart to take effect.
