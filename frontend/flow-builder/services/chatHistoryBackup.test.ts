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
import { createI18n } from '../i18n/I18nProvider.tsx';
import type { EditorChatMessage } from '../utils/chatMessages.ts';
import { loadAllChatHistory, replaceAllChatHistory, type ChatHistoryMap } from './chatHistory.ts';
import {
  backupFileName,
  buildBackup,
  countRestored,
  describeRestore,
  mergeChatHistory,
  parseBackup,
  sanitizeBackupHistory,
  serializeBackup,
  type RestoreCount,
} from './chatHistoryBackup.ts';
import { createInstanceStorage, createLocalStorageAdapter } from './storage.ts';

const { t } = createI18n();

// The builder's default storage: localStorage under the `flowbuilder`
// namespace. It resolves `window.localStorage` on every call, so the stub
// below is picked up — and the raw-key assertions double as the proof that
// standalone users' existing `flowbuilder_*` keys still read unchanged.
const storage = createInstanceStorage(createLocalStorageAdapter());

// Same in-memory localStorage stub as chatHistory.test.ts, plus a write-failure
// mode for the quota / private-mode path that `replaceAllChatHistory` reports.
function installStorage(options: { failWrites?: boolean } = {}): { store: Map<string, string> } {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      if (options.failWrites) throw new Error('QuotaExceededError');
      store.set(key, String(value));
    },
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  return { store };
}

function resetStorage(): void {
  delete (globalThis as { window?: unknown }).window;
}

function readStored(store: Map<string, string>): ChatHistoryMap {
  return JSON.parse(store.get('flowbuilder_chat_history') ?? '{}') as ChatHistoryMap;
}

// Ids carry the epoch millis the merge orders by (see `createMessageId`).
function message(id: string, text = 'hello'): EditorChatMessage {
  return { id, role: 'user', text, time: '02:40 PM' };
}

const EXPORTED_AT = new Date('2026-09-21T12:40:00.000Z');

// Mirrors `useChatHistoryBackup`'s import path: reject the envelope, filter the
// incoming messages, merge, count what is new, write.
function importBackup(text: string): { error: string | null; restored: RestoreCount; saved: boolean } {
  const { backup, error } = parseBackup(t, text);
  if (!backup) return { error, restored: { messages: 0, flows: 0 }, saved: false };
  const current = loadAllChatHistory(storage);
  const merged = mergeChatHistory(current, sanitizeBackupHistory(backup.chatHistory));
  return { error: null, restored: countRestored(current, merged), saved: replaceAllChatHistory(storage, merged) };
}

test('a populated map round-trips through build → serialize → parse', () => {
  const map: ChatHistoryMap = {
    FLOW_A: [message('user-1000-aaaaa', 'Book an appointment flow')],
    FLOW_B: [message('user-2000-bbbbb', 'Lead capture')],
  };

  const { backup, error } = parseBackup(t, serializeBackup(buildBackup(map, EXPORTED_AT)));

  assert.equal(error, null);
  assert.deepEqual(backup, {
    kind: 'flowbuilder-local-backup',
    version: 1,
    exportedAt: '2026-09-21T12:40:00.000Z',
    chatHistory: map,
  });
});

test('backupFileName dates the download', () => {
  assert.equal(backupFileName(EXPORTED_AT), 'flowbuilder-chat-history-2026-09-21.json');
});

test('merging two transcripts for one flow interleaves them by embedded timestamp', () => {
  const current: ChatHistoryMap = { FLOW_A: [message('user-1000-aaaaa'), message('assistant-3000-ccccc')] };
  const incoming: ChatHistoryMap = { FLOW_A: [message('user-2000-bbbbb'), message('assistant-4000-ddddd')] };

  const merged = mergeChatHistory(current, incoming);

  assert.deepEqual(
    merged.FLOW_A.map((entry) => entry.id),
    ['user-1000-aaaaa', 'user-2000-bbbbb', 'assistant-3000-ccccc', 'assistant-4000-ddddd'],
  );
});

test('merging unions flow ids and never drops a local transcript', () => {
  const current: ChatHistoryMap = { LOCAL_ONLY: [message('user-1000-aaaaa')] };
  const incoming: ChatHistoryMap = { FILE_ONLY: [message('user-2000-bbbbb')] };

  assert.deepEqual(mergeChatHistory(current, incoming), {
    LOCAL_ONLY: [message('user-1000-aaaaa')],
    FILE_ONLY: [message('user-2000-bbbbb')],
  });
});

test('merging is idempotent — applying the same backup twice equals applying it once', () => {
  const current: ChatHistoryMap = { FLOW_A: [message('user-1000-aaaaa'), message('assistant-3000-ccccc')] };
  const incoming: ChatHistoryMap = { FLOW_A: [message('user-2000-bbbbb')], FLOW_B: [message('user-5000-eeeee')] };

  const once = mergeChatHistory(current, incoming);
  const twice = mergeChatHistory(once, incoming);

  assert.deepEqual(twice, once);
  assert.deepEqual(countRestored(once, twice), { messages: 0, flows: 0 });
});

test('messages with unparseable ids keep their source position', () => {
  const current: ChatHistoryMap = { FLOW_A: [message('user-1000-aaaaa'), message('u1'), message('assistant-3000-ccccc')] };
  const incoming: ChatHistoryMap = { FLOW_A: [message('user-2000-bbbbb')] };

  const merged = mergeChatHistory(current, incoming);

  // `u1` stays behind the turn it followed locally rather than sorting to the front.
  assert.deepEqual(
    merged.FLOW_A.map((entry) => entry.id),
    ['user-1000-aaaaa', 'u1', 'user-2000-bbbbb', 'assistant-3000-ccccc'],
  );
});

