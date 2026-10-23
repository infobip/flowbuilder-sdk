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

// Chat history backup hook: the browser-side half of Export / Import on the
// settings page. The envelope, the merge and the restore count are pure and
// live in `services/chatHistoryBackup.ts`; what is left here is the part that
// needs a document — saving a file, reading one back — plus the one line of
// feedback the page shows afterwards.

import { useCallback, useState } from 'react';
import { useHostConfig } from '../app/hostConfig';
import { useT } from '../i18n/I18nProvider';
import { useInstance } from '../app/instanceContext';
import { clearAllChatHistory, loadAllChatHistory, replaceAllChatHistory } from '../services/chatHistory';
import {
  backupFileName,
  buildBackup,
  countRestored,
  describeRestore,
  mergeChatHistory,
  parseBackup,
  sanitizeBackupHistory,
  serializeBackup,
} from '../services/chatHistoryBackup';

/** Outcome of the last export/import attempt, shown as one line under the controls. */
export type ChatHistoryResult = { tone: 'info' | 'error'; text: string };

export type ChatHistoryBackupState = {
  /** False when there is nothing to export or clear, so the buttons can say so. */
  hasHistory: boolean;
  result: ChatHistoryResult | null;
  exportHistory: () => void;
  importHistory: (file: File) => void;
  clearHistory: () => void;
};

function saveFile(contents: string, fileName: string, container: HTMLElement): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // Anchored in the document — inside the builder's own root, never the host's
  // body — and revoked a tick later: Safari drops the download when the object
  // URL dies in the same task as the click.
  link.hidden = true;
  container.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function useChatHistoryBackup(): ChatHistoryBackupState {
  const { storage, getRoot } = useInstance();
  // Only a host-chosen name changes the copy; the standalone wording stays "Flow Builder".
  const hostProductName = useHostConfig().brand.productName;
  const t = useT();
  const [hasHistory, setHasHistory] = useState(() => Object.keys(loadAllChatHistory(storage)).length > 0);
  const [result, setResult] = useState<ChatHistoryResult | null>(null);

  const exportHistory = useCallback(() => {
    const now = new Date();
    saveFile(serializeBackup(buildBackup(loadAllChatHistory(storage), now)), backupFileName(now), getRoot() ?? document.body);
  }, [storage, getRoot]);

  // Reject the envelope, filter the incoming messages, merge, then report what
  // the write actually added — never what the file happened to contain.
  const restore = useCallback((text: string) => {
    const { backup, error } = parseBackup(t, text, hostProductName);
    if (!backup) {
      setResult({ tone: 'error', text: error ?? t('settings.chatHistory.errors.notBackup', { productName: hostProductName ?? t('settings.chatHistory.backupProductName') }) });
      return;
    }

    const current = loadAllChatHistory(storage);
    const merged = mergeChatHistory(current, sanitizeBackupHistory(backup.chatHistory));
    const restored = countRestored(current, merged);

    if (!replaceAllChatHistory(storage, merged)) {
      setResult({
        tone: 'error',
        text: t('settings.chatHistory.errors.restoreFailed'),
      });
      return;
    }

    setHasHistory(Object.keys(merged).length > 0);
    setResult({ tone: 'info', text: describeRestore(t, restored) });
  }, [storage, hostProductName, t]);

  const importHistory = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => restore(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => setResult({ tone: 'error', text: t('settings.chatHistory.errors.unreadable') });
      reader.readAsText(file);
    },
    [restore, t],
  );

  const clearHistory = useCallback(() => {
    if (!clearAllChatHistory(storage)) {
      setResult({
        tone: 'error',
        text: t('settings.chatHistory.errors.clearFailed'),
      });
      return;
    }
    setHasHistory(false);
    setResult({ tone: 'info', text: t('settings.chatHistory.results.cleared') });
  }, [storage, t]);

  return { hasHistory, result, exportHistory, importHistory, clearHistory };
}
