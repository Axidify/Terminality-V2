# Terminality Dev Server

This is a minimal dev backend used by the Terminality V2 front-end during development.

Quick start:

```powershell
cd server
npm install
npm run dev
```

By default it listens on port 3000. To use a different port, set the `PORT` env variable before starting the server.

If you want the client to point to the dev server, set `VITE_API_BASE` in `client/.env` to `http://localhost:3000` (or whichever port you chose):

```env
VITE_API_BASE=http://localhost:8000
```

This server is intentionally minimal: it persists `state` to `server/state.json`, supports `/api/state` GET/PUT, a simple token-based auth mock, `/api/command` and basic `admin` endpoints for testing.

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
