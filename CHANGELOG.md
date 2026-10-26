# Changelog

All notable changes to `@infobip/flowbuilder-sdk` are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-26

First stable release: the Flow Builder can be embedded in your own application.

### Added

- **React component** (`@infobip/flowbuilder-sdk/react`): `<FlowBuilder>` for the whole builder, `<FlowBuilderProvider>` with `<FlowLibrary>`, `<FlowEditor>` and `<FlowPreview>` to compose your own screens, plus routers and storage adapters (hash, memory, localStorage). Several instances can share a page; each has its own router, storage and cache.
- **Server handler** (`@infobip/flowbuilder-sdk/server`): `createFlowBuilderHandler()` takes a Fetch `Request` and returns a `Response`, for any framework that speaks Fetch. The Infobip API key stays on your server. `authorize` is required, and flow IDs, request bodies and image downloads are validated.
- **Express adapter** (`@infobip/flowbuilder-sdk/server/express`): `createFlowBuilderRouter()`, mountable at any path, for Express 4 and 5. It doesn't import `express`, so `express` is an optional peer dependency.
- **Theming and features:**
  - `theme` design tokens (`--fb-*` custom properties) and `preset` brands, with light, dark and system modes.
  - A `brand` option for your own name and logo.
  - `features` flags to switch parts of the UI off.
  - A second brand, `indigo`, as a worked reference for writing your own: `frontend/flow-builder/styles/brands/indigo.css` overrides every colour in both modes and retunes the non-colour knobs — a monospace interface, capsule-shaped corners, soft-filled borderless secondary buttons, lifted cards, slower motion — and brings its own mark and tab icon.
  - Lifecycle events: `onFlowCreated`, `onFlowSaved`, `onFlowPublished`, `onFlowDeleted` and `onError`.
- **Styles** (`@infobip/flowbuilder-sdk/styles.css`): one stylesheet, scoped to the builder's root so it can't restyle the host page. The IBM Plex fonts ship in `fonts/` and are referenced by relative URLs, so your bundler picks them up.
- **Internationalisation:** the `locale` prop and a `messages` override for every string in the interface, including validation messages, dates and numbers. Missing keys fall back to English.
- **Web component** (`@infobip/flowbuilder-sdk/element` and `/element/standalone`): `<infobip-flow-builder>` in a shadow root, configured by attributes, properties and `flowbuilder:*` events. `standalone` includes React and registers the element when loaded; `element` leaves React to your bundler and registers on `defineFlowBuilderElement()`.
- **Validator error codes:** every `FlowValidationError` has a stable `code` (`FLOW_VALIDATION_ERROR_CODES` lists them) and `params` with the values used in the message.
- **Server error codes:** error responses are `{ error, code }`, with codes such as `AUTHORIZATION_ERROR`, `BAD_REQUEST`, `INVALID_FLOW_ID`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `NOT_FOUND`, `UPSTREAM_ERROR`, `UPSTREAM_UNREACHABLE` and `INTERNAL_ERROR`. On the client, `FlowBuilderApiError` carries the `code` and HTTP status.

### Changed

- **BREAKING:** `apiBaseUrl` is now the mount point of the flow routes, the same value as the server handler's `basePath` or the Express mount path, and it defaults to `/api`. The client no longer adds `/api` itself: `apiBaseUrl="/flowbuilder/api"` requests `/flowbuilder/api/flows`.
- **BREAKING:** `FlowValidationError` has a required `code` field. Code that builds these errors yourself must set it.
- `react` and `react-dom` are peer dependencies (`^18.3.0 || ^19.0.0`) and are never bundled into the React entry.
- The package has no runtime dependencies. `dotenv`, `compression` and `express` are only used by the standalone app in the repository.
- The package ships `dist/`, with ES modules, type declarations and sourcemaps. The old `dist/builder`, `dist/client` and `dist/embed` outputs are gone.
