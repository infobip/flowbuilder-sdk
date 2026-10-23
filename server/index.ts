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

// Server entry: the Flow Builder backend as a Web Fetch handler and as an
// Express middleware. See README.md for setup.

export {
  createFlowBuilderHandler,
  FlowBuilderHttpError,
  isFlowId,
  normalizeApiKey,
  DEFAULT_BODY_LIMIT,
  DEFAULT_SAVE_RETRY_DELAYS,
  DEFAULT_DOWNLOAD_HOSTS,
} from "./core.js";
export type {
  Awaitable,
  FlowBuilderHandler,
  FlowBuilderHandlerOptions,
  FlowBuilderLogEntry,
  FlowBuilderLogger,
} from "./core.js";

export { createFlowBuilderRouter } from "./express.js";
export type {
  FlowBuilderExpressContext,
  FlowBuilderNextFunction,
  FlowBuilderNodeRequest,
  FlowBuilderNodeResponse,
  FlowBuilderRouter,
  FlowBuilderRouterOptions,
} from "./express.js";
