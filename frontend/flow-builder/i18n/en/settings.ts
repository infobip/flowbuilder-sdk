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

// English messages for the `settings.*` keys.
//
// The page subtitle names only the sections that are on. There are seven
// combinations, so each gets a whole-sentence key (`subtitle.*`) rather than
// a list joined from fragments: word order and list punctuation differ
// between languages.

export const settings = {
  title: 'Settings',
  eyebrow: 'Settings',
  subtitle: {
    appearance: 'Appearance.',
    chatHistory: 'Chat history.',
    apiKey: 'The API key this builder runs on.',
    appearanceChatHistory: 'Appearance and chat history.',
    appearanceApiKey: 'Appearance and the API key this builder runs on.',
    chatHistoryApiKey: 'Chat history and the API key this builder runs on.',
    all: 'Appearance, chat history, and the API key this builder runs on.',
  },
  appearance: {
    title: 'Appearance',
    description: 'Applies to the whole builder and is remembered in this browser.',
    theme: {
      title: 'Theme',
      description: 'Dark mode also follows your system setting until you pick one here.',
      light: 'Light',
      dark: 'Dark',
    },
    brand: {
      title: 'Brand',
      description: 'Sets the colours, corners, fonts and logo. Works in light and dark.',
      // Proper nouns, but keyed so a host can rename them.
      names: {
        default: 'AI Flow Builder',
        indigo: 'Indigo',
      },
    },
  },
  chatHistory: {
    title: 'Chat history',
    description: 'Editor conversations are stored in this browser only. Export them to move to another machine, or to keep a copy.',
    backup: {
      title: 'Backup file',
      importHint: 'Importing merges into what you already have — nothing is overwritten.',
      emptyHint: 'There are no saved conversations to export yet.',
      export: 'Export',
      import: 'Import',
    },
    stored: {
      title: 'Stored conversations',
      description: 'Deletes every transcript in this browser. Export first if you want them back.',
      clear: 'Clear history',
    },
    confirmClear: {
      title: 'Clear chat history',
      confirm: 'Clear history',
      message: "Delete every saved conversation in this browser? Anything you haven't exported is gone for good.",
    },
    // What the backup rejections call the product when the host gave no name.
    backupProductName: 'Flow Builder',
    errors: {
      notJson: "That file isn't valid JSON.",
      notBackup: "That file isn't a {productName} backup.",
      newerVersion: 'This backup was made by a newer version of {productName}.',
      unreadable: "Couldn't read that file.",
      restoreFailed: "Couldn't save the restored history — your browser may be out of storage or in private mode.",
      clearFailed: "Couldn't clear the saved history — your browser may be in private mode.",
    },
    results: {
      alreadyRestored: 'That backup is already restored.',
      restored: 'Restored {messages|one:# message|other:# messages} across {flows|one:# flow|other:# flows}.',
      cleared: 'Cleared every saved conversation.',
    },
  },
  apiKey: {
    title: 'API key',
    description: "Requests reach Infobip through this app's server, which holds the credential. A key set here replaces the configured one until the server restarts.",
    inUse: 'In use',
    unavailable: 'unavailable',
    sourceOverride: 'Set here',
    sourceServer: 'Server default',
    fieldLabel: 'New API key',
    placeholder: 'Paste a key to replace the one in use',
    hint: 'Checked against Infobip before it is applied, so a wrong key changes nothing.',
    save: 'Save key',
    saving: 'Checking…',
    reset: 'Use server default',
    resetting: 'Resetting…',
    results: {
      saved: 'API key updated. It applies until the server restarts.',
      reset: "Back to the server's configured API key.",
    },
    errors: {
      load: "Couldn't read the current API key.",
      save: "Couldn't save that API key.",
      reset: "Couldn't reset the API key.",
    },
  },
};
