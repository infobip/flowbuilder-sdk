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

// The Flow Builder backend as a Web Fetch handler.
//
// `createFlowBuilderHandler()` proxies the Infobip WhatsApp Flow Management API
// for the Flow Builder frontend. It holds the Infobip API key server-side, so
// the browser never sees it, and it runs anywhere that speaks
// `(Request) => Promise<Response>`: Next.js route handlers, Hono, Remix, Bun,
// Deno, or Express through `createFlowBuilderRouter()` in `./express`.
//
// The routes, request bodies and response shapes are the contract the
// frontend's service layer (`frontend/api.ts`, `frontend/services/`) relies on,
// so they must not change shape. Paths are relative to wherever the handler is
// mounted (`basePath` for the Fetch handler, the mount path for Express).

export type Awaitable<T> = T | Promise<T>;

/** One line per handled request. Never contains bodies, headers or keys. */
export interface FlowBuilderLogEntry {
  method: string;
  /** Request path without the query string. */
  path: string;
  status: number;
  durationMs: number;
  /** The `code` of the error response, when the request failed. */
  code?: string;
}

export type FlowBuilderLogger = (entry: FlowBuilderLogEntry) => void;

export interface FlowBuilderHandlerOptions<TContext = unknown> {
  /** Your Infobip base URL, e.g. `https://xyz.api.infobip.com`. */
  baseUrl: string;

  /** A fixed Infobip API key. Give this or `getApiKey`. A leading `App ` is stripped. */
  apiKey?: string;
  /** Resolve the Infobip API key per request, e.g. per tenant. Give this or `apiKey`. */
  getApiKey?: (request: Request, context: TContext) => Awaitable<string>;

  /** A fixed WhatsApp sender. Give this or `getSender`. */
  sender?: string;
  /** Resolve the WhatsApp sender per request, e.g. per tenant. Give this or `sender`. */
  getSender?: (request: Request, context: TContext) => Awaitable<string>;

  /**
   * Decide whether a request may use the Infobip key. Required: every route
   * spends your key, so it has to sit behind your own auth.
   *
   * Return `true` to allow. Any other value denies with `403`. Return a
   * `Response` to send that instead (for example a `401` with your own
   * `WWW-Authenticate`). If it throws, the request fails with `500`.
   *
   * To accept every request (for example when an upstream proxy already
   * authenticates), opt out explicitly with `authorize: () => true`.
   */
  authorize: (request: Request, context: TContext) => Awaitable<boolean | Response>;

  /**
   * The path the Fetch handler is mounted at, e.g. `/api/flowbuilder`. Requests
   * outside it get `404`. Defaults to `""` (routes at `/flows`, `/save-flow`, ...).
   * The Express router ignores this and uses its mount path instead.
   */
  basePath?: string;

  /** Request logger. Defaults to one `console.log` line per request. `false` disables logging. */
  logger?: FlowBuilderLogger | false;

  /** Largest accepted request body, in bytes or as `"5mb"`/`"500kb"`. Defaults to 5 MB; larger bodies get `413`. */
  bodyLimit?: number | string;

  /**
   * Include the raw upstream error body as `detail` in error responses.
   * Defaults to `false`: clients get `{ error, code }` only.
   */
  exposeUpstreamErrors?: boolean;

  /** The `fetch` used to call Infobip. Defaults to the global `fetch`. */
  fetch?: typeof fetch;

  /**
   * Waits, in milliseconds, between retries of the flow JSON upload in
   * `POST /save-flow`. Infobip answers `404` for a while after a flow is
   * created, while it indexes it. Defaults to `[1000, 2000, 3000, 5000, 8000, 8000]`.
   */
  saveRetryDelays?: readonly number[];

  /**
   * Hosts `GET /flow/:flowId/json` may download the flow JSON from. Infobip
   * answers that route with a download URL, which is fetched without the API
   * key. Entries are exact hostnames, or `*.example.com` for any subdomain.
   * Defaults to the host of `baseUrl` plus {@link DEFAULT_DOWNLOAD_HOSTS}. Other hosts get `502`.
   */
  allowedDownloadHosts?: readonly string[];
}

/** A Web Fetch handler. `context` is passed through to `authorize`, `getApiKey` and `getSender`. */
export type FlowBuilderHandler<TContext = unknown> = (request: Request, context?: TContext) => Promise<Response>;

