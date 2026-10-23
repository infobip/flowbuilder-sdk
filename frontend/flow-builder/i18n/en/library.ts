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

// English messages for the `library.*` keys: the flow library page, its toolbar, cards, table and dialogs.

export const library = {
  header: {
    eyebrow: 'Flow library',
    title: 'Flow library',
    count: '{count|one:# flow|other:# flows}',
    createFlow: 'Create flow',
  },
  createTile: {
    title: 'Create a new flow',
    description: 'Design a WhatsApp flow from scratch.',
  },
  listLabel: 'Flows',
  toolbar: {
    label: 'Flow filters',
    statusTabs: 'Filter by status',
    searchLabel: 'Search flows',
    searchPlaceholder: 'Search by name or ID…',
    categoryFilter: 'Filter by category',
    allCategories: 'All categories',
    layoutLabel: 'Flow list layout',
    refresh: 'Refresh',
  },
  statusFilter: {
    ALL: 'All',
    DRAFT: 'Drafts',
    PUBLISHED: 'Published',
  },
  layout: {
    grid: 'Cards',
    table: 'Table',
  },
  status: {
    none: 'New',
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    DEPRECATED: 'Deprecated',
    BLOCKED: 'Blocked',
    THROTTLED: 'Throttled',
  },
  category: {
    SIGN_UP: 'Sign Up',
    SIGN_IN: 'Sign In',
    APPOINTMENT_BOOKING: 'Appointment Booking',
    LEAD_GENERATION: 'Lead Generation',
    CONTACT_US: 'Contact Us',
    CUSTOMER_SUPPORT: 'Customer Support',
    SURVEY: 'Survey',
    OTHER: 'Other',
    uncategorized: 'Uncategorized',
  },
  actions: {
    edit: 'Edit',
    view: 'View',
    publish: 'Publish',
    delete: 'Delete',
    editAria: 'Edit {name}',
    viewAria: 'View {name}',
    publishAria: 'Publish {name}',
    deleteAria: 'Delete {name}',
  },
  card: {
    noPreview: 'No preview',
    previewAria: '{name} preview',
  },
  table: {
    caption: 'Flows, with the status and available actions for each.',
    columns: {
      name: 'Flow',
      status: 'Status',
      categories: 'Categories',
      updated: 'Updated',
      actions: 'Actions',
    },
  },
  pagination: {
    label: 'Flow pages',
    range: 'Showing {start}–{end} of {total}',
    rowsPerPage: 'Rows per page',
    rows: '{size} rows',
    previous: 'Previous page',
    next: 'Next page',
  },
  empty: {
    noFlows: {
      title: 'No flows yet',
      message: 'Create your first WhatsApp flow to get started.',
    },
    noMatches: {
      title: 'No matching flows',
      message: 'Try a different search term, status, or category filter.',
      clearFilters: 'Clear filters',
    },
  },
  deleteDialog: {
    title: 'Delete flow',
    confirm: 'Delete',
    message: 'Permanently delete {name}? This cannot be undone.',
  },
  publishDialog: {
    title: 'Publish flow',
    confirm: 'Publish',
    message: 'Publish {name}? It will move from Draft to Published after the existing validation checks pass.',
  },
  relative: {
    justNow: 'just now',
    minutesAgo: '{count|one:# min|other:# mins} ago',
    hoursAgo: '{count|one:# hour|other:# hours} ago',
    daysAgo: '{count|one:# day|other:# days} ago',
    unknown: '—',
  },
  errors: {
    loadFailed: 'Unable to load flows.',
    deleteFailed: 'Delete failed.',
    publishFailed: 'Publish failed.',
  },
};
