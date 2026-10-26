# @infobip/flowbuilder-sdk

An AI flow builder for WhatsApp Flows that you embed in your own application. Users describe a flow in plain language, Infobip's AI generates it, and they refine it in a JSON editor with a live WhatsApp preview, then save and publish. It ships as a React component, a framework-free web component, and a small backend (Fetch handler or Express router) that keeps your Infobip API key on the server.

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Web component](#web-component)
- [Embedding checklist](#embedding-checklist)
- [Whole-page layout](#whole-page-layout)
- [Server](#server)
- [Theming](#theming)
- [Internationalisation](#internationalisation)
- [Security](#security)
- [Validator](#validator)
- [Try an embedded example](#try-an-embedded-example)
- [Running the standalone app](#running-the-standalone-app)
- [Browser support](#browser-support)
- [License](#license)

## Requirements

You need an Infobip account, a registered WhatsApp sender, and access to the WhatsApp Flows API and Flow generation.

- [Create an Infobip account](https://www.infobip.com/signup)
- [Register a WhatsApp sender](https://www.infobip.com/docs/whatsapp/get-started)
- [WhatsApp Flows](https://www.infobip.com/docs/whatsapp/message-types-and-templates/whatsapp-flows)
- [Infobip WhatsApp API reference](https://www.infobip.com/docs/api/channels/whatsapp)

## Install

The package is not published to a public registry yet, so install it from source.

```bash
git clone <repository-url> infobip-flowbuilder-sdk
cd infobip-flowbuilder-sdk
npm install
npm run build
```

To use it as a dependency in another project, pack it into a tarball and install that:

```bash
# in the cloned repository
npm pack                       # writes infobip-flowbuilder-sdk-<version>.tgz

# in your application
npm install /path/to/infobip-flowbuilder-sdk-<version>.tgz
```

`npm run examples:prepare` does the same packing step for the bundled examples: it runs `npm pack` and unpacks the tarball into each example's `node_modules`, so the examples use the package exactly as a consumer would.

`react` and `react-dom` (`^18.3.0 || ^19.0.0`) are peer dependencies for the React component. `express` (`^4.18.0 || ^5.0.0`) is an optional peer, needed only for the Express adapter.

## Quick start

Two parts: the server routes, then the component.

**1. Mount the server routes behind your own authentication.**

```ts
import express from 'express';
import { createFlowBuilderRouter } from '@infobip/flowbuilder-sdk/server/express';

const app = express();

app.use(
  '/flowbuilder/api',
  yourAuthMiddleware, // the builder spends your Infobip key, so protect the route
  createFlowBuilderRouter({
    baseUrl: process.env.INFOBIP_BASE_URL!,
    apiKey: process.env.INFOBIP_API_KEY!,
    sender: process.env.INFOBIP_SENDER!,
    authorize: (_request, { req }) => Boolean((req as any).user),
  }),
);
```

`authorize` is required. See [Server](#server) for the options, multi-tenant keys and other runtimes.

**2. Render the builder.**

```tsx
import { FlowBuilder } from '@infobip/flowbuilder-sdk/react';
import '@infobip/flowbuilder-sdk/styles.css';

export function FlowsPage() {
  return (
    <div style={{ height: 'calc(100vh - 64px)' }}>
      <FlowBuilder apiBaseUrl="/flowbuilder/api" />
    </div>
  );
}
```

The builder fills its container, so give the container a height. Every other prop is optional. The main ones are:

| Prop | Type | Default | Description |
|---|---|---|---|
| `apiBaseUrl` | `string` | `'/api'` | Where the server routes are mounted. Relative or absolute. |
| `getHeaders` | `() => Record<string, string> \| Promise<...>` | none | Extra headers for every request, for example a fresh bearer token. |
| `fetch` | `typeof fetch` | global `fetch` | Replaces `fetch`, for example with an authenticated client. |
| `credentials` | `RequestCredentials` | `same-origin` | Use `'include'` for a cross-origin API that uses cookies. |
| `onUnauthorized` | `() => void` | none | Called when a request answers `401`. Use it to send the user to your login page. |
| `theme` | `FlowBuilderTheme` | none | `{ mode, preset, tokens, darkTokens }`. See [Theming](#theming). |
| `features` | `FlowBuilderFeatures` | all on | Hides parts of the UI. See [Theming](#theming). |
| `locale`, `messages` | | | See [Internationalisation](#internationalisation). |
| `layout` | `'fill' \| 'page'` | `'fill'` | `fill` fills the container; `page` grows with its content. See [Whole-page layout](#whole-page-layout). |
| `routing` | `'memory' \| 'hash' \| Router` | `'memory'` | `hash` keeps the current screen in the URL. A custom `Router` object replaces it. |
| `onFlowCreated`, `onFlowSaved`, `onFlowPublished`, `onFlowDeleted`, `onError` | callbacks | none | Lifecycle events. |

For composing your own screens from the library, editor and preview pieces (with React Router, custom storage or an unsaved-changes guard), use `<FlowBuilderProvider>` together with `<FlowLibrary>`, `<FlowEditor>` and `<FlowPreview>`, all exported from `@infobip/flowbuilder-sdk/react`. The same entry exports `createHashRouter`, `createMemoryRouter`, `createLocalStorageAdapter`, `createMemoryStorageAdapter` and `FlowBuilderApiError`.

## Web component

For pages without React. Copy `element/standalone.js` and the `fonts/` folder from the installed package to your own static files and load the script from your own origin:

```html
<script type="module" src="/vendor/flowbuilder/element/standalone.js"></script>
<div style="height: 80vh">
  <infobip-flow-builder api-base-url="/flowbuilder/api" theme-mode="system"></infobip-flow-builder>
</div>
```

Attributes are strings: `api-base-url`, `theme-mode` (`light`, `dark`, `system`), `preset`, `locale`, `routing`, `layout`, `storage-key` and `fonts`. Objects and functions are set as properties on the element:

```js
const el = document.querySelector('infobip-flow-builder');

el.theme = { tokens: { colorAccent: '#7a3cff' }, darkTokens: { colorAccent: '#a98aff' } };
el.brand = { logo: 'https://assets.example.com/acme.svg', productName: 'Acme Flows' };
el.features = { apiKeySettings: false, delete: false };
el.messages = { library: { title: 'Flows' } };
el.getHeaders = async () => ({ Authorization: `Bearer ${await getToken()}` });
el.fetch = (input, init) => myAuthenticatedFetch(input, init);
```

Properties can be set before or after the element is connected. `brand.logo` is an image URL, not markup: only `http:`, `https:`, relative and `data:image/` URLs are accepted. The element emits `flowbuilder:*` events that bubble out of its shadow root. It has no `onUnauthorized` or `credentials` setting, so to catch `401` responses wrap `fetch`.

The element is `display: block; height: 100%`, so in the default `fill` layout its parent needs a height, as in React.

## Embedding checklist

Embedding is two things in your app: **a backend route** that talks to Infobip with your API key, and **a frontend component** that talks to that route. Do them in this order.

**0. Get the package into your app.** See [Install](#install).

**1. Add the backend route.** Set `INFOBIP_BASE_URL`, `INFOBIP_API_KEY` and `INFOBIP_SENDER` in your server's environment (never in frontend code), then mount the router behind your own login as shown in [Quick start](#quick-start). `authorize` must return `true` only for users allowed to use the builder.

**2. Add the frontend**, passing the path you mounted in step 1 as `apiBaseUrl`:

- **React app:** render `<FlowBuilder apiBaseUrl="/flowbuilder/api" />` and import `@infobip/flowbuilder-sdk/styles.css`.
- **Any other page (plain HTML, Vue, Angular):** copy `node_modules/@infobip/flowbuilder-sdk/dist/element/standalone.js` and `dist/fonts/` into your static files, then use `<infobip-flow-builder api-base-url="/flowbuilder/api">`.

**3. Give the container a height.** The builder fills its parent, so a parent with no height shows nothing.

**4. Optional:** theme, locale, feature flags, and the security settings in [Security](#security).

## Whole-page layout

To make the builder the entire page (for example at `/flows`), use the page layout instead of a sized box:

```tsx
// React: a route in your app that renders nothing else
<FlowBuilder apiBaseUrl="/flowbuilder/api" layout="page" routing="hash" />
```

```html
<!-- Any page: a dedicated flows.html -->
<body style="margin: 0">
  <infobip-flow-builder api-base-url="/flowbuilder/api" layout="page" routing="hash"></infobip-flow-builder>
  <script type="module" src="/vendor/flowbuilder/element/standalone.js"></script>
</body>
```

- `layout="page"` lets the builder grow with its content and scroll the window, so no container height is needed.
- `routing="hash"` keeps the current screen in the URL (`/flows#/flows/123`), so reload, back and links work. Use it only when the builder owns the page; inside a page with other content or its own router, keep the default `memory` routing.
- Put the page behind the same login as the API route, and send users to your login page with `onUnauthorized` when a request answers `401`.

For a fixed-height page with its own scrolling (a header above it, say), keep the default `layout="fill"` and size the parent with `height: calc(100vh - <header>px)`.

## Server

The builder's browser code never talks to Infobip. It calls a small backend that you run inside your own application. The backend holds your Infobip API key and forwards the calls:

```
Browser (React or web component)  ->  your app, behind your auth  ->  Infobip WhatsApp Flow API
                                       createFlowBuilderRouter(...)
                                       holds the API key
```

The backend comes in two forms: `@infobip/flowbuilder-sdk/server` is a Web Fetch handler (`createFlowBuilderHandler`) for any framework that speaks Fetch, and `@infobip/flowbuilder-sdk/server/express` is an Express router (`createFlowBuilderRouter`) that can be mounted at any path.

Options:

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | required | Your Infobip base URL, for example `https://xxxxx.api.infobip.com`. HTTPS only, except for local loopback mocks. |
| `apiKey` | `string` | | A fixed Infobip API key. Give this or `getApiKey`. |
| `getApiKey` | `(request, context) => string \| Promise<string>` | | The key per request, for example per tenant. |
| `sender` | `string` | | A fixed WhatsApp sender. Give this or `getSender`. |
| `getSender` | `(request, context) => string \| Promise<string>` | | The sender per request. |
| `authorize` | `(request, context) => boolean \| Response \| Promise<...>` | required | Decides whether a request may use your key. |
| `basePath` | `string` | `''` | Fetch handler only: the mount path. The Express router uses its mount path. |
| `logger` | `(entry) => void \| false` | one line per request | Receives `{ method, path, status, durationMs, code? }`. `false` turns logging off. |
| `bodyLimit` | `number \| string` | `5mb` | Largest request body. Larger gives `413 PAYLOAD_TOO_LARGE`. |
| `exposeUpstreamErrors` | `boolean` | `false` | Adds Infobip's raw error body as `detail` to error responses. Leave off in production. |
| `fetch` | `typeof fetch` | global `fetch` | Used for calls to Infobip (proxy, tests, tracing). |
| `saveRetryDelays` | `readonly number[]` | `[1000, 2000, 3000, 5000, 8000, 8000]` | Milliseconds to wait between retries of the flow JSON upload in `POST /save-flow`. Infobip answers `404` for a while after a flow is created, while it indexes it. |
| `allowedDownloadHosts` | `readonly string[]` | `baseUrl` host, `*.infobip.com`, `*.whatsapp.net`, `*.fbcdn.net` | Hosts the flow JSON may be downloaded from. Supplying it replaces the whole default list, so include every host you need. |

You must give `apiKey` or `getApiKey`, and `sender` or `getSender`. The factory throws a `TypeError` at construction if one is missing, and also if `authorize` is missing.

**`authorize`** runs before anything else, including reading the body:

| It returns | Result |
|---|---|
| `true` | The request proceeds. |
| A `Response` | That response is sent as is, for example your own `401`. |
| Anything else (`false`, `undefined`, ...) | `403` with `code: 'FORBIDDEN'`. |
| It throws | `500` with `code: 'AUTHORIZATION_ERROR'`. |

Check authentication and permission (who may manage flows), not only "is signed in". If an upstream proxy already authenticates every request, say so explicitly with `authorize: () => true`.

**Multi-tenant.** To use a different Infobip account or sender per customer, resolve them per request from the authenticated user, never from anything the browser sends freely:

```ts
createFlowBuilderRouter({
  baseUrl: process.env.INFOBIP_BASE_URL!,
  authorize: (_request, { req }) => Boolean((req as any).tenant),
  getApiKey: async (_request, { req }) => keyStore.getInfobipKey((req as any).tenant.id),
  getSender: async (_request, { req }) => (req as any).tenant.whatsappSender,
});
```

`getApiKey` and `getSender` run after `authorize` has passed, on each request. If `getApiKey` returns an empty value, the request fails with `500 CONFIGURATION_ERROR`. If users switch tenants in one browser tab, give each tenant its own browser storage namespace (the `storage-key` attribute on the web component).

**Routes.** The flow routes are mounted under `apiBaseUrl`: `GET /flows`, `POST /generate-flow`, `POST /save-flow`, `GET /flow/:flowId`, `DELETE /flow/:flowId`, `GET` and `PUT /flow/:flowId/json` (`PUT` is also reachable as `PUT /update-flow/:flowId`), `PATCH /update-flow/:flowId` (rename a flow and set its categories), `POST /publish-flow` and `GET /flow-preview/:flowId`. Each returns JSON.

**Errors** are JSON: `{ "error": "message", "code": "UPSTREAM_ERROR" }`. The codes are `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `BAD_REQUEST`, `INVALID_FLOW_ID`, `NOT_FOUND`, `FORBIDDEN`, `AUTHORIZATION_ERROR`, `CONFIGURATION_ERROR`, `UPSTREAM_UNREACHABLE`, `UPSTREAM_ERROR`, `UPSTREAM_INVALID_RESPONSE`, `FLOW_STILL_INDEXING`, `DOWNLOAD_URL_MISSING`, `DOWNLOAD_URL_INVALID`, `DOWNLOAD_HOST_NOT_ALLOWED`, `DOWNLOAD_TOO_MANY_REDIRECTS` and `INTERNAL_ERROR`.

The default logger writes one line per request (method, path, status, duration and the error code). It never writes bodies, headers, the API key or the query string.

## Theming

You can change the builder's colours, fonts, corner radii and shadows, replace the logo, and switch features off. None of this needs a rebuild.

```tsx
<FlowBuilder
  apiBaseUrl="/flowbuilder/api"
  theme={{
    mode: 'system', // 'light' | 'dark' | 'system'
    preset: 'default',
    tokens: { colorPrimary: '#0a7', colorAccent: '#7a3cff' },
    darkTokens: { colorAccent: '#a98aff' },
  }}
/>
```

- **Presets** are built-in looks (the `FlowBuilderPreset` type). The builder ships two: `default` and `indigo` — a cool blue-violet reference brand that retunes type, shape, borders and motion as well as colour: the interface speaks monospace, corners soften, near-black outlines become soft slate-indigo ones, secondary buttons turn into soft-filled chips and cards lift. Its file, `frontend/flow-builder/styles/brands/indigo.css`, is the worked example for [Adding a preset](#adding-a-preset). A preset set through `theme.preset` is forced rather than stored, and the Settings brand picker is hidden unless `features.brandPicker` is `true`. Your `tokens` sit on top of the preset.
- **Tokens** are the `--fb-*` design variables, written in camelCase (`colorPrimary` becomes `--fb-color-primary`). `tokens` applies to light mode and `darkTokens` overrides it in dark mode. The tokens are listed in `frontend/flow-builder/styles/theme.css`.
- **Values** must be plain CSS property values. A value containing `;`, `{`, `}`, `<`, `>`, `/*` or `url(` is dropped, so a token cannot close a declaration, inject markup or load a resource. Only known token names are accepted.
- **Brand colours repeat.** The default teal and orange appear in several tokens on purpose. To recolour the primary, change `colorPrimary`, `colorPrimarySoft`, `colorFocusRing` and the primary button tokens together.
- **Brand slots:** `brand={{ logo, productName, tagline }}` in React (`logo` is a React node there), or the `brand` property on the element (`logo` is a URL there). `productName` and `tagline` can also be set through `messages`.
- **Dark mode** follows `theme.mode`. Leave it unset to show a light/dark switch in the builder.

**Feature flags** hide UI. They do not change what the server allows: `delete` and `publish` are still permitted by the API unless your `authorize` function says otherwise.

| Flag | Default | Hides |
|---|---|---|
| `navigation` | `true` | The navigation rail. |
| `settings` | `true` | The Settings page. |
| `themeSwitch` | `true`, or `false` when `theme.mode` is set | The light/dark switch. |
| `brandPicker` | `true`, or `false` when `theme.preset` is set | The brand picker in Settings. |
| `chatHistoryBackup` | `true` | The chat history export and import in Settings. |
| `apiKeySettings` | `false` | The API-key section in Settings. It needs an endpoint that only the standalone app has, so leave it off when embedding. |
| `delete` | `true` | Deleting flows. |
| `publish` | `true` | Publishing flows. |

```tsx
<FlowBuilder apiBaseUrl="/flowbuilder/api" features={{ navigation: false, settings: false, delete: false }} />
```

### Adding a preset

A preset is a second look layered over the default one. It ships in the stylesheet and appears in **Settings > Appearance > Brand**. To add one:

1. Create `frontend/flow-builder/styles/brands/<name>.css`. Scope its selectors to `[data-flowbuilder-root][data-brand='<name>']` and override the `--fb-*` tokens from `theme.css`. Set every colour in both a light block and a dark block (the dark block adds `[data-theme='dark']`). The tests name any you miss. A brand is more than its palette: the other knobs `theme.css` advertises (`--fb-font-sans`/`--fb-font-mono`, `--fb-radius-*`, `--fb-shadow-card`/`--fb-shadow-popover`, the motion defaults) can go in the light block too — they are theme-independent, so one copy serves both modes.
2. Import it in `styles/app.css`, after `theme.css`.
3. Add `<name>` to `BRANDS` in `styles/tokens.ts`. TypeScript then asks for the rest: the Settings label and tab icon in `BRAND_LABEL_KEYS` and `BRAND_ICONS` (`components/theme/brand.ts`), and the nav-rail logo in `BRAND_LOGOS` (`app/FlowBuilderShell.tsx`).
4. Run `npm run build:frontend` and `npm run test:frontend`.

## Internationalisation

The `locale` prop (a BCP 47 tag, for example `'de'`) sets number and date formatting. The `messages` prop overrides any string in the interface, including validation messages and API error messages. Message values are shown as plain text, never as HTML. Missing keys fall back to English.

## Security

What the builder protects, and what it needs from you:

- **The API key stays on the server.** It is set only in the server options. The browser code has no field for it, the server never returns it, and it is sent only in the `Authorization` header of requests to your `baseUrl`. Do not put it in any client-side setting or in a variable your bundler exposes to the browser (for example `NEXT_PUBLIC_*` or `VITE_*`). The flow JSON download follows a link from Infobip and is fetched without the key.
- **`authorize` is required.** Every route spends your key and creates or deletes flows on your sender. Protect the route with your session or token middleware. For cookie sessions, use CSRF protection: the write routes take `application/json`, so require that content type and a custom header or a same-site cookie policy. The `getHeaders` prop can add a CSRF header.
- **Per-tenant keys.** A single shared key lets any user who passes `authorize` see and change every flow on that sender. If each customer has an account of their own, resolve the key from the authenticated user, as shown in [Server](#server).
- **Rate limiting.** The package does not limit request rates, and `generate-flow` calls Infobip's AI and costs money. Limit requests per user or per IP in your own app or gateway, in front of the route.
- **Body limit.** JSON bodies are capped by `bodyLimit` (default 5 MB) and read only after `authorize` passes. If you mount `express.json()` before the router, the Express parser's limit applies instead.
- **Flow download allowlist.** The server only downloads the flow file from an `https` host on `allowedDownloadHosts`, so a response cannot point it at an internal address. Redirects are followed by hand and each hop is checked. Add hosts only when you are sure they belong to Infobip or Meta. The standalone app reads extra hosts from `FLOW_DOWNLOAD_HOSTS`.
- **Upstream errors.** `exposeUpstreamErrors` adds Infobip's raw error body to responses. It can contain account details, so keep it off in production.
- **Content Security Policy.** The builder has no `eval`, no `new Function`, no `dangerouslySetInnerHTML` and no runtime `<style>` elements, so `'unsafe-eval'` and `'unsafe-inline'` are not needed for client rendering. Serve `styles.css` and the fonts from your own origin. A starting policy for a page that serves everything itself:

  ```
  default-src 'self';
  script-src 'self';
  style-src 'self';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  frame-src https://<your-infobip-preview-origin>;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'self'
  ```

  Replace `<your-infobip-preview-origin>` with the origin of the preview URL your account returns (for example, the address of the preview iframe once you have opened a flow's preview). Server-side rendering of the builder emits `style` attributes, which need `style-src-attr 'unsafe-inline'`.
- **Logging.** The default logger never writes bodies, headers, the API key or the query string. Do not log flow bodies yourself, because they contain the user's prompts and message text.

## Validator

The editor checks every flow with `validateFlow`, and you can use the same function in your own code. It is exported from the package root:

```ts
import { validateFlow, FLOW_VALIDATION_ERROR_CODES } from '@infobip/flowbuilder-sdk';

const result = validateFlow(flow);
if (!result.valid) {
  for (const error of result.errors) console.error(`[${error.path}] ${error.code}: ${error.message}`);
}
```

It checks that `version` is present; that there is at least one screen, with unique `id`s, a `title` and a layout with components; that input names are unique per screen; that a `terminal` screen exists; that every Footer has an `on-click-action` and every `navigate` target names an existing screen; and that `data-source` arrays are not empty. Components inside `If` branches are checked too. Each problem has a stable `code`.

## Try an embedded example

[examples/](examples/) has three hosts that embed the builder the way a product would: an Express server with a demo login, a React/esbuild page and a plain HTML page. From the repository root:

```bash
npm run examples:prepare                 # build, pack and install the package into the examples
FLOWBUILDER_FAKE_UPSTREAM=1 node examples/express-host/server.mjs
```

Open http://127.0.0.1:4100/ and log in as the demo user. `FLOWBUILDER_FAKE_UPSTREAM=1` uses an in-memory fake instead of Infobip, so no API key is needed. Without it, set `INFOBIP_*` in `.env`. See [examples/express-host/README.md](examples/express-host/README.md). `npm run examples:verify` drives both embedded pages in headless Chromium; it needs `playwright-core` installed separately (`npm install playwright-core` and `npx playwright install chromium`, or point `PLAYWRIGHT_CORE` and `CHROMIUM_PATH` at existing copies).

## Running the standalone app

The repository is also a ready-to-run app: it lists the flows on a sender, generates new ones, and gives you the editor and preview, served by `server.js`. Use it to try the builder, or as a local tool. It is not the way to embed the builder in a product.

```bash
cp .env.example .env
# set INFOBIP_BASE_URL, INFOBIP_API_KEY and INFOBIP_SENDER

npm install
npm start
# -> http://localhost:3000, or https://localhost:3000 when certs exist
```

`npm start` builds the server and the frontend first, so a fresh clone needs no separate build step.

| Variable | Description |
|---|---|
| `INFOBIP_BASE_URL` | Your Infobip base URL, for example `https://xyz.api.infobip.com` (required) |
| `INFOBIP_API_KEY` | API key from the Infobip portal (required) |
| `INFOBIP_SENDER` | Your registered WhatsApp sender number (required) |
| `JSON_BODY_LIMIT` | Largest JSON request accepted (default `100mb`) |
| `FLOW_DOWNLOAD_HOSTS` | Comma-separated extra hosts the flow JSON may be downloaded from (`*.example.com` allowed), on top of the `INFOBIP_BASE_URL` host, `*.infobip.com`, `*.whatsapp.net` and `*.fbcdn.net`. Set it if loading a flow fails with "Flow JSON download from ... is not allowed". |
| `PORT` | Port to listen on (default `3000`) |
| `HOST` | Interface to listen on (default `127.0.0.1`, this machine only) |

**HTTPS.** WhatsApp's preview iframe requires HTTPS. Run `npm run generate-cert` to create a self-signed certificate in `certs/` (`cert.pem` and `key.pem`); the server uses HTTPS when both exist. On first visit, click "Advanced" and proceed to localhost to trust it.

**No login.** The standalone server has no login. Its `/api/*` routes, including the API-key settings page, answer only requests from the machine it runs on (`403 FORBIDDEN` otherwise), whatever `HOST` is. Setting `HOST` lets other machines load the page, but not use the API. Do not expose it to a network. For shared use, embed the router in your own authenticated app (see [Server](#server)).

**Development.** `npm run dev:frontend` watch-builds the frontend unminified, `npm run build` compiles everything the package ships, and `npm run build:element` builds the web component. `npm run typecheck`, `npm run typecheck:frontend` and `npm run typecheck:server` type-check the sources, and `npm run test:frontend` runs the frontend, validator and server tests. Tokens are defined in `frontend/flow-builder/styles/theme.css`.

## Browser support

Safari 16.4+, Chrome 111+ and Firefox 128+. Older browsers are not supported.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for details.

The bundled IBM Plex fonts are licensed under the SIL Open Font License 1.1. The stylesheet `frontend/flow-builder/styles/preflight.css` derives from Tailwind CSS, which is licensed under the MIT License. See [NOTICE](NOTICE).
