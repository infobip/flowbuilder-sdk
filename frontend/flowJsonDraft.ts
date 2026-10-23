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

// Pure, React/DOM-state-free helpers for the editor's image uploads: splicing
// a chosen PNG into a WhatsApp Flow JSON draft by replacing one nested field
// immutably, and reading the file as base64.
import { isWhatsAppFlow, type WhatsAppFlow } from './shared';

export type JsonPathKey = string | number;

export type JsonImageUploadTarget = {
  label: string;
  path: JsonPathKey[];
};

/** Immutably replaces the value at `path` inside a parsed JSON draft. */
export function replaceJsonValueAtPath(value: unknown, path: JsonPathKey[], nextValue: unknown): unknown {
  if (!path.length) return nextValue;

  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    if (typeof head !== 'number' || head < 0 || head >= value.length) return value;
    const next = value.slice();
    next[head] = replaceJsonValueAtPath(next[head], rest, nextValue);
    return next;
  }

  if (value && typeof value === 'object') {
    const key = String(head);
    const next = { ...(value as Record<string, unknown>) };
    next[key] = replaceJsonValueAtPath((value as Record<string, unknown>)[key], rest, nextValue);
    return next;
  }

  return value;
}

export type PngFileError = 'notPng';

/** Validates a chosen upload file is a PNG. Returns a stable code, not text,
 * so the caller words it from the message catalogue. */
export function validatePngFile(file: File): PngFileError | null {
  if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) return null;
  return 'notPng';
}

/** Thrown by `readFileAsBase64` when the browser can't read the file; the
 * caller words it from the catalogue (`notices.errors.fileReadFailed`). */
export class FileReadError extends Error {
  constructor() {
    super('FILE_READ_FAILED');
    this.name = 'FileReadError';
  }
}

export type JsonImageUploadResult = {
  nextDraftObject: unknown;
  nextDraftText: string;
  nextFlow: WhatsAppFlow | null;
};

/** Splices a base64 PNG into the JSON draft at `target.path` and
 * re-serializes it. Throws if `draftText` isn't valid JSON; the caller wraps
 * the call in a try/catch to surface the upload error. */
export function applyPngUploadToDraft(draftText: string, target: JsonImageUploadTarget, base64: string): JsonImageUploadResult {
  const parsedDraft = JSON.parse(draftText) as unknown;
  const nextDraftObject = replaceJsonValueAtPath(parsedDraft, target.path, base64);
  const nextDraftText = JSON.stringify(nextDraftObject, null, 2);
  const nextFlow = isWhatsAppFlow(nextDraftObject) ? (nextDraftObject as WhatsAppFlow) : null;
  return { nextDraftObject, nextDraftText, nextFlow };
}

/** Reads a File into a base64 string, stripping the `data:...;base64,` prefix. */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const commaIndex = reader.result.indexOf(',');
        resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
        return;
      }
      reject(new FileReadError());
    };
    reader.onerror = () => reject(new FileReadError());
    reader.readAsDataURL(file);
  });
}
