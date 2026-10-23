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

// A host app with its own header, navigation, router and global CSS. It shows
// the two ways to embed the builder with `@infobip/flowbuilder-sdk/react`:
//
//   #/flows, #/flows/:id, #/new   the composable pieces, driven by the host's router
//   #/full                        the all-in-one <FlowBuilder> with its own (memory) navigation

import '@infobip/flowbuilder-sdk/styles.css';
import './host.css';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FlowBuilder,
  FlowBuilderProvider,
  FlowEditor,
  FlowLibrary,
  type FlowBuilderMessagesOverride,
  type FlowBuilderTheme,
} from '@infobip/flowbuilder-sdk/react';

const API = '/flowbuilder/api';
const onError = (error: unknown, info: { source: string }) => console.warn('[builder error]', info.source, error);

// ── A tiny hash router ──────────────────────────────────────────────────────

const useHash = () => {
  const [hash, setHash] = useState(location.hash || '#/flows');
  useEffect(() => {
    const update = () => setHash(location.hash || '#/flows');
    addEventListener('hashchange', update);
    return () => removeEventListener('hashchange', update);
  }, []);
  return hash.slice(1);
};

// ── Customisation for the all-in-one page ───────────────────────────────────

const theme: FlowBuilderTheme = {
  tokens: { colorAccent: '#5b3cc4', colorAccentSoft: '#ece7fb', colorPrimary: '#2d1b69', colorNavActive: '#5b3cc4' },
  darkTokens: { colorAccent: '#b9a6ff', colorAccentSoft: '#2b2150', colorSurface: '#17132b', colorCanvas: '#100d20' },
};

// A partial German catalogue: anything missing falls back to English.
const de: FlowBuilderMessagesOverride = {
  common: {
    productName: 'Acme Flows',
    tagline: 'WhatsApp Flows, von KI erstellt',
    nav: { library: 'Flow-Bibliothek', newFlow: 'Neuer Flow', settings: 'Einstellungen' },
    actions: { cancel: 'Abbrechen', confirm: 'Bestätigen', tryAgain: 'Erneut versuchen' },
  },
  library: {
    header: {
      eyebrow: 'Flow-Bibliothek',
      title: 'Flow-Bibliothek',
      count: '{count|one:# Flow|other:# Flows}',
      createFlow: 'Flow erstellen',
    },
    actions: { edit: 'Bearbeiten', view: 'Ansehen', publish: 'Veröffentlichen', delete: 'Löschen' },
    deleteDialog: {
      title: 'Flow löschen',
      confirm: 'Löschen',
      message: '{name} endgültig löschen? Das kann nicht rückgängig gemacht werden.',
    },
    errors: { loadFailed: 'Flows konnten nicht geladen werden.' },
  },
  editor: {
    modes: { prompt: 'Prompt', json: 'JSON-Editor' },
    actions: { saveDraft: 'Entwurf speichern', publish: 'Veröffentlichen', delete: 'Löschen' },
  },
};

// ── Pages ───────────────────────────────────────────────────────────────────

function Home() {
  return <p>The host's own page. It never mounts the builder.</p>;
}

// The builder pieces share one provider: one API config, one set of callbacks.
function Pieces({ children }: { children: React.ReactNode }) {
  return (
    <FlowBuilderProvider apiBaseUrl={API} credentials="same-origin" storageKey="acme-pieces" onError={onError}>
      <div className="stage">{children}</div>
    </FlowBuilderProvider>
  );
}

function Library() {
  return (
    <Pieces>
      <FlowLibrary
        onOpenFlow={(id) => (location.hash = `#/flows/${id}`)}
        onCreateFlow={() => (location.hash = '#/new')}
      />
    </Pieces>
  );
}

function Editor({ flowId }: { flowId: string | null }) {
  return (
    <Pieces>
      <FlowEditor
        flowId={flowId}
        mode={flowId ? 'json' : 'prompt'}
        onSaved={(flow) => console.log('[host] saved', flow.id)}
        onClose={() => (location.hash = '#/flows')}
        onPreview={(id) => (location.hash = `#/flows/${id}`)}
      />
    </Pieces>
  );
}

function Full({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  return (
    <div className="stage">
      <FlowBuilder
        apiBaseUrl={API}
        credentials="same-origin"
        routing="memory"
        storageKey="acme-full"
        theme={theme}
        brand={{ productName: 'Acme Flows', tagline: 'WhatsApp Flows, built with Acme' }}
        messages={de}
        locale="de"
        features={{ settings: false }}
        onDirtyChange={onDirty}
        onFlowCreated={(flow) => console.log('[host] created', flow.id)}
        onFlowSaved={(flow) => console.log('[host] saved', flow.id)}
        onFlowPublished={(flow) => console.log('[host] published', flow.id)}
        onFlowDeleted={(id) => console.log('[host] deleted', id)}
        onError={onError}
      />
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────

function App() {
  const path = useHash();
  const dirty = useRef(false);
  const onDirty = useCallback((value: boolean) => { dirty.current = value; }, []);

  // The host guards its own navigation while the builder has unsaved changes.
  const guard = (event: React.MouseEvent) => {
    if (dirty.current && !confirm('You have unsaved changes in the builder. Leave anyway?')) event.preventDefault();
    else dirty.current = false;
  };

  const edit = /^\/flows\/([\w-]+)$/.exec(path);
  const links: [string, string][] = [['#/', 'Home'], ['#/flows', 'Flows'], ['#/new', 'New flow'], ['#/full', 'Full builder']];

  return (
    <>
      <header>
        <h1>Acme host</h1>
        <nav>
          <ul>
            {links.map(([href, label]) => (
              <li key={href}><a href={href} onClick={guard}>{label}</a></li>
            ))}
          </ul>
        </nav>
        <a href="/logout">Log out</a>
      </header>
      <main>
        {path === '/' ? <Home />
          : path === '/new' ? <Editor flowId={null} />
          : path === '/full' ? <Full onDirty={onDirty} />
          : edit ? <Editor flowId={edit[1]} />
          : <Library />}
      </main>
      <footer>
        <button>Host button</button>
      </footer>
    </>
  );
}

createRoot(document.getElementById('app')!).render(<App />);
