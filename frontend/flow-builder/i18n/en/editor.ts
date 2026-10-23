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

// English messages for the `editor.*` keys: the editor page, its top bar and chat panel, the starter prompts and the validation issues list.

export const editor = {
  untitledFlow: 'Untitled flow',
  documentTitle: {
    create: 'Create flow · {productName}',
    named: '{title} · {productName}',
    edit: 'Edit flow · {productName}',
  },
  status: {
    draft: 'Draft',
    saved: 'Saved',
  },
  modes: {
    label: 'Editor mode',
    prompt: 'Prompt',
    json: 'JSON editor',
  },
  topBar: {
    backToLibrary: 'Flow library',
    titleLabel: 'Flow title',
    rename: 'Rename flow',
    fixErrors: 'Fix errors',
    fixErrorsCount: 'Fix errors ({count})',
    fixing: 'Fixing…',
  },
  preview: {
    sectionLabel: 'Live preview',
    builderLabel: 'Flow builder',
    title: 'Preview',
    expires: 'Preview expires {time}',
    status: {
      generating: 'generating',
      idle: 'idle',
      loading: 'loading',
      ready: 'ready',
      unavailable: 'unavailable',
      error: 'error',
    },
  },
  validation: {
    title: 'Validation issues',
    count: '{count|one:# issue|other:# issues}',
    unknownIssue: 'Validation issue.',
    severity: {
      error: 'error',
      warning: 'warning',
    },
    goToLine: 'Go to line',
    lineColumn: 'Line {line}, Column {column}',
    line: 'Line {line}',
    noLineInfo: 'No line information',
    locationWithPath: '{location} · {path}',
  },
  errorTitles: {
    generation: 'Generation failed',
    save: 'Save failed',
    publish: 'Publish failed',
    delete: 'Delete failed',
  },
  actions: {
    favorite: 'Favorite',
    removeFavorite: 'Remove favorite',
    delete: 'Delete',
    deleting: 'Deleting…',
    saveDraft: 'Save draft',
    saving: 'Saving…',
    publish: 'Publish',
    publishing: 'Publishing…',
    publishNotice: 'Nothing will be published without your review.',
  },
  deleteDialog: {
    title: 'Delete flow?',
    message: 'Delete {name}? This removes it from the library and cannot be undone.',
    fallbackName: 'this flow',
    confirm: 'Delete flow',
    cancel: 'Cancel',
  },
  publishDialog: {
    title: 'Publish flow?',
    message: 'Publish {name}? It will move from Draft to Published after the existing validation checks pass.',
    fallbackName: 'this draft',
    confirm: 'Publish flow',
    cancel: 'Cancel',
  },
  chat: {
    typing: 'Generating',
    placeholderChange: 'Describe a change to your flow…',
    placeholderNew: 'Describe the flow you want to build…',
    generate: 'Generate',
    generating: 'Generating…',
    heroTitle: 'What do you want to build?',
    heroText: "Describe your WhatsApp Flow in plain language and we'll generate it for you.",
    fixErrorsLabel: 'Fix the validation errors in this flow.',
    summaryCreated: 'Created your flow with {count|one:# screen|other:# screens}.',
    summaryCreatedWithIds: 'Created your flow with {count|one:# screen|other:# screens}: {ids}.',
    summaryUpdated: 'Updated your flow — {count|one:# screen|other:# screens}.',
    summaryUpdatedWithIds: 'Updated your flow — {count|one:# screen|other:# screens}: {ids}.',
  },
  // Starter cards on a blank flow. The prompt is sent to the AI as written, so
  // translating it is intended: the generated flow follows its language.
  starters: {
    appointment: {
      label: 'Appointment booking',
      prompt: 'A 3-step appointment booking flow with name, preferred date, and service type',
    },
    lead: {
      label: 'Lead generation',
      prompt: 'A lead generation flow collecting name, email, company, and interest area',
    },
    survey: {
      label: 'Customer survey',
      prompt: 'A customer satisfaction survey with a rating scale and open feedback field',
    },
    event: {
      label: 'Event registration',
      prompt: 'An event registration flow collecting attendee details, ticket type, and dietary preferences',
    },
  },
};
