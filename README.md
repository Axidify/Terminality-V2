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

## Cyberpunk Terminal Design Language

Terminality uses a consistent retro-futuristic aesthetic inspired by classic terminal UIs and cyberpunk media. When designing new components or apps, follow these principles:

### System Color Palette
- **Primary Color**: `#00b380` (Teal/Cyan Green) - RGB: `0, 179, 128`
  - Used for: text highlights, borders, glows, interactive elements
  - CSS Variables: `var(--color-primary)` and `var(--color-primary-rgb)`
  - Hover/Active states: Slightly lighter tint (e.g., `#00d89f`)

### Visual Elements
- **Grid Backgrounds**: Subtle grid patterns using `rgba(var(--color-primary-rgb), 0.05)` at 40-50px intervals
- **Scanlines**: Horizontal repeating gradients for CRT effect with 8s infinite animation
- **Particles**: Small floating 2px dots with glow effects (`box-shadow: 0 0 6px var(--color-primary)`)
- **Radial Gradients**: Elliptical gradients from primary color (5-8% opacity) to background

### Typography
- **Font**: `'Courier New', monospace` exclusively
- **Sizing**: Use `clamp()` for responsive text (e.g., `clamp(18px, 2vw, 24px)`)
- **Letter Spacing**: 4-8px for titles, 1-2px for body text, all uppercase for UI labels
- **Text Shadow**: Multi-layer glows using `text-shadow: 0 0 10px rgba(...), 0 0 20px rgba(...), 0 0 30px rgba(...)`
- **Brackets**: Use `[` `]` as decorative elements with pulsing animations (0.5-1 opacity cycle)

### Colors & Theming
- **Always use CSS variables**: `var(--color-primary)`, `var(--color-text)`, `var(--color-background)`
- **RGBA patterns**: `rgba(var(--color-primary-rgb), opacity)` for transparency
- **Opacity levels**: 
  - Borders: 0.3-0.4 (hover: 0.6-1.0)
  - Backgrounds: 0.4-0.7 for panels, 0.85+ for focused inputs
  - Text dim: 0.5-0.7

### Component Styling
- **Borders**: 2px solid borders using `rgba(var(--color-primary-rgb), 0.4)`
- **Border Radius**: 4-6px for modern feel within retro aesthetic
- **Box Shadows**: 
  - Outer: `0 0 20px rgba(var(--color-primary-rgb), 0.4)` for glow
  - Inner: `inset 0 0 20px rgba(0, 0, 0, 0.3)` for depth
- **Backdrop Blur**: `backdrop-filter: blur(4-8px)` for glassmorphism
- **Transitions**: `all 0.3s ease` for smooth interactions

### Context Menu Guidelines

Context menus across programs should follow the system's context menu design language for a consistent look and behavior. Use `client/src/os/ContextMenu.tsx` as the canonical reference implementation and the CSS variables listed above for theming.

- Files to edit:
  - CSS: `client/src/programs/*App.css` (e.g., `MusicPlayerApp.css`, `RecycleBinApp.css`)
  - TSX: `client/src/programs/*App.tsx` for event wiring and `client/src/os/ContextMenu.tsx` for keyboard/accessibility reference
- Styling tokens (CSS variables):
  - Use `var(--color-surface)`, `var(--color-border)`, `var(--color-background)`, `var(--color-shadow)`, `var(--color-glow)`, `var(--color-primary-rgb)`, and `var(--color-text)` for all color work.
  - Container: `border: 2px solid var(--color-border); background: var(--color-surface); box-shadow: 0 0 20px var(--color-shadow), inset 0 0 2px var(--color-glow); padding: 4px 0;`
  - Items: `padding: 8px 16px; font-size: 14px; gap: 12px; color: var(--color-text);` — No `text-transform: uppercase` for menu items (we preserve normal case and use consistent font sizes in menus).
  - Hover: `background: var(--color-background); box-shadow: inset 0 0 12px rgba(var(--color-primary-rgb), 0.2), 0 0 12px rgba(var(--color-primary-rgb), 0.3); text-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.5);`
  - Divider: `height: 1px; background: var(--color-border); margin: 4px 8px; opacity: 0.5;`

- Icons:
  - Use inline SVG with `width`/`height` 14 and `stroke` or `fill` set to `currentColor`. Keep icons monotone so they inherit the menu's text color.
  - Example:
  ```tsx
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
  ```

