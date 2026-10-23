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

// Express adapter for the Flow Builder backend.
//
// `createFlowBuilderRouter()` returns an Express-compatible middleware that
// runs the same core as `createFlowBuilderHandler()`. Mount it at any path:
//
//   app.use("/api", createFlowBuilderRouter({ ... }));
//
// It deliberately doesn't import `express`: it only uses the Node request and
// response objects plus the few fields Express adds (`originalUrl`, `body`),
// so it works with Express 4 and 5 without a runtime or type dependency.
//
// Bodies are parsed here, per route, only after `authorize` allowed the
// request, with the configured `bodyLimit`. If an app-level JSON parser already
// ran, its `req.body` is reused; non-JSON bodies are ignored.

import {
  createFlowBuilderCore,
  isJsonContentType,
  readJsonBody,
  type FlowBuilderHandlerOptions,
} from "./core.js";

/** The parts of a Node `IncomingMessage` / Express `Request` the router uses. */
export interface FlowBuilderNodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  /** Path relative to the mount point (Express rewrites it when mounting). */
  url?: string;
  /** Full path including the mount point (set by Express). */
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  /** Set by an app-level body parser, if one ran. */
  body?: unknown;
  /** Express's `req.protocol`. */
  protocol?: string;
  socket?: { remoteAddress?: string; encrypted?: boolean };
}

/** The parts of a Node `ServerResponse` / Express `Response` the router uses. */
export interface FlowBuilderNodeResponse {
  statusCode: number;
  headersSent?: boolean;
  setHeader(name: string, value: string | string[]): unknown;
  end(chunk?: Uint8Array): unknown;
}

export type FlowBuilderNextFunction = (err?: unknown) => void;

/** Passed as the second argument to `authorize`, `getApiKey` and `getSender`. */
export interface FlowBuilderExpressContext<
  Req extends FlowBuilderNodeRequest = FlowBuilderNodeRequest,
  Res extends FlowBuilderNodeResponse = FlowBuilderNodeResponse,
> {
  /** The Express request, e.g. for `req.user`, `req.session` or `req.socket`. */
  req: Req;
  res: Res;
}

export type FlowBuilderRouterOptions<
  Req extends FlowBuilderNodeRequest = FlowBuilderNodeRequest,
  Res extends FlowBuilderNodeResponse = FlowBuilderNodeResponse,
> = Omit<FlowBuilderHandlerOptions<FlowBuilderExpressContext<Req, Res>>, "basePath">;

export type FlowBuilderRouter<
  Req extends FlowBuilderNodeRequest = FlowBuilderNodeRequest,
  Res extends FlowBuilderNodeResponse = FlowBuilderNodeResponse,
> = (req: Req, res: Res, next: FlowBuilderNextFunction) => void;

function headerValue(value: string | string[] | undefined, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return value;
  return value.join(name === "cookie" ? "; " : ", ");
}

function toFetchRequest(req: FlowBuilderNodeRequest): Request {
  const headers = new Headers();
  for (const [name, raw] of Object.entries(req.headers ?? {})) {
    const value = headerValue(raw, name.toLowerCase());
    if (value === undefined) continue;
    try {
      headers.append(name, value);
    } catch {
      // Skip a header the Fetch API refuses rather than failing the request.
    }
  }

  const protocol = req.protocol ?? (req.socket?.encrypted ? "https" : "http");
  const path = req.originalUrl ?? req.url ?? "/";
  let url: string;
  try {
    url = new URL(path, `${protocol}://${headerValue(req.headers?.host, "host") ?? "localhost"}`).toString();
  } catch {
    url = new URL(path, "http://localhost").toString();
  }

  // The body stays on the Node request; the core reads it from there.
  return new Request(url, { method: req.method ?? "GET", headers });
}

async function sendResponse(res: FlowBuilderNodeResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });
  const body = new Uint8Array(await response.arrayBuffer());
  res.end(body);
}

/**
 * Create the Flow Builder backend as an Express middleware.
 *
 * ```ts
 * app.use("/api", createFlowBuilderRouter({
 *   baseUrl: process.env.INFOBIP_BASE_URL!,
 *   apiKey: process.env.INFOBIP_API_KEY!,
 *   sender: process.env.INFOBIP_SENDER!,
 *   authorize: (_request, { req }) => Boolean(req.session?.user),
 * }));
 * ```
 *
 * Requests that match no Flow Builder route fall through to `next()`.
 * Throws at construction when `authorize`, `baseUrl`, the key or the sender is missing.
 */
export function createFlowBuilderRouter<
  Req extends FlowBuilderNodeRequest = FlowBuilderNodeRequest,
  Res extends FlowBuilderNodeResponse = FlowBuilderNodeResponse,
>(options: FlowBuilderRouterOptions<Req, Res>): FlowBuilderRouter<Req, Res> {
  const core = createFlowBuilderCore<FlowBuilderExpressContext<Req, Res>>(options);

  return (req, res, next) => {
    const url = req.url ?? "/";
    const routePath = url.split("?")[0] || "/";
    const logPath = (req.originalUrl ?? url).split("?")[0];

    let request: Request;
    try {
      request = toFetchRequest(req);
    } catch (err) {
      next(err);
      return;
    }

    core.dispatch({
      request,
      context: { req, res },
      routePath,
      logPath,
      readBody: (limit) => {
        const contentType = headerValue(req.headers["content-type"], "content-type");
        if (req.body !== undefined && isJsonContentType(contentType)) {
          return Promise.resolve(req.body);
        }
        return readJsonBody(
          contentType,
          headerValue(req.headers["content-length"], "content-length"),
          req,
          limit,
        );
      },
    })
      .then((response) => {
        if (!response) {
          next();
          return;
        }
        return sendResponse(res, response);
      })
      .catch((err) => {
        if (res.headersSent) {
          next(err);
          return;
        }
        return sendResponse(res, core.errorResponse(err)).catch(next);
      });
  };
}
