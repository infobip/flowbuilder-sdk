/*
 * Copyright 2026 INFOBIP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Standalone host for the AI Flow Builder: serves the web app and mounts the
// Flow Builder backend (`server/`, compiled to `dist/server/`) at /api.
//
// `npm start` compiles `server/` and the frontend before running this file
// (see `prestart` in package.json). Running `node server.js` directly needs a
// prior `npm run build:server`.
import "dotenv/config";
import express from "express";
import compression from "compression";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let flowBuilderServer;
try {
  flowBuilderServer = await import("./dist/server/index.js");
} catch (err) {
  if (err?.code !== "ERR_MODULE_NOT_FOUND") throw err;
  console.error("dist/server/ is missing. Run `npm start`, or `npm run build:server` before `node server.js`.");
  process.exit(1);
}
const { createFlowBuilderRouter, normalizeApiKey, DEFAULT_DOWNLOAD_HOSTS } = flowBuilderServer;

const { INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SENDER } = process.env;

if (!INFOBIP_BASE_URL || !INFOBIP_API_KEY || !INFOBIP_SENDER) {
  console.error("Missing required env vars. Check your .env file:");
  console.error("  INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SENDER");
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3000;
// Loopback only unless HOST says otherwise. The /api/* routes also refuse
// requests that don't come from this machine (see `isLocalRequest`), because
// they spend the Infobip key without a login of their own.
const HOST = process.env.HOST || "127.0.0.1";

app.use(compression());

const frontendDir = path.join(__dirname, "frontend");

app.get("/", (_, res) => res.sendFile(path.join(frontendDir, "index.html")));

// ── API key override ───────────────────────────────────────────────
// The Infobip key normally comes from the environment and never leaves this
// process. The settings page can point the app at a different key without an
// edit-and-restart cycle: the override lives in memory only, so it is never
// written to disk and is gone when the process exits. The raw value is never
// sent back to the client.
//
// This is a feature of the standalone app only. It is process-wide, so the
// embeddable handler in `server/` doesn't offer it.
let apiKeyOverride = null;

function activeApiKey() {
  return apiKeyOverride ?? INFOBIP_API_KEY;
}

// What the settings page is allowed to know: which key is in play, and just
// enough of it to recognize. Four trailing characters is the usual "last 4"
// affordance; anything short enough that four characters would give away most
// of it gets no hint at all.
const MIN_HINTABLE_KEY_LENGTH = 12;

function apiKeyStatus() {
  const key = activeApiKey();
  return {
    source: apiKeyOverride ? "override" : "env",
    hint: key.length >= MIN_HINTABLE_KEY_LENGTH ? key.slice(-4) : "",
  };
}

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// The address comes from the socket rather than `req.ip` so a forwarded-for
// header can't fake it.
function isLocalRequest(req) {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress);
}

// The settings routes are the only ones that *write* the credential. Off-box
// they would let anyone repoint this server at their own Infobip account, or
// use the verification step to probe whether some key they hold can read this
// sender's flows.
function requireLocalRequest(req, res, next) {
  if (isLocalRequest(req)) return next();
  res.status(403).json({ error: "API key settings are only available on the machine running this server." });
}

// Try a candidate key against the flows list before committing it. Resolves
// with the HTTP status Infobip answered with, or throws if it is unreachable.
async function verifyApiKey(apiKey) {
  const url = `${INFOBIP_BASE_URL.replace(/\/+$/, "")}/whatsapp/1/senders/${encodeURIComponent(INFOBIP_SENDER)}/flows`;
  const res = await fetch(url, {
    headers: { Authorization: `App ${apiKey}`, Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, message: data?.requestError?.serviceException?.text || `HTTP ${res.status}` };
}

const settingsJson = express.json({ limit: "16kb" });

// ── GET /api/settings/api-key ──────────────────────────────────────
// Response: { source: "env" | "override", hint }
app.get("/api/settings/api-key", requireLocalRequest, (_, res) => res.json(apiKeyStatus()));

// ── PUT /api/settings/api-key ──────────────────────────────────────
// Body: { apiKey } — replaces the key for this process.
//
// The candidate is tried against Infobip before it is committed. Without that,
// a single typo would break every request until someone restarts the server,
// and the failures would show up far away from the screen that caused them.
app.put("/api/settings/api-key", requireLocalRequest, settingsJson, async (req, res) => {
  const apiKey = normalizeApiKey(req.body?.apiKey);
  if (!apiKey) return res.status(400).json({ error: "apiKey is required" });

  let result;
  try {
    result = await verifyApiKey(apiKey);
  } catch (err) {
    return res.status(502).json({ error: `Couldn't verify that API key: ${err.message}` });
  }

  if (result.status === 401 || result.status === 403) {
    return res.status(401).json({ error: "Infobip rejected that API key." });
  }
  // A 404 means the key authenticated but cannot see INFOBIP_SENDER, so
  // blaming the key would send the user looking in the wrong place.
  if (result.status === 404) {
    return res.status(400).json({ error: `That key works, but it has no access to sender ${INFOBIP_SENDER}.` });
  }
  if (result.status < 200 || result.status >= 300) {
    return res.status(result.status).json({ error: `Couldn't verify that API key: ${result.message}` });
  }

  apiKeyOverride = apiKey;
  res.json(apiKeyStatus());
});

// ── DELETE /api/settings/api-key ───────────────────────────────────
// Drops the override and goes back to INFOBIP_API_KEY.
app.delete("/api/settings/api-key", requireLocalRequest, (_, res) => {
  apiKeyOverride = null;
  res.json(apiKeyStatus());
});

// ── Flow routes ────────────────────────────────────────────────────
// Everything else under /api comes from the embeddable handler. Its
// `authorize` is the same loopback check: this host has no login, so only the
// machine running it may spend the key.
app.use("/api", createFlowBuilderRouter({
  baseUrl: INFOBIP_BASE_URL,
  getApiKey: () => activeApiKey(),
  sender: INFOBIP_SENDER,
  bodyLimit: process.env.JSON_BODY_LIMIT || "100mb",
  // Extra hosts (comma-separated) the flow JSON may be downloaded from, on top
  // of the INFOBIP_BASE_URL host and DEFAULT_DOWNLOAD_HOSTS.
  ...(process.env.FLOW_DOWNLOAD_HOSTS && {
    allowedDownloadHosts: [
      new URL(INFOBIP_BASE_URL).hostname,
      ...DEFAULT_DOWNLOAD_HOSTS,
      ...process.env.FLOW_DOWNLOAD_HOSTS.split(",").map((host) => host.trim()).filter(Boolean),
    ],
  }),
  // Detail helps when debugging against a real sender; this host only ever
  // answers the machine it runs on.
  exposeUpstreamErrors: true,
  authorize: (_request, { req }) => isLocalRequest(req) || new Response(
    JSON.stringify({ error: "The Flow Builder API is only available on the machine running this server.", code: "FORBIDDEN" }),
    { status: 403, headers: { "Content-Type": "application/json; charset=utf-8" } },
  ),
}));

// Static assets (after all API routes so Express 5 static 404 doesn't shadow them).
// Only /frontend is served — the repo root is deliberately not exposed.
app.use("/frontend", express.static("frontend"));

// ── Start ──────────────────────────────────────────────────────────
const certPath = path.join(__dirname, "certs", "cert.pem");
const keyPath  = path.join(__dirname, "certs", "key.pem");

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const credentials = {
    key:  fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  https.createServer(credentials, app).listen(PORT, HOST, () => {
    console.log(`\nFlow Builder server running at https://localhost:${PORT}`);
    console.log(`  Base URL : ${INFOBIP_BASE_URL}`);
    console.log(`  Sender   : ${INFOBIP_SENDER}`);
    console.log(`\nOpen https://localhost:${PORT}/`);
    console.log(`\n⚠️  First visit: browser will warn about self-signed cert.`);
    console.log(`   Click "Advanced" → "Proceed to localhost" to continue.\n`);
  });
} else {
  app.listen(PORT, HOST, () => {
    console.log(`\nFlow Builder server running at http://localhost:${PORT}`);
    console.log(`  (no certs found in ./certs — run: npm run generate-cert)`);
    console.log(`\nOpen http://localhost:${PORT}/\n`);
  });
}
