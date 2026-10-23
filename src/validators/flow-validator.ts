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

// Pre-submission validation for WhatsApp Flow JSON

import type { WhatsAppFlow } from "../types/flow.js";
import type { Screen } from "../types/screen.js";
import type { FlowComponent, Footer } from "../types/components.js";

export interface ValidationResult {
  valid: boolean;
  errors: FlowValidationError[];
}

// Stable identifiers for every problem the validator reports, in SCREAMING_SNAKE
// case. A host can translate or branch on these; the English `message` is kept
// for backward compatibility. Adding a code is a minor change, renaming or
// removing one is breaking.
export const FLOW_VALIDATION_ERROR_CODES = [
  "VERSION_REQUIRED",
  "SCREENS_REQUIRED",
  "SCREEN_NOT_OBJECT",
  "SCREEN_ID_DUPLICATE",
  "SCREEN_ID_REQUIRED",
  "SCREEN_TITLE_REQUIRED",
  "SCREEN_LAYOUT_REQUIRED",
  "SCREEN_COMPONENTS_REQUIRED",
  "TERMINAL_SCREEN_REQUIRED",
  "COMPONENT_NOT_OBJECT",
  "INPUT_NAME_DUPLICATE",
  "DATA_SOURCE_EMPTY",
  "FOOTER_ACTION_REQUIRED",
  "NAVIGATE_TARGET_REQUIRED",
  "NAVIGATE_TARGET_UNKNOWN",
] as const;

export type FlowValidationErrorCode = (typeof FLOW_VALIDATION_ERROR_CODES)[number];

export interface FlowValidationError {
  path: string;
  /** English text, unchanged from earlier versions. */
  message: string;
  code: FlowValidationErrorCode;
  /** The values interpolated into `message` (e.g. `{ id }`), for translation. */
  params?: Record<string, string | number>;
}

// The types describe a well-formed flow, but the editor validates JSON while it
// is being typed, so any part may be missing or the wrong shape. Each part is
// checked before it is read, and a malformed one is reported instead.
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Messages quote values from that JSON. Interpolating an object whose own
// `toString` isn't callable throws, so anything but a string is quoted as JSON,
// and a value JSON can't write either (BigInt, a cycle) isn't quoted at all.
function text(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "(unprintable)";
  }
}

function componentsOf(screen: Screen): FlowComponent[] {
  if (!isObject(screen) || !isObject(screen.layout)) return [];
  return Array.isArray(screen.layout.children) ? screen.layout.children : [];
}

export function validateFlow(flow: WhatsAppFlow): ValidationResult {
  const errors: FlowValidationError[] = [];

  if (!flow.version) {
    errors.push({ path: "version", code: "VERSION_REQUIRED", message: "Flow version is required" });
  }

  if (!Array.isArray(flow.screens) || flow.screens.length === 0) {
    errors.push({ path: "screens", code: "SCREENS_REQUIRED", message: "Flow must have at least one screen" });
    return { valid: false, errors };
  }

  const screenIds = new Set<string>();
  const terminalScreens: string[] = [];

  for (let i = 0; i < flow.screens.length; i++) {
    const screen = flow.screens[i];
    const prefix = `screens[${i}]`;

    if (!isObject(screen)) {
      errors.push({ path: prefix, code: "SCREEN_NOT_OBJECT", message: "Screen must be an object" });
      continue;
    }

    validateScreen(screen, prefix, errors);

    if (screenIds.has(screen.id)) {
      errors.push({
        path: `${prefix}.id`,
        code: "SCREEN_ID_DUPLICATE",
        message: `Duplicate screen id: "${text(screen.id)}"`,
        params: { id: String(text(screen.id)) },
      });
    }
    screenIds.add(screen.id);

    if (screen.terminal) {
      terminalScreens.push(screen.id);
    }
  }

  if (terminalScreens.length === 0) {
    errors.push({ path: "screens", code: "TERMINAL_SCREEN_REQUIRED", message: "Flow must have at least one terminal screen" });
  }

  validateNavigationTargets(flow.screens, screenIds, errors);

  return { valid: errors.length === 0, errors };
}