test('a backup with malformed messages imports only the valid ones, and counts what it stored', () => {
  const { store } = installStorage();
  try {
    replaceAllChatHistory(storage, { FLOW_A: [message('user-1000-aaaaa')] });

    const text = JSON.stringify({
      kind: 'flowbuilder-local-backup',
      version: 1,
      exportedAt: EXPORTED_AT.toISOString(),
      chatHistory: {
        FLOW_A: [
          message('user-1000-aaaaa'), // already local
          message('user-2000-bbbbb'), // the only genuinely new message
          { id: 'x', role: 'user' }, // missing text/time
          { id: 'y', role: 'wizard', text: 'nope', time: '10:03' }, // invalid role
          { id: 'p1', role: 'pending', text: 'Generating…', time: '10:04' },
          'not-an-object',
        ],
        FLOW_B: [{ id: 'z', role: 'user' }], // nothing salvageable
      },
    });

    const result = importBackup(text);

    assert.equal(result.error, null);
    assert.equal(result.saved, true);
    assert.deepEqual(result.restored, { messages: 1, flows: 1 });
    assert.deepEqual(readStored(store), {
      FLOW_A: [message('user-1000-aaaaa'), message('user-2000-bbbbb')],
    });
  } finally {
    resetStorage();
  }
});

test('a flow JSON file is rejected on kind, with no partial write', () => {
  const { store } = installStorage();
  try {
    replaceAllChatHistory(storage, { FLOW_A: [message('user-1000-aaaaa')] });
    const before = store.get('flowbuilder_chat_history');

    const result = importBackup(JSON.stringify({ version: '6.0', screens: [{ id: 'WELCOME', title: 'Welcome' }] }));

    assert.equal(result.error, "That file isn't a Flow Builder backup.");
    assert.equal(result.saved, false);
    assert.equal(store.get('flowbuilder_chat_history'), before);
  } finally {
    resetStorage();
  }
});

test('a newer format version is rejected', () => {
  const text = JSON.stringify({ kind: 'flowbuilder-local-backup', version: 2, exportedAt: '', chatHistory: {} });
  const { backup, error } = parseBackup(t, text);

  assert.equal(backup, null);
  assert.equal(error, 'This backup was made by a newer version of Flow Builder.');
});

test('a file that is not JSON is rejected', () => {
  const { backup, error } = parseBackup(t, 'this is not json');

  assert.equal(backup, null);
  assert.equal(error, "That file isn't valid JSON.");
});

test('an empty map exports a valid file and imports as a no-op', () => {
  const { store } = installStorage();
  try {
    replaceAllChatHistory(storage, { FLOW_A: [message('user-1000-aaaaa')] });
    const before = store.get('flowbuilder_chat_history');

    const text = serializeBackup(buildBackup({}, EXPORTED_AT));
    const result = importBackup(text);

    assert.equal(result.error, null);
    assert.deepEqual(result.restored, { messages: 0, flows: 0 });
    assert.equal(store.get('flowbuilder_chat_history'), before);
  } finally {
    resetStorage();
  }
});

test('loadAllChatHistory returns every transcript, sanitized', () => {
  const { store } = installStorage();
  try {
    store.set(
      'flowbuilder_chat_history',
      JSON.stringify({
        FLOW_A: [message('user-1000-aaaaa'), { id: 'p1', role: 'pending', text: 'Generating…', time: '10:04' }],
        FLOW_B: ['junk'],
      }),
    );

    assert.deepEqual(loadAllChatHistory(storage), { FLOW_A: [message('user-1000-aaaaa')] });
  } finally {
    resetStorage();
  }
});

test('describeRestore reports what the write added, singular and plural', () => {
  assert.equal(describeRestore(t, { messages: 0, flows: 0 }), 'That backup is already restored.');
  assert.equal(describeRestore(t, { messages: 1, flows: 1 }), 'Restored 1 message across 1 flow.');
  assert.equal(describeRestore(t, { messages: 7, flows: 2 }), 'Restored 7 messages across 2 flows.');
});

test('replaceAllChatHistory returns false when the write fails', () => {
  installStorage({ failWrites: true });
  try {
    assert.equal(replaceAllChatHistory(storage, { FLOW_A: [message('user-1000-aaaaa')] }), false);
  } finally {
    resetStorage();
  }

  // No storage at all (SSR / private mode without `window`) reports the same way.
  assert.equal(replaceAllChatHistory(storage, { FLOW_A: [message('user-1000-aaaaa')] }), false);
});

test('parseBackup: names the host product in its rejections when given one', () => {
  assert.equal(parseBackup(t, '{"kind":"other"}', 'Acme Flows').error, "That file isn't a Acme Flows backup.");
  assert.equal(parseBackup(t, JSON.stringify({ kind: 'flowbuilder-local-backup', version: 99 }), 'Acme Flows').error, 'This backup was made by a newer version of Acme Flows.');
});

test('describeRestore and parseBackup follow the host catalogue', () => {
  const pl = createI18n({
    locale: 'pl',
    messages: { settings: { chatHistory: { results: { restored: 'Przywrócono {messages|one:# wiadomość|few:# wiadomości|other:# wiadomości}.' }, errors: { notBackup: 'To nie jest kopia {productName}.' } } } },
  }).t;
  assert.equal(describeRestore(pl, { messages: 3, flows: 1 }), 'Przywrócono 3 wiadomości.');
  assert.equal(parseBackup(pl, '{"kind":"other"}').error, 'To nie jest kopia Flow Builder.');
});
