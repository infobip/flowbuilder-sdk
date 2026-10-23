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

// English messages for the `notices.*` keys: outcomes the editor reports (generated, created, saved, published, deleted…).

export const notices = {
  progress: {
    submitting: 'Submitting prompt…',
    generating: 'Generating flow…',
  },
  success: {
    created: 'Flow created.',
    updated: 'Flow updated.',
    draftSaved: 'Draft saved.',
    published: 'Flow published.',
  },
  errors: {
    loadFailed: 'Unable to load this flow.',
    generateFailed: 'Unable to generate this flow.',
    refreshDraftFailed: 'Unable to refresh this draft.',
    uploadImageFailed: 'Unable to upload image {number}.',
    saveFailed: 'Unable to save this draft.',
    publishFailed: 'Unable to publish this flow.',
    deleteFailed: 'Unable to delete this flow.',
    jsonEmpty: 'Flow JSON is empty.',
    invalidJson: 'Invalid JSON.',
    flowShape: 'Flow JSON must include a version string and screens array.',
    generateFirst: 'Generate a flow first.',
    generateFirstUpload: 'Generate a flow first, then upload the image.',
    pngOnly: 'Only PNG images are supported.',
    fileReadFailed: 'Unable to read the selected file.',
    imageGone: 'That image is no longer available in the current JSON.',
    notAValidFlow: 'The current JSON is not a valid WhatsApp Flow.',
    nothingToSave: 'Make a title or JSON change before saving.',
    fixJsonBeforeSaving: 'Fix the JSON before saving.',
    resolveJsonError: 'Resolve the JSON error before publishing.',
    resolveValidationErrors: 'Resolve validation errors before publishing.',
    onlyDraftsPublish: 'Only draft flows can be published.',
    saveBeforePublish: 'Save your changes before publishing.',
    publishUnavailable: 'Publish is unavailable.',
    onlyDraftsDelete: 'Only draft flows can be deleted.',
    deleteUnavailable: 'Delete is unavailable.',
  },
};
