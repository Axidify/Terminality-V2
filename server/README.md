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
