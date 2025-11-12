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
