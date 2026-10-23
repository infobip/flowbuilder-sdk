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

import React from 'react';
import { ErrorState } from '../components/empty-state/ErrorState';
import { useT, type Translate } from '../i18n/I18nProvider';
import { FlowBuilderRoot } from './FlowBuilderRoot';
import { useHostConfig, type FlowBuilderErrorSource } from './hostConfig';

type ErrorBoundaryProps = {
  onError?: (error: unknown, info: { source: FlowBuilderErrorSource }) => void;
  children?: React.ReactNode;
};

type ErrorBoundaryState = { error: unknown; failed: boolean };

function describeCrash(t: Translate, error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return typeof error === 'string' && error ? error : t('common.errorBoundary.unexpected');
}

/** The in-place panel shown instead of a crashed builder. */
export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="p-6">
      <ErrorState title={t('common.errorBoundary.title')} message={describeCrash(t, error)} onRetry={onRetry} />
    </div>
  );
}

// Keeps a render crash inside the builder: the fallback is rendered in its own
// themed root (the crashed one is gone) and the host hears about it through
// `onError`, so the host page keeps running.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError?.(error, { source: 'render' });
  }

  reset = (): void => {
    this.setState({ error: null, failed: false });
  };

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <FlowBuilderRoot>
        <ErrorPanel error={this.state.error} onRetry={this.reset} />
      </FlowBuilderRoot>
    );
  }
}

/** ErrorBoundary wired to the host's `onError`. Render inside a FlowBuilderProvider. */
export function FlowBuilderErrorBoundary({ children }: { children?: React.ReactNode }) {
  const { events } = useHostConfig();
  // Read at call time so a changing `onError` doesn't remount the tree.
  const onError = React.useCallback<NonNullable<ErrorBoundaryProps['onError']>>(
    (error, info) => events.current.onError?.(error, info),
    [events],
  );
  return <ErrorBoundary onError={onError}>{children}</ErrorBoundary>;
}
