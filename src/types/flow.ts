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

// WhatsApp Flow — top-level structure

import type { Screen } from "./screen.js";

export type FlowVersion = "2.1" | "3.0" | "3.1" | "4.0" | "5.0" | "5.1" | "6.0";

export interface RoutingModel {
  [screenId: string]: string[];
}

export interface WhatsAppFlow {
  version: FlowVersion;
  data_api_version?: string;
  routing_model?: RoutingModel;
  screens: Screen[];
}
