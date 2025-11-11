# Terminality Dev Server

This is a minimal dev backend used by the Terminality V2 front-end during development.

Quick start:

```powershell
cd server
npm install
# Optional: generate Prisma client and push schema to SQLite
# npx prisma generate
# npx prisma db push
npm run dev
```

By default it listens on port 3000. To use a different port, set the `PORT` env variable before starting the server.

If you want the client to point to the dev server, set `VITE_API_BASE` in `client/.env` to `http://localhost:3000` (or whichever port you chose):

```env
VITE_API_BASE=http://localhost:8000
```

This server is intentionally minimal: it persists `state` to `server/state.json` or (if Prisma is enabled) to a local SQLite DB using `prisma`. It supports `/api/state` GET/PUT, a simple token-based auth mock, `/api/command` and basic `admin` endpoints for testing.

Prisma usage
------------
This repository includes a Prisma schema under `server/prisma/schema.prisma` and a small seeder `server/prisma/seed.js` to initialize the DB.

To enable the Prisma-backed SQLite datastore locally:

```powershell
cd server
npx prisma db push
npx prisma generate
node prisma/seed.js
npm run dev
```

The server will fall back to the file-based `state.json` if Prisma is not available.

Health check
------------
This server exposes a simple `/health` endpoint that can be used for readiness/liveness checks and simple monitoring. It returns a JSON payload with basic process metrics and the persisted state version.

Example:

```powershell
curl http://localhost:3000/health
```

Response:

```json
{ "status": "ok", "uptime_secs": 12, "mem": {"rss": 12345678}, "stateVersion": 1, "timestamp": "2025-11-11T00:00:00Z" }
```