- Positioning (container-relative):
  - Context menus should be positioned absolutely inside the app window container (not fixed to the viewport). Use a `containerRef` in the app, compute the mouse coordinates relative to the container using `getBoundingClientRect()` (plus scroll offsets), and set the menu `top`/`left` while clamping to container bounds.
  - Example positioning logic (TSX):
  ```tsx
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const openContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = e.clientX - bounds.left + (containerRef.current?.scrollLeft || 0);
    const y = e.clientY - bounds.top + (containerRef.current?.scrollTop || 0);
    const MENU_W = 180; const MENU_H = 180; // estimate or measure
    const clampX = Math.max(8, Math.min(x, bounds.width - MENU_W - 8));
    const clampY = Math.max(8, Math.min(y, bounds.height - MENU_H - 8));
    setMenuPos({ x: clampX, y: clampY });
  };
  ```

- Accessibility & Keyboard Navigation:
  - Follow `ContextMenu.tsx` for `role="menu"`, `role="menuitem"`, and keyboard handlers (ArrowUp/ArrowDown to move focus, Enter to activate, Escape to close).
  - Ensure focus trapping and proper ARIA attributes if the menu is modal or overlays interactive content.

- Testing & Validation:
  1. Run `npm run dev` from `client/` to view in the browser.
  2. Right-click or trigger the menu in several scenarios (near edges, top-left, scrolled containers) and verify the menu doesn't overflow the container.
  3. Test keyboard navigation (Arrow Up/Down/Enter/Escape) and screen-reader accessibility if applicable.
  4. Verify color themes (dark, light, and any custom themes) pick up CSS variables properly.

If you update or add a new context menu component, replicate the above pattern and use `client/src/os/ContextMenu.tsx` as a reference for markup and keyboard behavior.

### Interactive States
- **Hover**: Increase border opacity to 1.0, add transform: `translateY(-2px)`, enhance glow
- **Active/Focus**: Darker background (0.85+), stronger shadows, animated text-shadow glow
- **Disabled**: Reduce opacity to 0.5, remove pointer events
- **Shine Effect**: Use `::before` pseudo-element with gradient sweep on hover

### Animations
- **Scanlines**: `translateY(0)` to `translateY(4px)` over 8s
- **Particles**: Float with opacity fade (0 → 0.5 → 0) over 8-15s
- **Brackets/Logo**: Gentle pulse or float with 2-4s ease-in-out
- **Buttons**: Quick transform and glow on hover (<0.3s)

### Layout Patterns
- **Headers**: Dark background (rgba 0.6), strong borders (2px), 20-24px padding
- **Toolbars**: Medium background (rgba 0.5), 12-20px padding, flex with gap: 10-12px
- **Content**: Minimal background or transparent, focus on border definition
- **Status Bars**: Match headers but inverted (border-top instead of border-bottom)

Reference implementations: `HomePage.css` (lock screen), `AppStoreApp.css`, `MiniBrowserApp.css`

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

Optional (OAuth):
- `VITE_GOOGLE_CLIENT_ID` – Google OAuth client ID for the client button (if enabling Google sign-in)

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

## Deploying to Render

This project has two deployables:
- Backend API: `server/` (Node.js Web Service)
- Frontend app: `client/` (Vite Static Site)

Below are step-by-step instructions and the required environment variables.

> Note for Free plan (no Blueprint): Use the Render web UI. You don't need `render.yaml`. The fields below (Build Command, Start Command, Publish Directory) are set directly in the dashboard.

#### Render UI one-liners
- Backend Build Command (paste as a single line):
  ```sh
  npm ci && npm run prisma:generate && npx prisma migrate deploy && npx prisma db push
  ```
- Backend Start Command:
  ```sh
  node index.js
  ```
- Frontend Build Command:
  ```sh
  npm ci && npm run build
  ```
- Frontend Publish Directory:
  ```
  dist
  ```

### 1) Backend (server/) — Render Web Service

Recommended setup (production): use a managed Postgres database on Render and Prisma migrations.

1. Create a Render PostgreSQL instance (Dashboard → New → PostgreSQL) and copy the Internal Database URL.
2. In Render, create a new Web Service:
   - Repository: this repo
   - Root Directory: `server`
   - Runtime: Node
  - Build Command: use the one-liner above (runs migrate deploy, then db push to create tables if none exist)
   - Start Command: `node index.js`
   - Instance type/region: as needed