export const DEFAULT_BODY_LIMIT = 5 * 1024 * 1024;
export const DEFAULT_SAVE_RETRY_DELAYS: readonly number[] = [1000, 2000, 3000, 5000, 8000, 8000];
/**
 * Download hosts allowed on top of the host of `baseUrl`. Infobip hands back
 * the flow JSON as a link to WhatsApp's media CDN (`mmg.whatsapp.net`, seen
 * against a live sender); `*.fbcdn.net` is Meta's other media host. Infobip's
 * own services sit under `infobip.com`.
 */
export const DEFAULT_DOWNLOAD_HOSTS: readonly string[] = ["*.infobip.com", "*.whatsapp.net", "*.fbcdn.net"];

// ── Errors ─────────────────────────────────────────────────────────

/** An error that becomes a JSON error response: `{ error, code, detail? }`. */
export class FlowBuilderHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: unknown;

  constructor(status: number, message: string, code: string, detail?: unknown) {
    super(message);
    this.name = "FlowBuilderHttpError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// ── Pure helpers ───────────────────────────────────────────────────

// Flow IDs are spliced into the Infobip URL, so a `/`, `..` or `?` in one
// would steer the request, with the API key attached, to some other Infobip
// endpoint.
const FLOW_ID = /^[A-Za-z0-9_-]+$/;

export function isFlowId(value: unknown): value is string {
  return typeof value === "string" && FLOW_ID.test(value);
}

const AUTH_SCHEME = /^app\s+/i;

// Accept the bare key or the whole `App <key>` Authorization value people copy
// out of the docs. Keys never contain whitespace, so a leading `App ` can only
// be the scheme.
export function normalizeApiKey(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(AUTH_SCHEME, "").trim() : "";
}

function extractResponseId(payload: any): unknown {
  return payload?.responseId || payload?.responseID || payload?.requestId || payload?.requestID || payload?.id || null;
}

// Infobip caps the flow `name` at 200 chars. The generation responseId is
// stashed in the name as `name##responseId`, so when the pair is too long only
// the human-readable base is truncated and the responseId stays intact (the
// client splits on the first `##` to recover it).
const MAX_FLOW_NAME_LENGTH = 200;

export function decorateFlowName(name: unknown, responseId: unknown): string {
  const base = String(name ?? "").trim() || "Untitled flow";
  const rid = responseId ? String(responseId).trim() : "";
  if (!rid) return base.slice(0, MAX_FLOW_NAME_LENGTH);

  const suffix = `##${rid}`;
  const room = MAX_FLOW_NAME_LENGTH - suffix.length;
  if (room <= 0) return suffix;
  const safeBase = base.slice(0, room).trimEnd() || base.slice(0, room);
  return `${safeBase}${suffix}`;
}

function extractFlowDownloadUrl(result: any): unknown {
  return result?.externalDownloadUrl || result?.downloadUrl || result?.url || null;
}

function upstreamMessage(data: unknown, status: number): string {
  const text = data && typeof data === "object" && !Array.isArray(data)
    ? (data as any)?.requestError?.serviceException?.text
    : undefined;
  return text ? String(text) : `HTTP ${status}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const BYTE_UNITS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/** `5242880`, `"5mb"`, `"500kb"` → bytes. Same units as Express's `limit`. */
export function parseByteSize(value: number | string): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value);
  const match = typeof value === "string" ? /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(value) : null;
  if (!match) throw new TypeError(`Invalid body size: ${String(value)}`);
  return Math.floor(Number(match[1]) * BYTE_UNITS[(match[2] ?? "b").toLowerCase()]);
}

function hostMatches(hostname: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (p.startsWith("*.")) return hostname.endsWith(p.slice(1));
  return hostname === p;
}

// ── Body reading ───────────────────────────────────────────────────

const JSON_CONTENT_TYPE = /^application\/(?:[\w.+-]+\+)?json\s*(?:;|$)/i;

/** @internal */
export function isJsonContentType(contentType: string | null | undefined): boolean {
  return typeof contentType === "string" && JSON_CONTENT_TYPE.test(contentType);
}

/**
 * Read a JSON request body of at most `limit` bytes. Bodies that aren't
 * declared as JSON are ignored (`undefined`), like Express's `json()` parser.
 * @internal
 */
export async function readJsonBody(
  contentType: string | null | undefined,
  contentLength: string | null | undefined,
  chunks: AsyncIterable<Uint8Array | string> | null,
  limit: number,
): Promise<unknown> {
  if (!chunks || !isJsonContentType(contentType)) return undefined;

  const declared = contentLength ? Number(contentLength) : NaN;
  if (Number.isFinite(declared) && declared > limit) throw payloadTooLarge();

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    size += bytes.byteLength;
    if (size > limit) throw payloadTooLarge();
    parts.push(bytes);
  }

  const all = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.byteLength;
  }
  const text = new TextDecoder().decode(all);
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new FlowBuilderHttpError(400, "Request body is not valid JSON", "INVALID_JSON");
  }
}

function payloadTooLarge() {
  return new FlowBuilderHttpError(413, "Request body is too large", "PAYLOAD_TOO_LARGE");
}

async function* streamChunks(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Routes ─────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RouteContext {
  /** The validated `:flowId` path param, when the route has one. */
  flowId: string;
  /** The parsed JSON body (`undefined` when there is none). */
  body: any;
  infobip(method: Method, path: string, body?: unknown): Promise<any>;
  /** `/whatsapp/1/senders/{sender}/flows`, with the sender URL-encoded. */
  flowsPath(): Promise<string>;
  downloadJson(url: string): Promise<unknown>;
  saveRetryDelays: readonly number[];
}

interface Route {
  method: Method;
  /** Path segments; `:flowId` captures one segment. */
  segments: string[];
  hasBody: boolean;
  run(ctx: RouteContext): Promise<Response>;
}

function route(method: Method, path: string, run: Route["run"]): Route {
  return {
    method,
    segments: path.split("/").filter(Boolean),
    hasBody: method !== "GET" && method !== "DELETE",
    run,
  };
}

function requireFlowJson(flow: unknown) {
  if (!flow || typeof flow !== "object" || Array.isArray(flow) || Object.keys(flow).length === 0) {
    throw new FlowBuilderHttpError(400, "flow JSON body is required", "BAD_REQUEST");
  }
}

async function putFlowJson(ctx: RouteContext): Promise<Response> {
  requireFlowJson(ctx.body);
  const result = await ctx.infobip("PUT", `${await ctx.flowsPath()}/${ctx.flowId}/json`, ctx.body);
  return jsonResponse(200, { id: ctx.flowId, validationErrors: result?.validationErrors ?? [], infobip: result });
}

const ROUTES: Route[] = [
  // GET /flows → { flows }
  route("GET", "/flows", async (ctx) => {
    return jsonResponse(200, await ctx.infobip("GET", await ctx.flowsPath()));
  }),

  // POST /generate-flow  { prompt, responseId? } → { flow, responseId, infobip }
  route("POST", "/generate-flow", async (ctx) => {
    const { prompt, responseId } = ctx.body ?? {};
    if (!prompt) throw new FlowBuilderHttpError(400, "prompt is required", "BAD_REQUEST");

    const body = responseId ? { prompt, responseId } : { prompt };
    const result = await ctx.infobip("POST", `${await ctx.flowsPath()}/generate`, body);
    return jsonResponse(200, {
      flow: result?.generatedFlow ?? result?.flow,
      responseId: extractResponseId(result),
      infobip: result,
    });
  }),

  // POST /save-flow  { name, category, flow, responseId? }
  // 1. Creates the flow shell (name + category).
  // 2. Uploads the flow JSON to it, retrying while Infobip indexes the new flow.
  // → { id, name, responseId, validationErrors, infobip }
  route("POST", "/save-flow", async (ctx) => {
    const { name, category, flow, responseId } = ctx.body ?? {};
    if (!name || !category || !flow) {
      throw new FlowBuilderHttpError(400, "name, category, and flow are required", "BAD_REQUEST");
    }

    const decoratedName = decorateFlowName(name, responseId);
    const flowsPath = await ctx.flowsPath();
    const created = await ctx.infobip("POST", flowsPath, { name: decoratedName, categories: [category] });

    const createdId = typeof created?.id === "number" ? String(created.id) : created?.id;
    if (!isFlowId(createdId)) {
      throw new FlowBuilderHttpError(502, "Infobip did not return a valid flow id", "UPSTREAM_INVALID_RESPONSE", created);
    }

    const delays = ctx.saveRetryDelays;
    for (let attempt = 0; ; attempt++) {
      try {
        const jsonResult = await ctx.infobip("PUT", `${flowsPath}/${createdId}/json`, flow);
        return jsonResponse(200, {
          id: created.id,
          name: decoratedName,
          responseId,
          validationErrors: jsonResult?.validationErrors ?? [],
          infobip: created,
        });
      } catch (err) {
        const is404 = err instanceof FlowBuilderHttpError && err.status === 404;
        if (is404 && attempt < delays.length) {
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
          continue;
        }
        // The shell exists even though the JSON upload never landed. Say so for
        // the indexing-lag 404, so the client can suggest saving again.
        if (is404) {
          throw new FlowBuilderHttpError(
            503,
            "Flow was created but is still being indexed by Infobip. Try saving again in a few seconds.",
            "FLOW_STILL_INDEXING",
            err.detail,
          );
        }
        throw err;
      }
    }
  }),

  // PUT /update-flow/:flowId  <flow JSON> → { id, validationErrors, infobip }
  route("PUT", "/update-flow/:flowId", putFlowJson),

  // GET /flow/:flowId/json → the flow JSON, downloaded from the URL Infobip returns
  route("GET", "/flow/:flowId/json", async (ctx) => {
    const result = await ctx.infobip("GET", `${await ctx.flowsPath()}/${ctx.flowId}/json`);
    const downloadUrl = extractFlowDownloadUrl(result);
    if (!downloadUrl || typeof downloadUrl !== "string") {
      throw new FlowBuilderHttpError(502, "externalDownloadUrl is missing", "DOWNLOAD_URL_MISSING", result);
    }
    return jsonResponse(200, await ctx.downloadJson(downloadUrl));
  }),

  // PUT /flow/:flowId/json  <flow JSON> → { id, validationErrors, infobip }
  route("PUT", "/flow/:flowId/json", putFlowJson),

  // PATCH /update-flow/:flowId  { name?, categories? } → { id, validationErrors, infobip }
  route("PATCH", "/update-flow/:flowId", async (ctx) => {
    const { name, categories } = ctx.body ?? {};
    const update: { name?: string; categories?: unknown[] } = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (Array.isArray(categories) && categories.length > 0) update.categories = categories;
    if (Object.keys(update).length === 0) {
      throw new FlowBuilderHttpError(400, "name or categories are required", "BAD_REQUEST");
    }

    const result = await ctx.infobip("PATCH", `${await ctx.flowsPath()}/${ctx.flowId}`, update);
    return jsonResponse(200, { id: ctx.flowId, validationErrors: result?.validationErrors ?? [], infobip: result });
  }),

  // GET /flow-preview/:flowId → { previewUrl, expiresAt }
  route("GET", "/flow-preview/:flowId", async (ctx) => {
    return jsonResponse(200, await ctx.infobip("GET", `${await ctx.flowsPath()}/${ctx.flowId}/preview`));
  }),

  // POST /publish-flow  { flowId } → Infobip's publish response
  route("POST", "/publish-flow", async (ctx) => {
    const { flowId } = ctx.body ?? {};
    if (!flowId) throw new FlowBuilderHttpError(400, "flowId is required", "BAD_REQUEST");
    if (!isFlowId(flowId)) throw new FlowBuilderHttpError(400, "Invalid flowId", "INVALID_FLOW_ID");
    return jsonResponse(200, await ctx.infobip("POST", `${await ctx.flowsPath()}/${flowId}/publish`));
  }),

  // GET /flow/:flowId → the flow's metadata. Infobip has no reliable
  // single-flow GET, so the entry is taken from the flows list.
  route("GET", "/flow/:flowId", async (ctx) => {
    const flowsPath = await ctx.flowsPath();
    const result = await ctx.infobip("GET", flowsPath);
    const flow = Array.isArray(result?.flows)
      ? result.flows.find((item: any) => item && item.id === ctx.flowId)
      : null;
    if (!flow) {
      // The frontend recognises this message and falls back to the list.
      throw new FlowBuilderHttpError(404, `Requested URL not found: ${flowsPath}/${ctx.flowId}`, "NOT_FOUND", result);
    }
    return jsonResponse(200, flow);
  }),

  // DELETE /flow/:flowId → { id, status: "DELETED", infobip }. Infobip may
  // answer with an empty body, so the acknowledgement is synthesised.
  route("DELETE", "/flow/:flowId", async (ctx) => {
    const result = await ctx.infobip("DELETE", `${await ctx.flowsPath()}/${ctx.flowId}`);
    return jsonResponse(200, { id: ctx.flowId, status: "DELETED", infobip: result });
  }),
];

interface RouteMatch {
  route: Route;
  /** Raw (still percent-encoded) `:flowId` segment, if the route has one. */
  rawFlowId?: string;
}

// Matching follows Express's defaults, so mounting through either adapter
// behaves the same: literal segments are case-insensitive and one trailing
// slash is ignored.
function matchRoute(method: string, routePath: string): RouteMatch | null {
  const trimmed = routePath.length > 1 ? routePath.replace(/\/$/, "") : routePath;
  if (!trimmed.startsWith("/")) return null;
  const parts = trimmed.slice(1).split("/");

  for (const candidate of ROUTES) {
    if (candidate.method !== method.toUpperCase()) continue;
    if (candidate.segments.length !== parts.length) continue;

    let rawFlowId: string | undefined;
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const segment = candidate.segments[i];
      if (segment === ":flowId") {
        if (!parts[i]) { ok = false; break; }
        rawFlowId = parts[i];
      } else if (segment !== parts[i].toLowerCase()) {
        ok = false;
        break;
      }
    }
    if (ok) return { route: candidate, rawFlowId };
  }
  return null;
}

function decodeFlowId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// ── The core ───────────────────────────────────────────────────────

/** @internal What an adapter hands the core for one request. */
export interface FlowBuilderDispatchInput<TContext> {
  /** Passed to `authorize`, `getApiKey` and `getSender`. */
  request: Request;
  context: TContext;
  /** Path relative to the mount point, without the query string. */
  routePath: string;
  /** Path for the log line. */
  logPath: string;
  /** Read and parse the JSON body. Called only after `authorize` allowed the request. */
  readBody(limit: number): Promise<unknown>;
}

/** @internal Shared by the Fetch handler and the Express router. */
export interface FlowBuilderCore<TContext> {
  readonly bodyLimit: number;
  /** Handle a request, or resolve `null` when no route matches it. */
  dispatch(input: FlowBuilderDispatchInput<TContext>): Promise<Response | null>;
  /** Build an error response with the configured redaction. */
  errorResponse(err: unknown): Response;
  log(entry: FlowBuilderLogEntry): void;
}

const defaultLogger: FlowBuilderLogger = (entry) => {
  console.log(`[flowbuilder] ${entry.method} ${entry.path} ${entry.status} ${entry.durationMs}ms${entry.code ? ` ${entry.code}` : ""}`);
};

/** @internal Validate the options and build the shared request pipeline. */
export function createFlowBuilderCore<TContext>(options: FlowBuilderHandlerOptions<TContext>): FlowBuilderCore<TContext> {
  if (!options || typeof options !== "object") {
    throw new TypeError("createFlowBuilderHandler: options are required");
  }
  if (typeof options.authorize !== "function") {
    throw new TypeError(
      "createFlowBuilderHandler: `authorize(request)` is required. Every route spends your Infobip API key, " +
      "so put it behind your own auth. To accept every request, pass `authorize: () => true` explicitly.",
    );
  }

  let base: URL;
  try {
    base = new URL(options.baseUrl);
  } catch {
    throw new TypeError("createFlowBuilderHandler: `baseUrl` must be an absolute HTTPS URL, e.g. https://xyz.api.infobip.com");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && loopbackHosts.has(base.hostname))) {
    throw new TypeError("createFlowBuilderHandler: `baseUrl` must use HTTPS (HTTP is allowed only for localhost loopback development)");
  }
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  const { apiKey, getApiKey, sender, getSender } = options;
  if (getApiKey !== undefined && typeof getApiKey !== "function") {
    throw new TypeError("createFlowBuilderHandler: `getApiKey` must be a function");
  }
  if (getApiKey === undefined && !normalizeApiKey(apiKey)) {
    throw new TypeError("createFlowBuilderHandler: give `apiKey` or `getApiKey`");
  }
  if (getSender !== undefined && typeof getSender !== "function") {
    throw new TypeError("createFlowBuilderHandler: `getSender` must be a function");
  }
  if (getSender === undefined && !(typeof sender === "string" && sender.trim())) {
    throw new TypeError("createFlowBuilderHandler: give `sender` or `getSender`");
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createFlowBuilderHandler: no global `fetch`; pass `fetch` (Node 18+ has one built in)");
  }

  const bodyLimit = parseByteSize(options.bodyLimit ?? DEFAULT_BODY_LIMIT);
  const saveRetryDelays = [...(options.saveRetryDelays ?? DEFAULT_SAVE_RETRY_DELAYS)];
  const exposeUpstreamErrors = options.exposeUpstreamErrors === true;
  const allowedDownloadHosts = [...(options.allowedDownloadHosts ?? [base.hostname, ...DEFAULT_DOWNLOAD_HOSTS])];
  const logger = options.logger === false ? null : options.logger ?? defaultLogger;

  // ── The single error-response builder ──
  function errorResponse(err: unknown): Response {
    if (err instanceof FlowBuilderHttpError) {
      return jsonResponse(err.status, {
        error: err.message,
        code: err.code,
        ...(exposeUpstreamErrors && err.detail !== undefined ? { detail: err.detail } : null),
      });
    }
    return jsonResponse(500, { error: "Internal server error", code: "INTERNAL_ERROR" });
  }

  function log(entry: FlowBuilderLogEntry) {
    if (!logger) return;
    try {
      logger(entry);
    } catch {
      // A broken logger must not break the request.
    }
  }

  async function resolveApiKey(request: Request, context: TContext): Promise<string> {
    let key: unknown = apiKey;
    if (getApiKey) {
      try {
        key = await getApiKey(request, context);
      } catch {
        throw new FlowBuilderHttpError(500, "Could not resolve the Infobip API key", "CONFIGURATION_ERROR");
      }
    }
    const normalized = normalizeApiKey(key);
    if (!normalized) throw new FlowBuilderHttpError(500, "Infobip API key is not configured", "CONFIGURATION_ERROR");
    return normalized;
  }

  async function resolveSender(request: Request, context: TContext): Promise<string> {
    let value: unknown = sender;
    if (getSender) {
      try {
        value = await getSender(request, context);
      } catch {
        throw new FlowBuilderHttpError(500, "Could not resolve the Infobip sender", "CONFIGURATION_ERROR");
      }
    }
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) throw new FlowBuilderHttpError(500, "Infobip sender is not configured", "CONFIGURATION_ERROR");
    return trimmed;
  }

  async function downloadJson(downloadUrl: string): Promise<unknown> {
    let url: URL;
    try {
      url = new URL(downloadUrl, base);
    } catch {
      throw new FlowBuilderHttpError(502, "Flow JSON download URL is invalid", "DOWNLOAD_URL_INVALID");
    }

    // Redirects are followed by hand so every hop is checked against the allowlist.
    for (let hop = 0; hop <= 5; hop++) {
      const httpAllowed = base.protocol === "http:";
      if (!(url.protocol === "https:" || (httpAllowed && url.protocol === "http:")) ||
          !allowedDownloadHosts.some((pattern) => hostMatches(url.hostname, pattern))) {
        throw new FlowBuilderHttpError(
          502,
          `Flow JSON download from ${url.protocol}//${url.hostname} is not allowed; add the host to allowedDownloadHosts`,
          "DOWNLOAD_HOST_NOT_ALLOWED",
        );
      }

      let res: Response;
      try {
        // No Authorization header: the download URL is pre-signed, and the key
        // must never go anywhere but the Infobip API.
        res = await fetchImpl(url.toString(), { headers: { Accept: "application/json" }, redirect: "manual" });
      } catch (err) {
        throw new FlowBuilderHttpError(500, errorMessage(err), "UPSTREAM_UNREACHABLE");
      }

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        try {
          url = new URL(location, url);
        } catch {
          throw new FlowBuilderHttpError(502, "Flow JSON download URL is invalid", "DOWNLOAD_URL_INVALID");
        }
        continue;
      }

      const text = await res.text().catch(() => "");
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!res.ok) throw new FlowBuilderHttpError(res.status, upstreamMessage(data, res.status), "UPSTREAM_ERROR", data);
      return data;
    }
    throw new FlowBuilderHttpError(502, "Flow JSON download redirected too many times", "DOWNLOAD_TOO_MANY_REDIRECTS");
  }

  async function dispatch(input: FlowBuilderDispatchInput<TContext>): Promise<Response | null> {
    const started = Date.now();
    const match = matchRoute(input.request.method, input.routePath);
    if (!match) return null;

    let response: Response;
    try {
      response = await run(match, input);
    } catch (err) {
      response = errorResponse(err);
    }

    const code = response.ok ? undefined : await peekCode(response);
    log({ method: input.request.method, path: input.logPath, status: response.status, durationMs: Date.now() - started, ...(code ? { code } : null) });
    return response;
  }

  async function run({ route: matched, rawFlowId }: RouteMatch, input: FlowBuilderDispatchInput<TContext>): Promise<Response> {
    const { request, context } = input;

    let verdict: boolean | Response;
    try {
      verdict = await options.authorize(request, context);
    } catch {
      throw new FlowBuilderHttpError(500, "Authorization check failed", "AUTHORIZATION_ERROR");
    }
    if (verdict instanceof Response) return verdict;
    if (verdict !== true) throw new FlowBuilderHttpError(403, "Forbidden", "FORBIDDEN");

    const flowId = rawFlowId === undefined ? "" : decodeFlowId(rawFlowId);
    if (rawFlowId !== undefined && !isFlowId(flowId)) {
      throw new FlowBuilderHttpError(400, "Invalid flowId", "INVALID_FLOW_ID");
    }

    const body = matched.hasBody ? await input.readBody(bodyLimit) : undefined;

    let apiKeyPromise: Promise<string> | undefined;
    let flowsPathPromise: Promise<string> | undefined;

    const ctx: RouteContext = {
      flowId,
      body,
      saveRetryDelays,
      downloadJson,
      flowsPath() {
        flowsPathPromise ??= resolveSender(request, context)
          .then((value) => `/whatsapp/1/senders/${encodeURIComponent(value)}/flows`);
        return flowsPathPromise;
      },
      async infobip(method, path, payload) {
        apiKeyPromise ??= resolveApiKey(request, context);
        const key = await apiKeyPromise;

        let res: Response;
        try {
          res = await fetchImpl(`${baseUrl}${path}`, {
            method,
            headers: {
              Authorization: `App ${key}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            ...(payload !== undefined ? { body: JSON.stringify(payload) } : null),
          });
        } catch (err) {
          throw new FlowBuilderHttpError(500, errorMessage(err), "UPSTREAM_UNREACHABLE");
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new FlowBuilderHttpError(res.status, upstreamMessage(data, res.status), "UPSTREAM_ERROR", data);
        return data;
      },
    };

    return matched.run(ctx);
  }

  return { bodyLimit, dispatch, errorResponse, log };
}

async function peekCode(response: Response): Promise<string | undefined> {
  try {
    const data = await response.clone().json();
    return typeof data?.code === "string" ? data.code : undefined;
  } catch {
    return undefined;
  }
}

function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Create the Flow Builder backend as a Web Fetch handler.
 *
 * ```ts
 * const handler = createFlowBuilderHandler({
 *   baseUrl: process.env.INFOBIP_BASE_URL!,
 *   apiKey: process.env.INFOBIP_API_KEY!,
 *   sender: process.env.INFOBIP_SENDER!,
 *   basePath: "/api/flowbuilder",
 *   authorize: async (request) => Boolean(await getSession(request)),
 * });
 * // Next.js: app/api/flowbuilder/[...path]/route.ts
 * export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
 * ```
 *
 * Throws at construction when `authorize`, `baseUrl`, the key or the sender is missing.
 */
export function createFlowBuilderHandler<TContext = unknown>(
  options: FlowBuilderHandlerOptions<TContext>,
): FlowBuilderHandler<TContext> {
  const core = createFlowBuilderCore(options);
  const basePath = normalizeBasePath(options.basePath);

  return async (request: Request, context?: TContext): Promise<Response> => {
    const started = Date.now();
    let pathname: string;
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      pathname = "/";
    }

    const routePath = basePath === ""
      ? pathname
      : pathname === basePath || pathname.startsWith(`${basePath}/`)
        ? pathname.slice(basePath.length) || "/"
        : null;

    const response = routePath === null ? null : await core.dispatch({
      request,
      context: context as TContext,
      routePath,
      logPath: pathname,
      readBody: (limit) => readJsonBody(
        request.headers.get("content-type"),
        request.headers.get("content-length"),
        request.body ? streamChunks(request.body) : null,
        limit,
      ),
    });
    if (response) return response;

    const notFound = jsonResponse(404, { error: "Not found", code: "NOT_FOUND" });
    core.log({ method: request.method, path: pathname, status: 404, durationMs: Date.now() - started, code: "NOT_FOUND" });
    return notFound;
  };
}
