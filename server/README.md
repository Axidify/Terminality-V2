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

Auth notes
----------
This dev server implements simple email/password authentication. Passwords are hashed using bcrypt and tokens are JWTs stored in the DB for revocation in dev. A default admin account is seeded for local development: username `admin`, password `admin`.

To override the JWT signing secret and token expiry for local dev, set environment variables when running the server:

```powershell
setx JWT_SECRET "your-secret-here"
setx JWT_EXPIRES_IN "7d" # or '1h', '3600s', etc.
```

How to create or promote an admin
---------------------------------
If you used the default seed, the admin user already exists and you can login with the seeded credentials.
- To create a new user: POST /api/auth/register with { username, password }.
- To promote a user to admin: log in with the seeded admin account and call PATCH /api/admin/users/:id with a JSON body like { "role": "admin" }.
	Example:
	```powershell
	$token = (curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}' | jq -r '.token')
	curl -X PATCH http://localhost:3000/api/admin/users/3 -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d '{"role":"admin"}'
	```

Note: `PATCH` is protected and requires an admin token to be present in the `Authorization` header.

Google SSO (ID Token) & Full OAuth2 Flow
----------------------------------------
This repository supports two Google sign‑in approaches for development:

1. Minimal ID Token POST (Legacy Scaffold)
	- Endpoint: `POST /api/auth/google` with body `{ id_token }`.
	- Verifies the token using `google-auth-library` (preferred) or falls back to Google's `tokeninfo` endpoint if a client ID isn't configured.
	- Creates or looks up a local user and returns a JWT `access_token`.

2. Full OAuth 2.0 Authorization Code Flow (Recommended)
	- Start: `GET /api/auth/oauth/google` redirects the browser to Google's consent screen.
	- Callback: Google redirects back to `GET /api/auth/oauth/google/callback?code=...` (must match `GOOGLE_REDIRECT_URI`).
	- The server exchanges the `code` for tokens, verifies the `id_token`, creates/looks up the user, then redirects to the frontend with the JWT in the hash fragment (`/#access_token=...`).

Environment variables required (see `.env.example`):

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/oauth/google/callback
CLIENT_FRONTEND_URL=http://localhost:5173
JWT_SECRET=replace-with-secure-random
```

Security Notes:
- Do NOT commit real secrets (.env is gitignored).
- Hash fragment redirect (`/#access_token=...`) avoids leaking tokens via server logs or intermediary proxies capturing query strings.
- Rotate credentials immediately if they are ever exposed in plaintext in commits, PRs, or chat (treat exposed secrets as compromised).
- Prefer verifying ID tokens with `google-auth-library`'s `verifyIdToken`, not just relying on `tokeninfo`.
- In production, consider state/nonce validation and CSRF protections; add PKCE for native/public clients.

Client Handling:
- The frontend should parse the `access_token` from `window.location.hash` after redirect and store it (see planned hook/update in `HomePage.tsx`).
- A page refresh after storing the token ensures subsequent API calls include Authorization headers via existing utilities.

Migration Path:
- Existing minimal POST flow continues to work; you can progressively migrate to the redirect flow without breaking tests.
- Integration tests can mock `google-auth-library` while exercising user creation logic.

Password reset and profile updates
----------------------------------
- Password reset: POST `/api/auth/reset/request` with body { username } returns a `reset_token` (dev-only to simulate email).
- Confirm reset: POST `/api/auth/reset/confirm` with body { token, password } to update password.
- Update profile: PATCH `/api/auth/me` (requires Authorization) with { username } to update username or { oldPassword, password } to change password.

Migration & dev scripts
------------------------
If you inherited a DB with plaintext passwords or need to migrate dev users, there's a small migration script which will hash any plaintext user passwords with bcrypt:

```powershell
npm run migrate:hash-passwords
```

If you need to create a new admin quickly (dev-only), use the create admin script or the `POST /api/admin/create` endpoint:

```powershell
npm run admin:create -- --username alice --password secret --secret YOUR_DEV_ADMIN_SECRET
```

`POST /api/admin/create` will only be enabled when `NODE_ENV !== 'production'` and, if `DEV_ADMIN_SECRET` is set, the request must include the matching secret to prevent accidental exposure. In CI or production you should not use this endpoint.

If you need to reset a live admin password safely, a new CLI helper is available:

 - `npm run admin:reset -- --username <user> --password <newpass> --secret <DEV_ADMIN_SECRET>`

This script is production gated: if `NODE_ENV === 'production'` the `DEV_ADMIN_SECRET` must match the provided secret. It performs a bcrypt hash and updates the user password; pass `--revoke-tokens true` to mark existing tokens revoked.

Prisma usage
------------
This repository includes a Prisma schema under `server/prisma/schema.prisma` and a small seeder `server/prisma/seed.js` to initialize the DB.

To enable the Prisma-backed SQLite datastore locally:

```powershell
cd server
npm run prisma:setup # runs db push, generate and seed
npm run dev
```

The server will fall back to the file-based `state.json` if Prisma is not available.

IMPORTANT: Do not commit your local `server/prisma/dev.db` file. It's a local SQLite database used for development and will lead to conflicts if checked in across branches.
Prefer using the seed and setup scripts to create a local DB: `npm run prisma:setup`.

Credential Hygiene Reminder
---------------------------
If any secret (Google client secret, JWT secret, etc.) was shared publicly or committed, rotate it in the provider console and update your `.env`. Treat all previously exposed values as compromised.

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
