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

Google SSO (dev scaffold)
-------------------------
This repository includes a small, developer-friendly scaffold for Google SSO:
- The server exposes POST `/api/auth/google` which you can POST a Google ID token (`id_token`) to.
- The server will verify the token with Google's `tokeninfo` endpoint and then create/lookup a local user and return an `access_token` (JWT) that the client can use for authenticated requests.

This is intended as a minimal dev scaffold; for production, replace this flow with a proper OIDC/OAuth2 client and secure token validation.

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
