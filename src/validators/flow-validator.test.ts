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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WhatsAppFlow } from '../types/flow.ts';
import { FLOW_VALIDATION_ERROR_CODES, validateFlow, type FlowValidationErrorCode } from './flow-validator.ts';

// The editor validates JSON while it is being typed, so half-built flows reach
// the validator. Each of these must come back as errors, never as a throw.
function errorPaths(flow: unknown): string[] {
  return validateFlow(flow as WhatsAppFlow).errors.map((error) => error.path);
}

const done = { type: 'Footer', label: 'Done', 'on-click-action': { name: 'complete' } };

function screen(id: string, children: unknown[], extra: Record<string, unknown> = {}) {
  return { id, title: id, layout: { type: 'SingleColumnLayout', children }, ...extra };
}

test('a well-formed flow is valid', () => {
  const flow = { version: '6.0', screens: [screen('A', [done], { terminal: true })] };

  assert.deepEqual(validateFlow(flow as WhatsAppFlow), { valid: true, errors: [] });
});

test('a screen without a layout is reported', () => {
  const flow = { version: '6.0', screens: [{ id: 'A', title: 'A', terminal: true }] };

  assert.ok(errorPaths(flow).includes('screens[0].layout'));
});

test('a layout without children is reported', () => {
  const flow = { version: '6.0', screens: [{ id: 'A', title: 'A', terminal: true, layout: { type: 'SingleColumnLayout' } }] };

  assert.ok(errorPaths(flow).includes('screens[0].layout.children'));
});

test('a Footer without an on-click-action is reported', () => {
  const flow = { version: '6.0', screens: [screen('A', [{ type: 'Footer', label: 'Done' }], { terminal: true })] };

  assert.ok(errorPaths(flow).includes('screens[0].layout.children[0].on-click-action'));
});

test('screens and components that are not objects are reported', () => {
  const flow = { version: '6.0', screens: [null, screen('B', [null, 'text', done], { terminal: true })] };
  const paths = errorPaths(flow);

  assert.ok(paths.includes('screens[0]'));
  assert.ok(paths.includes('screens[1].layout.children[0]'));
  assert.ok(paths.includes('screens[1].layout.children[1]'));
});

test('navigation targets are still checked when another screen is malformed', () => {
  const next = { type: 'Footer', label: 'Next', 'on-click-action': { name: 'navigate', next: { type: 'screen', name: 'MISSING' } } };
  const flow = { version: '6.0', screens: [screen('A', [next]), { id: 'B', title: 'B', terminal: true }] };

  assert.ok(errorPaths(flow).includes('screens[0].layout.children[0].on-click-action.next.name'));
});

test('components and navigation targets in If branches are validated with nested paths', () => {
  const flow = {
    version: '6.0',
    screens: [
      screen('A', [
        { type: 'TextInput', name: 'email' },
        {
          type: 'If',
          condition: 'has-email',
          then: [
            { type: 'TextInput', name: 'email' },
            { type: 'Dropdown', name: 'choice', 'data-source': [] },
            { type: 'Footer', label: 'Next', 'on-click-action': { name: 'navigate', next: { type: 'screen', name: 'MISSING' } } },
          ],
          else: [{ type: 'Footer', label: 'Continue' }],
        },
      ]),
      screen('B', [done], { terminal: true }),
    ],
  };

  const paths = errorPaths(flow);
  assert.ok(paths.includes('screens[0].layout.children[1].then[0].name'));
  assert.ok(paths.includes('screens[0].layout.children[1].then[1].data-source'));
  assert.ok(paths.includes('screens[0].layout.children[1].then[2].on-click-action.next.name'));
  assert.ok(paths.includes('screens[0].layout.children[1].else[0].on-click-action'));
});

test('valid If branches pass and malformed branch values do not throw', () => {
  const valid = {
    version: '6.0',
    screens: [
      screen('A', [{
        type: 'If',
        condition: 'ready',
        then: [{ type: 'Footer', label: 'Next', 'on-click-action': { name: 'navigate', next: { type: 'screen', name: 'B' } } }],
        else: [{ type: 'Footer', label: 'Next', 'on-click-action': { name: 'navigate', next: { type: 'screen', name: 'B' } } }],
      }]),
      screen('B', [done], { terminal: true }),
    ],
  };
  const malformed = {
    version: '6.0',
    screens: [screen('A', [{ type: 'If', condition: 'ready', then: 'not-an-array', else: null }, done], { terminal: true })],
  };

  assert.equal(validateFlow(valid as WhatsAppFlow).valid, true);
  assert.doesNotThrow(() => validateFlow(malformed as WhatsAppFlow));
});

function navigateTo(next: unknown) {
  const action = next === undefined ? { name: 'navigate' } : { name: 'navigate', next };
  return { version: '6.0', screens: [screen('A', [{ type: 'Footer', label: 'Next', 'on-click-action': action }]), screen('B', [done], { terminal: true })] };
}