3. Environment Variables (Server):
   - REQUIRED
     - `JWT_SECRET` — A strong random secret for signing JWTs.
     - `CLIENT_FRONTEND_URL` — Public URL of the frontend (e.g., `https://your-site.onrender.com`). Used for OAuth redirects.
   - DATABASE (Postgres recommended)
     - `DATABASE_URL` — From Render Postgres. Example: `postgresql://...`
       - Prisma: also update Prisma datasource to Postgres (see note below).
   - OPTIONAL
     - `PORT` — Render provides `$PORT` automatically; you usually don’t need to set this.
     - `JWT_EXPIRES_IN` — Defaults to `7d`.
      - `NODE_ENV` — Set to `production` in production. When `production`, the server selects the Postgres Prisma schema automatically. In non-production, it defaults to SQLite.
      - `DB_PROVIDER` — Override provider selection explicitly (`postgres` or `sqlite`). Takes precedence over `NODE_ENV`.
      - Seed Admin (used by `prisma/seed.js` on initial setup):
        - `ADMIN_USERNAME` — Default `admin`
        - `ADMIN_PASSWORD` — Default `admin`
        - `ADMIN_EMAIL` — Default `<ADMIN_USERNAME>@example.local`
     - Google OAuth (if enabling full OAuth flow):
       - `GOOGLE_CLIENT_ID`
       - `GOOGLE_CLIENT_SECRET`
       - `GOOGLE_REDIRECT_URI` — e.g., `https://your-api.onrender.com/api/auth/oauth/google/callback`
     - `DEV_ADMIN_SECRET` — If using protected dev/admin endpoints in production.

Prisma + Database Notes:
- Automatic provider selection:
  - The server runs a schema selector on install and before Prisma commands.
  - If `DB_PROVIDER=postgres` (or `NODE_ENV=production`), it copies `schema.postgres.prisma` to `schema.prisma`.
  - Otherwise, it uses `schema.sqlite.prisma` for development.
- Migrations (recommended with Postgres):
  1. Create migrations locally: `npx prisma migrate dev -n init`
  2. Commit migrations and push.
  3. On Render, use `npx prisma migrate deploy` in the Build Command.

SQLite quick demo (not recommended for production):
- You can deploy with the current SQLite setup by using `npx prisma db push` in the Build Command. However, Render’s ephemeral filesystem means data will be lost on redeploys or restarts. Prefer Postgres for persistence.

### 2) Frontend (client/) — Render Static Site

1. In Render, create a Static Site:
   - Repository: this repo
   - Root Directory: `client`
  - Build Command: use the one-liner above
  - Publish Directory: `dist`
  
#### SPA routing (rewrite rule)
Single Page Apps need a rewrite so deep links like `/app` and `/reset` serve `index.html`.

In your Render Static Site (frontend) service:
- Settings → Redirects/Rewrites → Add Rule
  - Source: `/*`
  - Destination: `/index.html`
  - Action: `Rewrite`

Save and redeploy the static site. Without this rule, navigating directly to `/app` returns a 404 from the static host.
   
### Common pitfalls
- If Render detects Python and asks for `requirements.txt`, the service was created with the wrong runtime. Delete it and re-create as a Node service with Root Directory set to `server`.
- Ensure `DATABASE_URL` is set and accessible from the service (use the Internal Database URL for Render Postgres).
- Set `NODE_ENV=production` (or `DB_PROVIDER=postgres`) so Prisma uses the Postgres schema in production.
- If the frontend in production keeps calling `http://localhost:3000`, the client was built without `VITE_API_BASE`. In your Render Static Site (frontend) service, add env var `VITE_API_BASE=https://your-api.onrender.com` and redeploy the frontend so the compiled app points at the correct API.
2. Environment Variables (Client):
   - REQUIRED
     - `VITE_API_BASE` — The base URL of the backend API (e.g., `https://your-api.onrender.com`)
   - OPTIONAL
     - `VITE_GOOGLE_CLIENT_ID` — Needed if using the Google sign-in button.

### CORS & Redirects
- The server uses permissive CORS in dev. Set `CLIENT_FRONTEND_URL` to your static site URL so OAuth redirects return to the correct frontend location.
- OAuth callback route (server): `/api/auth/oauth/google/callback`
- Client retrieves the access token from the URL hash on redirect.

### Post-deploy checklist
- Verify API health: `GET https://your-api.onrender.com/api/state` returns JSON (requires auth for protected routes).
- In the client, set `VITE_API_BASE` to the API origin and redeploy if changed.
- Confirm SPA rewrite on the static site: `/* → /index.html (Rewrite)` so `/app` loads the SPA rather than 404.
- If using Google sign-in:
  - Add your frontend origin to the Google OAuth client (Authorized JavaScript origins).
  - Set the authorized redirect URI to your server callback route.
  - Provide `VITE_GOOGLE_CLIENT_ID` to the client and `GOOGLE_*` vars to the server.

## Updating Version & About Page

When releasing a new version:

1. **Update version number**: Edit `client/src/version.ts` and update `VERSION` and `BUILD_DATE`
2. **Update changelogs**: Add new version entry to the top of both:
   - `CHANGELOG.md` (root)
   - `client/public/CHANGELOG.md`
3. **Format**: Follow existing changelog format with Added/Changed/Fixed sections
4. **Order**: Newest version should appear first (chronological: newest → oldest)
5. **About page**: SystemSettingsApp will automatically pull from the public changelog

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
