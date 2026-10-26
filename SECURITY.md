# Security Policy

## Reporting a vulnerability

Report security vulnerabilities privately through **GitHub Security Advisories** on this repository (Security → Report a vulnerability). Do not open a public issue for a security problem. We aim to acknowledge private reports within five working days and to ship a fix or a documented mitigation in a supported release.

The builder itself is in scope. The Infobip platform, the WhatsApp Flow Management API and the Meta-hosted flow preview are upstream services: report problems with those through [Infobip support](https://www.infobip.com/support), not here.

## Supported versions

The latest released version is supported with security fixes. Older minor versions are fixed forward rather than backported.

## What this project already guarantees

The design keeps the dangerous parts away from the browser. Before you deploy, read the [Security section of the README](README.md#security); the short version:

- **The Infobip API key never leaves your server.** The browser bundle has no field for it, the proxy never returns it, and it is sent only in the `Authorization` header to the configured `baseUrl`.
- **`authorize` is required** on the server handler. Every route spends API credit or changes flows, so it runs behind whatever session or token middleware your application has.
- **Request hard limits.** Flow IDs, request bodies and the flow-file download host are all validated; JSON bodies are capped (`bodyLimit`, 5 MB default).
- **CSP-friendly by construction.** No `eval`, no `new Function`, no `dangerouslySetInnerHTML`, no runtime `<style>` elements, and the shipped stylesheet cannot restyle a host page.
- **Scoped CSS and storage.** The UI is confined to `[data-flowbuilder-root]`; per-instance storage keeps several builders on one page apart.

## Your responsibilities when deploying

Run `authorize` behind real authentication, add CSRF protection for cookie sessions, rate-limit `generate-flow` (it calls a paid AI endpoint), keep `exposeUpstreamErrors` off in production, use per-tenant API keys when your users belong to different accounts, and serve the app over HTTPS. The README walks through each of these.