test('a navigate action that does not name a next screen is reported', () => {
  for (const next of [undefined, 'B', { type: 'screen' }, { type: 'screen', name: 5 }]) {
    assert.ok(errorPaths(navigateTo(next)).includes('screens[0].layout.children[0].on-click-action.next'), `next: ${JSON.stringify(next)}`);
  }
});

test('values that cannot be turned into text do not break the error messages', () => {
  const unprintable = JSON.parse('{"toString": null}') as unknown;
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  assert.ok(errorPaths(navigateTo({ type: 'screen', name: unprintable })).includes('screens[0].layout.children[0].on-click-action.next'));
  for (const id of [{ toString: null }, 10n, circular]) {
    const flow = { version: '6.0', screens: [screen('A', [done], { id, terminal: true }), screen('B', [done], { id })] };
    assert.ok(errorPaths(flow).includes('screens[1].id'), `id: ${typeof id}`);
  }
});

// ── Error codes ────────────────────────────────────────────────────────────

// One flow per code, each built to trigger it.
const triggers: Record<FlowValidationErrorCode, unknown> = {
  VERSION_REQUIRED: { screens: [screen('A', [done], { terminal: true })] },
  SCREENS_REQUIRED: { version: '6.0', screens: [] },
  SCREEN_NOT_OBJECT: { version: '6.0', screens: [null, screen('A', [done], { terminal: true })] },
  SCREEN_ID_DUPLICATE: {
    version: '6.0',
    screens: [screen('WELCOME', [done], { terminal: true }), screen('WELCOME', [done])],
  },
  SCREEN_ID_REQUIRED: { version: '6.0', screens: [screen('', [done], { terminal: true })] },
  SCREEN_TITLE_REQUIRED: { version: '6.0', screens: [screen('A', [done], { terminal: true, title: '' })] },
  SCREEN_LAYOUT_REQUIRED: { version: '6.0', screens: [{ id: 'A', title: 'A', terminal: true }] },
  SCREEN_COMPONENTS_REQUIRED: { version: '6.0', screens: [screen('A', [], { terminal: true })] },
  TERMINAL_SCREEN_REQUIRED: { version: '6.0', screens: [screen('A', [done])] },
  COMPONENT_NOT_OBJECT: { version: '6.0', screens: [screen('A', ['x'], { terminal: true })] },
  INPUT_NAME_DUPLICATE: {
    version: '6.0',
    screens: [
      screen('A', [{ type: 'TextInput', name: 'email' }, { type: 'TextInput', name: 'email' }, done], { terminal: true }),
    ],
  },
  DATA_SOURCE_EMPTY: {
    version: '6.0',
    screens: [screen('A', [{ type: 'Dropdown', name: 'd', 'data-source': [] }, done], { terminal: true })],
  },
  FOOTER_ACTION_REQUIRED: {
    version: '6.0',
    screens: [screen('A', [{ type: 'Footer', label: 'Go' }], { terminal: true })],
  },
  NAVIGATE_TARGET_REQUIRED: {
    version: '6.0',
    screens: [
      screen('A', [{ type: 'Footer', label: 'Go', 'on-click-action': { name: 'navigate' } }]),
      screen('B', [done], { terminal: true }),
    ],
  },
  NAVIGATE_TARGET_UNKNOWN: {
    version: '6.0',
    screens: [
      screen('A', [{ type: 'Footer', label: 'Go', 'on-click-action': { name: 'navigate', next: { type: 'screen', name: 'NOPE' } } }]),
      screen('B', [done], { terminal: true }),
    ],
  },
};

test('every code in the list is produced by some flow, and every error carries a listed code', () => {
  assert.deepEqual(Object.keys(triggers).sort(), [...FLOW_VALIDATION_ERROR_CODES].sort());
  const seen = new Set<string>();
  for (const [code, flow] of Object.entries(triggers)) {
    const errors = validateFlow(flow as WhatsAppFlow).errors;
    assert.ok(errors.some((error) => error.code === code), `${code} is not triggered`);
    for (const error of errors) {
      assert.ok((FLOW_VALIDATION_ERROR_CODES as readonly string[]).includes(error.code), `unlisted code ${error.code}`);
      seen.add(error.code);
    }
  }
  assert.deepEqual([...seen].sort(), [...FLOW_VALIDATION_ERROR_CODES].sort());
});

test('params carry the interpolated values, and messages stay English', () => {
  const dup = validateFlow(triggers.SCREEN_ID_DUPLICATE as WhatsAppFlow).errors.find((e) => e.code === 'SCREEN_ID_DUPLICATE');
  assert.deepEqual(dup, {
    path: 'screens[1].id',
    code: 'SCREEN_ID_DUPLICATE',
    message: 'Duplicate screen id: "WELCOME"',
    params: { id: 'WELCOME' },
  });
  const nav = validateFlow(triggers.NAVIGATE_TARGET_UNKNOWN as WhatsAppFlow).errors.find((e) => e.code === 'NAVIGATE_TARGET_UNKNOWN');
  assert.equal(nav?.message, 'Navigation target "NOPE" does not match any screen id');
  assert.deepEqual(nav?.params, { target: 'NOPE' });
});
