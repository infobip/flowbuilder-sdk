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

// ── English catalogue ──────────────────────────────────────────────────────
//
// The source catalogue: every key the builder uses exists here, and its type
// is the contract other languages fill (`FlowBuilderMessages`). One file per
// area keeps each one reviewable on its own.

import { codeEditor } from './codeEditor';
import { common } from './common';
import { editor } from './editor';
import { errors } from './errors';
import { library } from './library';
import { notices } from './notices';
import { preview } from './preview';
import { settings } from './settings';
import { validation } from './validation';

export const en = { common, library, editor, codeEditor, preview, settings, notices, errors, validation };
