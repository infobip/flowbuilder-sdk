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

import {
  type JsonPathKey,
  type JsonImageUploadTarget,
} from '../../flowJsonDraft';

export type ImageUploadSlot = JsonImageUploadTarget & {
  key: string;
  number: number;
  filled: boolean;
};

export function imageUploadTargetKey(target: Pick<JsonImageUploadTarget, 'path'>): string {
  return JSON.stringify(target.path);
}

const BASE64_PLACEHOLDER = 'PUT-YOUR-BASE64-HERE';
const DATA_REFERENCE = /^\s*\$\{\s*data\.([A-Za-z0-9_-]+)\s*\}\s*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isFilledImageValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const source = value.trim();
  return source.length > 0
    && !source.includes(BASE64_PLACEHOLDER)
    && !source.startsWith('${');
}

function resolveImageSourceTarget(
  source: unknown,
  sourcePath: JsonPathKey[],
  screen: Record<string, unknown>,
  screenPath: JsonPathKey[],
): { path: JsonPathKey[]; value: unknown } {
  if (typeof source !== 'string') return { path: sourcePath, value: source };

  const reference = DATA_REFERENCE.exec(source);
  if (!reference) return { path: sourcePath, value: source };

  const data = isRecord(screen.data) ? screen.data : null;
  if (!data || !hasOwn(data, reference[1])) {
    return { path: sourcePath, value: source };
  }

  const field = data[reference[1]];
  const fieldPath = screenPath.concat('data', reference[1]);
  if (isRecord(field)) {
    return { path: fieldPath.concat('__example__'), value: field.__example__ };
  }
  return { path: fieldPath, value: field };
}

function collectSlotsFromValue(value: unknown): ImageUploadSlot[] {
  const slots: ImageUploadSlot[] = [];
  const seen = new Set<string>();

  const addSlot = (path: JsonPathKey[], currentValue: unknown) => {
    const key = imageUploadTargetKey({ path });
    if (seen.has(key)) return;
    seen.add(key);
    const number = slots.length + 1;
    slots.push({
      key,
      number,
      label: `Image ${number}`,
      path,
      filled: isFilledImageValue(currentValue),
    });
  };

  const scanImageSources = (
    current: unknown,
    path: JsonPathKey[],
    screen: Record<string, unknown>,
    screenPath: JsonPathKey[],
  ): void => {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => scanImageSources(entry, path.concat(index), screen, screenPath));
      return;
    }
    if (!isRecord(current)) return;

    const isImageComponent = current.type === 'Image';
    const hasSource = hasOwn(current, 'src');
    const sourceKeys: string[] = [];
    if (isImageComponent || hasSource) sourceKeys.push('src');
    // Data-source options can carry a thumbnail in their `image` field.
    if (typeof current.image === 'string') sourceKeys.push('image');

    for (const sourceKey of sourceKeys) {
      const target = resolveImageSourceTarget(current[sourceKey], path.concat(sourceKey), screen, screenPath);
      addSlot(target.path, target.value);
    }

    for (const [key, child] of Object.entries(current)) {
      if (sourceKeys.includes(key)) continue;
      scanImageSources(child, path.concat(key), screen, screenPath);
    }
  };

  if (isRecord(value) && Array.isArray(value.screens)) {
    value.screens.forEach((candidate, index) => {
      if (!isRecord(candidate)) return;
      const screenPath: JsonPathKey[] = ['screens', index];
      scanImageSources(candidate, screenPath, candidate, screenPath);
    });
  } else if (isRecord(value)) {
    scanImageSources(value, [], value, []);
  }

  // Preserve support for generated placeholder fields that are not attached to
  // a recognizable Image node. Once filled, only real image nodes remain
  // replaceable because an orphan value has no image semantics left in JSON.
  const scanOrphanPlaceholders = (current: unknown, path: JsonPathKey[]): void => {
    if (typeof current === 'string') {
      if (current.includes(BASE64_PLACEHOLDER)) addSlot(path, current);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((entry, index) => scanOrphanPlaceholders(entry, path.concat(index)));
      return;
    }
    if (!isRecord(current)) return;
    for (const [key, child] of Object.entries(current)) {
      scanOrphanPlaceholders(child, path.concat(key));
    }
  };
  scanOrphanPlaceholders(value, []);

  return slots;
}

/**
 * Reads every editable image source from the live JSON editor draft.
 * Invalid or incomplete JSON deliberately produces no controls; the buttons
 * return as soon as the draft can be parsed again. Filled slots stay present
 * so an existing image can be replaced.
 */
export function collectImageUploadSlots(jsonDraft: string): ImageUploadSlot[] {
  if (!jsonDraft.trim()) return [];

  try {
    return collectSlotsFromValue(JSON.parse(jsonDraft) as unknown);
  } catch {
    return [];
  }
}

export function isImageUploadSlotAvailable(jsonDraft: string, target: Pick<JsonImageUploadTarget, 'path'>): boolean {
  const key = imageUploadTargetKey(target);
  return collectImageUploadSlots(jsonDraft).some((slot) => slot.key === key);
}
