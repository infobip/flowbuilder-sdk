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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EditorChatMessage } from '../utils/chatMessages.ts';
import { clearAllChatHistory, clearChatHistory, loadChatHistory, saveChatHistory } from './chatHistory.ts';
import { createInstanceStorage, createLocalStorageAdapter } from './storage.ts';

// The builder's default storage: localStorage under the `flowbuilder`
// namespace. It resolves `window.localStorage` on every call, so the stub
// below is picked up — and the raw-key assertions double as the proof that
// standalone users' existing `flowbuilder_*` keys still read unchanged.
const storage = createInstanceStorage(createLocalStorageAdapter());

// Minimal in-memory localStorage stub. chatHistory reads `window` lazily inside
// each function, so installing this before the calls is enough.
function installStorage(): { store: Map<string, string> } {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  return { store };
}

function resetStorage(): void {
  delete (globalThis as { window?: unknown }).window;
}

const userMessage: EditorChatMessage = { id: 'u1', role: 'user', text: 'build me a flow', time: '10:00' };
const assistantMessage: EditorChatMessage = { id: 'a1', role: 'assistant', text: 'Created your flow.', time: '10:01' };

test('round-trips a transcript through localStorage', () => {
  installStorage();
  try {
    saveChatHistory(storage, 'FLOW_1', [userMessage, assistantMessage]);
    assert.deepEqual(loadChatHistory(storage, 'FLOW_1'), [userMessage, assistantMessage]);
  } finally {
    resetStorage();
  }
});

test('loadChatHistory returns [] for a missing flow / null id', () => {
  installStorage();
  try {
    assert.deepEqual(loadChatHistory(storage, 'UNKNOWN'), []);
    assert.deepEqual(loadChatHistory(storage, null), []);
  } finally {
    resetStorage();
  }
});

test('pending placeholders are never persisted', () => {
  installStorage();
  try {
    const pending: EditorChatMessage = { id: 'p1', role: 'pending', text: 'Generating…', time: '10:02' };
    saveChatHistory(storage, 'FLOW_2', [userMessage, pending]);
    assert.deepEqual(loadChatHistory(storage, 'FLOW_2'), [userMessage]);
  } finally {
    resetStorage();
  }
});

test('saving an empty (or pending-only) transcript deletes the key', () => {
  const { store } = installStorage();
  try {
    saveChatHistory(storage, 'FLOW_3', [userMessage]);
    assert.ok(store.get('flowbuilder_chat_history')?.includes('FLOW_3'));

    saveChatHistory(storage, 'FLOW_3', []);
    assert.equal(loadChatHistory(storage, 'FLOW_3').length, 0);
    assert.ok(!(store.get('flowbuilder_chat_history') ?? '').includes('FLOW_3'));
  } finally {
    resetStorage();
  }
});

test('clearChatHistory removes only the target flow', () => {
  installStorage();
  try {
    saveChatHistory(storage, 'KEEP', [userMessage]);
    saveChatHistory(storage, 'DROP', [assistantMessage]);

    clearChatHistory(storage, 'DROP');
    assert.deepEqual(loadChatHistory(storage, 'DROP'), []);
    assert.deepEqual(loadChatHistory(storage, 'KEEP'), [userMessage]);
  } finally {
    resetStorage();
  }
});

test('clearAllChatHistory removes every transcript and the key itself', () => {
  const { store } = installStorage();
  try {
    saveChatHistory(storage, 'FLOW_A', [userMessage]);
    saveChatHistory(storage, 'FLOW_B', [assistantMessage]);

    assert.equal(clearAllChatHistory(storage), true);
    assert.equal(store.has('flowbuilder_chat_history'), false);
    assert.deepEqual(loadChatHistory(storage, 'FLOW_A'), []);
    assert.deepEqual(loadChatHistory(storage, 'FLOW_B'), []);
  } finally {
    resetStorage();
  }
});

test('clearAllChatHistory reports failure when storage is unavailable', () => {
  resetStorage();
  assert.equal(clearAllChatHistory(storage), false);
});

test('drops malformed entries and unknown roles on load', () => {
  const { store } = installStorage();
  try {
    store.set(
      'flowbuilder_chat_history',
      JSON.stringify({
        FLOW_4: [
          userMessage,
          { id: 'x', role: 'user' }, // missing text/time
          { id: 'y', role: 'wizard', text: 'nope', time: '10:03' }, // invalid role
          'not-an-object',
        ],
      }),
    );
    assert.deepEqual(loadChatHistory(storage, 'FLOW_4'), [userMessage]);
  } finally {
    resetStorage();
  }
});

test('gracefully no-ops when window is unavailable', () => {
  resetStorage();
  assert.deepEqual(loadChatHistory(storage, 'FLOW_5'), []);
  assert.doesNotThrow(() => saveChatHistory(storage, 'FLOW_5', [userMessage]));
  assert.doesNotThrow(() => clearChatHistory(storage, 'FLOW_5'));
});
