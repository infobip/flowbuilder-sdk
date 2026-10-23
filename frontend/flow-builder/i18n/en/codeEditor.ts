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

// English messages for the `codeEditor.*` keys: the JSON code editor, its find widget, the live preview panel and the image upload buttons.

export const codeEditor = {
  label: 'Flow JSON editor',
  textareaLabel: 'Flow JSON',
  unsavedChanges: 'Unsaved changes',
  // `{keys}` is the keycap (a <kbd> element); see i18n/rich.tsx.
  hints: {
    find: '{keys} find',
    format: '{keys} format',
    save: '{keys} save',
  },
  saveChanges: 'Save changes',
  saving: 'Saving…',
  emptyHint: '{ }  Paste or write the flow JSON here',
  copy: 'Copy',
  copied: 'Copied',
  notices: {
    cannotFormat: "Can't format — the draft isn't valid JSON yet.",
    alreadyFormatted: 'Already formatted.',
    formatted: 'Formatted.',
    copyBlocked: 'Copy blocked — press {mod}A then {mod}C.',
    tabMovesFocus: 'Tab now moves focus out of the editor.',
  },
  status: {
    noProblems: 'No problems',
    issues: '{count|one:# issue|other:# issues} · {message}',
    position: 'Ln {line}, Col {column}',
    positionSelected: 'Ln {line}, Col {column} ({selected} selected)',
    spaces: 'Spaces: {count}',
    lines: '{count|one:# line|other:# lines}',
  },
  find: {
    label: 'Find in flow JSON',
    placeholder: 'Find',
    inputLabel: 'Find',
    noResults: 'No results',
    counter: '{current} of {total}',
    matchCaseOn: 'Match case on',
    matchCaseOff: 'Match case off',
    hints: {
      next: '{keys} next',
      previous: '{keys} previous',
      matchCase: '{keys} match case',
      close: '{keys} close',
    },
  },
  preview: {
    building: 'Building your preview…',
    emptyTitle: 'Your preview will appear here',
    emptyText: 'Describe a flow to see the live WhatsApp preview.',
    unavailableTitle: 'Preview unavailable',
    couldNotLoad: 'The preview could not be loaded.',
    nothingYet: 'Nothing to preview yet',
    label: 'Flow preview',
  },
  images: {
    label: 'Flow image uploads',
    title: 'Flow images',
    allFilled: '{count|one:# image|other:# images} · Replace any image · PNG only',
    needsOne: '1 image needs an upload · PNG only',
    needsMany: '{missing} of {total} images need an upload · PNG only',
    needsOneOfMany: '{missing} of {total} images needs an upload · PNG only',
    upload: 'Upload image {number}',
    replace: 'Replace image {number}',
    uploading: 'Uploading image {number}…',
  },
};
