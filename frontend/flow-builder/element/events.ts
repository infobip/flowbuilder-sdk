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

// The element's DOM events. The builder's lifecycle callbacks map one to one
// onto `flowbuilder:*` CustomEvents (bubbling and composed, so a listener on
// the host page hears them through the shadow boundary).

import type { FlowBuilderProps } from './flowBuilder';

export const ELEMENT_EVENTS = {
  onFlowCreated: 'flowbuilder:created',
  onFlowSaved: 'flowbuilder:saved',
  onFlowPublished: 'flowbuilder:published',
  onFlowDeleted: 'flowbuilder:deleted',
  onError: 'flowbuilder:error',
  onNavigate: 'flowbuilder:navigate',
} as const;

export type ElementCallbackName = keyof typeof ELEMENT_EVENTS;
export type ElementEventName = (typeof ELEMENT_EVENTS)[ElementCallbackName];

export type ElementEventDispatcher = (name: ElementEventName, detail: unknown) => void;

type CallbackProps = Required<Pick<FlowBuilderProps, ElementCallbackName>>;

/** Callbacks for FlowBuilder's props that forward to `dispatch` as `{ name, detail }`. */
export function createEventCallbacks(dispatch: ElementEventDispatcher): CallbackProps {
  return {
    onFlowCreated: (flow) => dispatch(ELEMENT_EVENTS.onFlowCreated, { flow }),
    onFlowSaved: (flow) => dispatch(ELEMENT_EVENTS.onFlowSaved, { flow }),
    onFlowPublished: (flow) => dispatch(ELEMENT_EVENTS.onFlowPublished, { flow }),
    onFlowDeleted: (flowId) => dispatch(ELEMENT_EVENTS.onFlowDeleted, { flowId }),
    onError: (error, info) => dispatch(ELEMENT_EVENTS.onError, { error, source: info.source }),
    onNavigate: (route) => dispatch(ELEMENT_EVENTS.onNavigate, { route }),
  };
}
