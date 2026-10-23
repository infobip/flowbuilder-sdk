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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlowBuilderErrorBoundary } from '../app/ErrorBoundary';
import { FlowBuilderRoot } from '../app/FlowBuilderRoot';
import { createInterceptingRouter, RouterOverride, useFlowSyncBus } from '../app/instanceContext';
import { EditorPage } from '../pages/EditorPage';
import { LibraryPage } from '../pages/LibraryPage';
import { PreviewPage } from '../pages/PreviewPage';
import type { FlowBuilderFlowSummary } from '../app/hostConfig';
import type { EditorMode, Route, Router } from '../utils/routing';

// Composable pieces for hosts with their own navigation. Each one renders
// inside a `<FlowBuilderProvider>` and brings its own themed root (so it can
// be dropped anywhere in the host's layout), error boundary and a pinned
// router: the page's navigation requests become the callbacks below instead
// of changing a route.

// A router pinned to `route` that forwards navigation to the latest handler.
function usePinnedRouter(route: Route, handler: (next: Route) => void): Router {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const key = JSON.stringify(route);
  // `key` is the route's identity, so the router only changes with the route.
  return useMemo(() => createInterceptingRouter(route, (next) => handlerRef.current(next)), [key]);
}

function Piece({ router, children }: { router: Router; children: React.ReactNode }) {
  return (
    <RouterOverride router={router}>
      <FlowBuilderErrorBoundary>
        <FlowBuilderRoot>{children}</FlowBuilderRoot>
      </FlowBuilderErrorBoundary>
    </RouterOverride>
  );
}

export type FlowLibraryProps = {
  /** A flow was opened for editing. */
  onOpenFlow: (flowId: string) => void;
  /** "Create flow" was chosen. The button does nothing when this is omitted. */
  onCreateFlow?: () => void;
  /** A published flow was opened for viewing. Defaults to `onOpenFlow`. */
  onPreviewFlow?: (flowId: string) => void;
};

/** The flow library: list, filter, publish and delete flows. */
export function FlowLibrary({ onOpenFlow, onCreateFlow, onPreviewFlow }: FlowLibraryProps) {
  const router = usePinnedRouter({ name: 'library' }, (next) => {
    if (next.name === 'flow-edit') onOpenFlow(next.flowId);
    else if (next.name === 'flow-preview') (onPreviewFlow ?? onOpenFlow)(next.flowId);
    else if (next.name === 'flow-new') onCreateFlow?.();
  });
  return (
    <Piece router={router}>
      <LibraryPage />
    </Piece>
  );
}

export type FlowEditorProps = {
  /** The flow to edit, or `null` for a new one. */
  flowId: string | null;
  /** The initial editor mode. The editor's own mode switch changes it afterwards. */
  mode?: EditorMode;
  /** A flow was created or saved. */
  onSaved?: (flow: FlowBuilderFlowSummary) => void;
  /** "Back to library" was chosen. */
  onClose?: () => void;
  /** The flow is published, or its preview was requested. */
  onPreview?: (flowId: string) => void;
};

function FlowEditorInner({ flowId: initialFlowId, mode: initialMode = 'prompt', onSaved, onClose, onPreview }: FlowEditorProps) {
  const [mode, setMode] = useState<EditorMode>(initialMode);
  // A new flow gets its id on first save, when the editor asks to move to
  // `flow-edit`. Following it keeps the editor on that flow, so the next save
  // updates it instead of creating another one.
  const [flowId, setFlowId] = useState(initialFlowId);
  const syncBus = useFlowSyncBus();
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;
  useEffect(
    () =>
      syncBus.subscribe((event) => {
        if (event.type === 'created' || event.type === 'updated') savedRef.current?.(event.flow);
      }),
    [syncBus],
  );

  const route: Route = flowId == null ? { name: 'flow-new', mode } : { name: 'flow-edit', flowId, mode };
  const router = usePinnedRouter(route, (next) => {
    if (next.name === 'library') onClose?.();
    else if (next.name === 'flow-preview') onPreview?.(next.flowId);
    else if (next.name === 'flow-new') setMode(next.mode);
    else if (next.name === 'flow-edit') {
      setFlowId(next.flowId);
      setMode(next.mode);
    }
  });
  return (
    <Piece router={router}>
      <EditorPage flowId={flowId} mode={mode} />
    </Piece>
  );
}

/** The flow editor (prompt and JSON modes, live preview, save and publish). */
export function FlowEditor(props: FlowEditorProps) {
  // A different flow starts a fresh editor in the requested mode.
  return <FlowEditorInner key={props.flowId ?? 'new'} {...props} />;
}

export type FlowPreviewProps = {
  flowId: string;
  /** "Back to library" was chosen. */
  onClose?: () => void;
};

/** The read-only live preview of a flow. */
export function FlowPreview({ flowId, onClose }: FlowPreviewProps) {
  const router = usePinnedRouter({ name: 'flow-preview', flowId }, (next) => {
    if (next.name === 'library') onClose?.();
  });
  return (
    <Piece router={router}>
      <PreviewPage flowId={flowId} />
    </Piece>
  );
}
