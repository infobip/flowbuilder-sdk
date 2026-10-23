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

// English messages for the `validation.*` keys: one per code the flow
// validator reports (src/validators/). Each is identical to the validator's own
// `message`, with `{param}` placeholders for the issue's `params`.

export const validation = {
  VERSION_REQUIRED: 'Flow version is required',
  SCREENS_REQUIRED: 'Flow must have at least one screen',
  SCREEN_NOT_OBJECT: 'Screen must be an object',
  SCREEN_ID_DUPLICATE: 'Duplicate screen id: "{id}"',
  SCREEN_ID_REQUIRED: 'Screen id is required',
  SCREEN_TITLE_REQUIRED: 'Screen title is required',
  SCREEN_LAYOUT_REQUIRED: 'Screen layout is required',
  SCREEN_COMPONENTS_REQUIRED: 'Screen must have at least one component',
  TERMINAL_SCREEN_REQUIRED: 'Flow must have at least one terminal screen',
  COMPONENT_NOT_OBJECT: 'Component must be an object',
  INPUT_NAME_DUPLICATE: 'Duplicate input name: "{name}"',
  DATA_SOURCE_EMPTY: 'data-source must not be empty',
  FOOTER_ACTION_REQUIRED: 'Footer on-click-action is required',
  NAVIGATE_TARGET_REQUIRED: 'Navigate action must name the next screen',
  NAVIGATE_TARGET_UNKNOWN: 'Navigation target "{target}" does not match any screen id',
};
