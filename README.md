# Terminality V2

An experimental browser-based "mini OS" built with React, TypeScript, and Vite. It provides a desktop metaphor (windows, taskbar, notifications) and a suite of in-browser "programs" (Terminal, File Explorer, Notepad, Music Player, Chat, Email, Store, Admin tools, etc.).

## Quick Start

```powershell
# From workspace root
cd client
npm install
npm run dev
```
Open http://localhost:5173 in your browser.

## Project Structure (client/)

- `src/os` – Core OS shell (Desktop, Taskbar, Window management, Context menus, Theme & User context providers)
- `src/programs` – Individual app/program components
- `src/services` – API/auth/state persistence services
- `src/test` – Integration and component tests (Vitest + Testing Library)

## Scripts

```powershell
npm run dev      # Start Vite dev server
npm run build    # Production build
npm test         # Run Vitest test suite
```

## VS Code Tasks
Provided in `.vscode/tasks.json` for convenient access:
- "Client: Dev" – runs `npm run dev`
- "Client: Build" – runs `npm run build`
- "Client: Test" – runs `npm test`

## Environment Variables
Configure via `.env` (create in `client/`):
- `VITE_API_BASE` – Base URL for backend API

Example `.env`:
```env
VITE_API_BASE=http://localhost:3000
```

## Testing

Vitest 2.x with jsdom:
```powershell
npm test
```
Add tests beside components with `*.test.tsx` or integration in `src/test/*integration.test.tsx`.

## Session Expiry Handling
A global `SessionExpiredOverlay` listens for 401 responses and prompts a re-auth / refresh.

## Terminal Program API Command
The `TerminalApp` uses the shared `apiRequest` service for authenticated backend calls, ensuring consistent headers and error handling.

## Contributing
1. Fork & clone.
2. Create a feature branch.
3. Install deps & run dev server.
4. Add/adjust tests; ensure `npm test` passes.
5. Submit PR.

## Roadmap / Improvements
- ESLint + Prettier setup (in progress)
- Accessibility (focus management, ARIA roles)
- Error boundaries for top-level windows
- Optional offline/PWA support
- Enhanced persistence when unauthenticated

## License
MIT (add LICENSE file if not present).
