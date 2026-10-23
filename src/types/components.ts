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

// WhatsApp Flow UI Components
// Reference: Meta WhatsApp Flows JSON spec

export type ComponentType =
  | "TextHeading"
  | "TextSubheading"
  | "TextBody"
  | "TextCaption"
  | "TextInput"
  | "TextArea"
  | "DatePicker"
  | "RadioButtonsGroup"
  | "CheckboxGroup"
  | "Dropdown"
  | "OptIn"
  | "Image"
  | "Footer"
  | "EmbeddedLink"
  | "If";

// --- Base ---

export interface BaseComponent {
  type: ComponentType;
}

// --- Text Display ---

export interface TextHeading extends BaseComponent {
  type: "TextHeading";
  text: string;
  visible?: boolean | string;
}

export interface TextSubheading extends BaseComponent {
  type: "TextSubheading";
  text: string;
  visible?: boolean | string;
}

export interface TextBody extends BaseComponent {
  type: "TextBody";
  text: string;
  visible?: boolean | string;
}

export interface TextCaption extends BaseComponent {
  type: "TextCaption";
  text: string;
  visible?: boolean | string;
}

// --- Input Components ---

export interface TextInput extends BaseComponent {
  type: "TextInput";
  name: string;
  label: string;
  required?: boolean;
  "input-type"?: "text" | "number" | "email" | "password" | "passcode" | "phone";
  "min-chars"?: number;
  "max-chars"?: number;
  "helper-text"?: string;
  visible?: boolean | string;
  enabled?: boolean | string;
  "init-value"?: string;
  "error-message"?: string;
}

export interface TextArea extends BaseComponent {
  type: "TextArea";
  name: string;
  label: string;
  required?: boolean;
  "max-length"?: number;
  "helper-text"?: string;
  visible?: boolean | string;
  enabled?: boolean | string;
  "init-value"?: string;
  "error-message"?: string;
}

export interface DatePicker extends BaseComponent {
  type: "DatePicker";
  name: string;
  label: string;
  required?: boolean;
  "min-date"?: string;
  "max-date"?: string;
  "unavailable-dates"?: string[];
  "helper-text"?: string;
  visible?: boolean | string;
  enabled?: boolean | string;
  "init-value"?: string;
  "error-message"?: string;
  "on-select-action"?: ComponentAction;
}

// --- Selection Components ---

export interface DropdownOption {
  id: string;
  title: string;
  description?: string;
  enabled?: boolean;
}

export interface Dropdown extends BaseComponent {
  type: "Dropdown";
  name: string;
  label: string;
  required?: boolean;
  "data-source": DropdownOption[] | string;
  "init-value"?: string;
  "helper-text"?: string;
  visible?: boolean | string;
  enabled?: boolean | string;
  "error-message"?: string;
  "on-select-action"?: ComponentAction;
}

export interface RadioButtonsGroup extends BaseComponent {
  type: "RadioButtonsGroup";
  name: string;
  label: string;
  required?: boolean;
  "data-source": DropdownOption[] | string;
  "init-value"?: string;
  visible?: boolean | string;
  enabled?: boolean | string;
  "on-select-action"?: ComponentAction;
}

export interface CheckboxGroup extends BaseComponent {
  type: "CheckboxGroup";
  name: string;
  label: string;
  required?: boolean;
  "data-source": DropdownOption[] | string;
  "min-selected-items"?: number;
  "max-selected-items"?: number;
  "init-value"?: string[];
  visible?: boolean | string;
  enabled?: boolean | string;
  "on-select-action"?: ComponentAction;
}

// --- Media & Links ---

export interface Image extends BaseComponent {
  type: "Image";
  src: string;
  width?: number;
  height?: number;
  "scale-type"?: "cover" | "contain";
  "aspect-ratio"?: number;
  "alt-text"?: string;
  visible?: boolean | string;
}

export interface EmbeddedLink extends BaseComponent {
  type: "EmbeddedLink";
  text: string;
  "on-click-action": ComponentAction;
  visible?: boolean | string;
}

// --- Special Components ---

export interface OptIn extends BaseComponent {
  type: "OptIn";
  name: string;
  label: string;
  required?: boolean;
  "init-value"?: boolean;
  "on-click-action"?: ComponentAction;
  visible?: boolean | string;
}

export interface Footer extends BaseComponent {
  type: "Footer";
  label: string;
  "on-click-action": FooterAction;
  "left-caption"?: string;
  "center-caption"?: string;
  "right-caption"?: string;
  enabled?: boolean | string;
  visible?: boolean | string;
}

// --- Conditional ---

export interface IfComponent extends BaseComponent {
  type: "If";
  condition: string;
  then: FlowComponent[];
  else?: FlowComponent[];
}

// --- Actions ---

export interface ComponentAction {
  name: "navigate" | "data_exchange" | "update_data";
  next?: { type: "screen"; name: string };
  payload?: Record<string, unknown>;
}

export interface FooterAction {
  name: "navigate" | "data_exchange" | "complete";
  next?: { type: "screen"; name: string };
  payload?: Record<string, unknown>;
}

// --- Union ---

export type FlowComponent =
  | TextHeading
  | TextSubheading
  | TextBody
  | TextCaption
  | TextInput
  | TextArea
  | DatePicker
  | Dropdown
  | RadioButtonsGroup
  | CheckboxGroup
  | Image
  | EmbeddedLink
  | OptIn
  | Footer
  | IfComponent;
