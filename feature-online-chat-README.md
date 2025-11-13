# Feature: Online Chat (MVP)

This branch introduces a minimal Online Chat MVP to Terminality V2.

Goals (MVP)
- Backend: Add minimal chat API endpoints (GET /api/chat, POST /api/chat), backed by in-memory storage.
- Frontend: Add a modular app (`Online Chat`) which allows authenticated users to view recent messages and post new messages.
- Tests: Add basic integration tests for chat endpoints and a client integration smoke test.

Notes
- Persistence: For MVP we use in-memory storage to avoid schema migrations. We can add a Prisma model for messages in a follow-up PR.
- Security: All endpoints require auth (access token). Rate limiting will apply to POST requests.
- UX: Basic polling for new messages every 2s; we can replace with a real-time websocket later.

How to run locally
1. Use `npm run dev` in the root to start the server and client concurrently.
2. Register or login using the home screen.
3. Open the modular apps panel and launch `Online Chat`.

Next steps
- Convert the in-memory store to a persisted Prisma model and add pagination
- Implement websocket-based real-time updates
- Add moderation tools and profanity filter
- Add tests around multi-user interactions

Reviewed-by: ChatGPT assistant
