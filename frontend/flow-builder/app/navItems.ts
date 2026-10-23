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

import type { ResolvedFlowBuilderFeatures } from './hostConfig';

// Naming the keys keeps the shell's two tables in step: a new nav item without
// a destination (or the reverse) is a compile error rather than a dead button.
export type NavKey = 'library' | 'editor' | 'settings';

/** The nav keys the rail shows: Settings goes when the host turns it off. */
export function visibleNavKeys(features: Pick<ResolvedFlowBuilderFeatures, 'settings'>): NavKey[] {
  return features.settings ? ['library', 'editor', 'settings'] : ['library', 'editor'];
}