function validateScreen(screen: Screen, prefix: string, errors: FlowValidationError[]): void {
  if (!screen.id) {
    errors.push({ path: `${prefix}.id`, code: "SCREEN_ID_REQUIRED", message: "Screen id is required" });
  }
  if (!screen.title) {
    errors.push({ path: `${prefix}.title`, code: "SCREEN_TITLE_REQUIRED", message: "Screen title is required" });
  }
  if (!isObject(screen.layout)) {
    errors.push({ path: `${prefix}.layout`, code: "SCREEN_LAYOUT_REQUIRED", message: "Screen layout is required" });
    return;
  }
  const children = componentsOf(screen);
  if (children.length === 0) {
    errors.push({
      path: `${prefix}.layout.children`,
      code: "SCREEN_COMPONENTS_REQUIRED",
      message: "Screen must have at least one component",
    });
    return;
  }

  const inputNames = new Set<string>();
  visitComponentTree(children, `${prefix}.layout.children`, (child, childPath) => {
    validateComponent(child, childPath, inputNames, errors);
  });
}

function visitComponentTree(
  components: readonly unknown[],
  path: string,
  visit: (component: FlowComponent, path: string) => void,
  ancestors = new Set<object>(),
): void {
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    const componentPath = `${path}[${i}]`;
    visit(component as FlowComponent, componentPath);

    if (!isObject(component) || !("type" in component) || component.type !== "If" || ancestors.has(component)) continue;
    ancestors.add(component);
    const branches = component as { then?: unknown; else?: unknown };
    for (const branch of ["then", "else"] as const) {
      const children = branches[branch];
      if (Array.isArray(children)) visitComponentTree(children, `${componentPath}.${branch}`, visit, ancestors);
    }
    ancestors.delete(component);
  }
}

function validateComponent(
  component: FlowComponent,
  path: string,
  inputNames: Set<string>,
  errors: FlowValidationError[],
): void {
  if (!isObject(component)) {
    errors.push({ path, code: "COMPONENT_NOT_OBJECT", message: "Component must be an object" });
    return;
  }

  if ("name" in component && component.name) {
    if (inputNames.has(component.name)) {
      errors.push({
        path: `${path}.name`,
        code: "INPUT_NAME_DUPLICATE",
        message: `Duplicate input name: "${text(component.name)}"`,
        params: { name: String(text(component.name)) },
      });
    }
    inputNames.add(component.name);
  }

  if (component.type === "Dropdown" || component.type === "RadioButtonsGroup" || component.type === "CheckboxGroup") {
    const ds = component["data-source"];
    if (Array.isArray(ds) && ds.length === 0) {
      errors.push({ path: `${path}.data-source`, code: "DATA_SOURCE_EMPTY", message: "data-source must not be empty" });
    }
  }

  if (component.type === "Footer" && !isObject(component["on-click-action"])) {
    errors.push({
      path: `${path}.on-click-action`,
      code: "FOOTER_ACTION_REQUIRED",
      message: "Footer on-click-action is required",
    });
  }
}

function validateNavigationTargets(
  screens: Screen[],
  screenIds: Set<string>,
  errors: FlowValidationError[],
): void {
  for (let i = 0; i < screens.length; i++) {
    const children = componentsOf(screens[i]);
    visitComponentTree(children, `screens[${i}].layout.children`, (child, childPath) => {
      if (isObject(child) && child.type === "Footer") {
        const footerComponent = child as Footer;
        const action = footerComponent["on-click-action"];
        if (isObject(action) && action.name === "navigate") {
          const nextPath = `${childPath}.on-click-action.next`;
          if (!isObject(action.next) || typeof action.next.name !== "string") {
            errors.push({
              path: nextPath,
              code: "NAVIGATE_TARGET_REQUIRED",
              message: "Navigate action must name the next screen",
            });
          } else if (!screenIds.has(action.next.name)) {
            errors.push({
              path: `${nextPath}.name`,
              code: "NAVIGATE_TARGET_UNKNOWN",
              params: { target: action.next.name },
              message: `Navigation target "${action.next.name}" does not match any screen id`,
            });
          }
        }
      }
    });
  }
}
