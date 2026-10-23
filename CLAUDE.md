# AI Flow Builder

## What This Is

A React web app for building WhatsApp Flows from a plain-language prompt: it lists the flows on an Infobip sender, generates new ones with Infobip's AI, and gives you a JSON editor, a live WhatsApp preview and publishing. The backend in `server/` proxies the Infobip WhatsApp Flow Management API and holds the API key, which it never sends to the browser. It's a mountable Fetch handler / Express router that customers can host behind their own auth, and `server.js` is the standalone host that mounts it at `/api`.

## Architecture

```
frontend/
  main.tsx                - Bundle entry: mounts the app
  index.html              - The one page the server serves
  flow-builder/           - The app
    app/                  - Entry point, app shell and router
    pages/                - Library, editor, preview and settings pages
    features/             - Editor and library UI
    components/           - Shared UI primitives
    state/                - React hooks that own app state
    services/             - Chat history, flow JSON cache, live preview and API-key services
    types/                - Shared domain type re-exports
    utils/                - Helpers, including the hash router
    styles/               - Tailwind entry (app.css), default theme (theme.css: the --fb-* tokens), Tailwind mapping (tailwind-theme.css), scoped reset (preflight.css), fonts and other brands (brands/)
    whatsapp-flow-preview/ - In-browser WhatsApp phone preview
  api.ts, services/whatsappFlows.ts - HTTP service layer for the flow routes (under `apiBaseUrl`, default `/api`)
  shared.ts, flowJsonDraft.ts       - Domain helpers shared across the app
server/                   - Embeddable backend, compiled to dist/server/
  core.ts                 - createFlowBuilderHandler: Web Fetch handler with every flow route
  express.ts              - createFlowBuilderRouter: Express adapter for the same core
  index.ts                - Server exports
server.js                 - Standalone host: static files, HTTPS, API-key override; mounts the router at /api
src/
  types/                  - WhatsApp Flow JSON types
  validators/             - validateFlow: the checks the editor runs on every flow
  index.ts                - Package exports
scripts/                  - Frontend watch build, test runner, library and element builds, size budget
tsconfig.lib.json         - Emits the `.d.ts` files of the React and element entries
```

## Commands

- `npm start` — Build `server/` and the frontend, then start the server (HTTPS when `certs/` holds a certificate)
- `npm run dev:frontend` — Watch-build the frontend
- `npm run typecheck` — Type-check `src/`
- `npm run typecheck:frontend` — Type-check the frontend
- `npm run typecheck:server` — Type-check `server/`
- `npm run build:server` — Compile `server/` to `dist/server/` (server.js imports it from there)
- `npm run test:frontend` — Run the frontend, validator and server tests
- `npm run build` — Clean `dist/`, then build everything the package ships: `src/`, the server, the standalone frontend, the library (React entry, `styles.css`, fonts, `.d.ts`) and the web component
- `npm run build:lib` — Library only: `dist/react/`, `dist/styles.css`, `dist/fonts/` and the `.d.ts` files in `dist/dts/`
- `npm run build:element` — Library, then the web component in `dist/element/`
- `npm run check:size` — Fail if a built bundle is over its gzip budget (run after `npm run build`)

## Rules for Contributing

- Components and hooks never call `fetch` or the Infobip API directly; HTTP goes through the service layer to the flow routes (`server/core.ts`). Service paths are relative to `apiBaseUrl` (default `/api`); never hard-code `/api`
- Flow routes live in `server/core.ts` and keep their paths and JSON shapes, because the frontend depends on them. `server.js` only hosts them; the API-key override endpoints stay there and never go into `server/`
- Style with Tailwind utilities; colours, fonts and radii live as `--fb-*` tokens in `frontend/flow-builder/styles/theme.css` (each mapped for Tailwind in `tailwind-theme.css`), and alternative brands override them in `styles/brands/` (see "Rebranding the frontend" in the README)
- CSS must never reach outside `[data-flowbuilder-root]`: the builder is embedded in other people's pages. No global selectors, no variables on `:root`; prefix keyframes `fb-` and font families `FB `
- Keep WhatsApp Flow JSON types in `src/types/` and validation rules in `src/validators/`

## WhatsApp Flow Constraints

- Every screen must have an `id` and `title`
- Every flow must have at least one terminal screen
- The last component on non-terminal screens should be a Footer with navigation
- Max 10 screens per flow
- Screen IDs must be unique SCREAMING_SNAKE_CASE
- Terminal screens cannot have navigate actions
- data-source arrays need at least 1 item, max 20 for dropdowns
- `input-type` on TextInput: text, number, email, password, passcode, phone
