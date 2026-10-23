# express-host

An Express server that hosts the Flow Builder the way a real product would: it mounts the SDK's
`createFlowBuilderRouter` behind its own login and serves two pages that embed the builder.

```
npm run examples:prepare      # from the repo root: build, pack, install the tarball into the examples
node examples/express-host/server.mjs
```

Open http://127.0.0.1:4100/ (set `PORT` to change it), then log in as the demo user.

- `/flowbuilder/api` is the SDK router. `authorize` answers 401 until the demo session cookie exists.
- `/react/` is `examples/react-esbuild-host` (build it with `npm run build` in that folder).
- `/html/` is `examples/html-host`, using `/vendor/flowbuilder/standalone.js` and `/vendor/fonts/*`.
- Credentials come from the repo `.env` (`INFOBIP_*`) and are never printed.
- `FLOWBUILDER_FAKE_UPSTREAM=1` swaps Infobip for an in-memory fake (two seeded flows, a mocked
  generate-flow), so you can create, save, publish and delete without touching a real sender.

`npm run examples:verify` starts this server and drives both pages in headless Chromium.
