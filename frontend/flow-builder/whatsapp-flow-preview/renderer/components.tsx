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

// ── WhatsApp Flow Preview · component registry ──────────────────────────────
//
// Maps a Flow component node's `type` onto a presentational renderer built from
// the scoped `wafp-*` stylesheet. Every renderer is defensive: it reads fields
// loosely, resolves `${…}` templates via the runtime helpers, and never throws
// on missing/odd data — the goal is "render what we can, fall back gracefully".
//
// `Footer` is intentionally NOT in this registry: it is pinned to the bottom of
// the surface by `WhatsAppFlowPreview`, not rendered inline.

import React from 'react';
import type { FlowComponentNode, FlowDataSourceItem, PreviewRenderContext } from '../types';
import { resolveDataSource, resolveText, resolveTemplateValue } from '../runtime/template';
import { resolveFlag } from '../runtime/condition';
import {
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  ImagePlaceholderIcon,
} from './icons';

type Renderer = (node: FlowComponentNode, ctx: PreviewRenderContext, key: React.Key) => React.ReactNode;

// ── shared bits ─────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  if (!label) return null;
  return (
    <span className="wafp-field-label">
      {label}
      {required ? <span className="wafp-req">*</span> : null}
    </span>
  );
}

/** Read the current form value for a named component. */
function formValue(node: FlowComponentNode, ctx: PreviewRenderContext): unknown {
  const name = typeof node.name === 'string' ? node.name : undefined;
  if (!name) return undefined;
  return ctx.form[name];
}

function asImageSrc(node: FlowComponentNode, ctx: PreviewRenderContext): string | null {
  const raw = resolveTemplateValue(node.src, ctx);
  if (typeof raw !== 'string' || raw.trim() === '') {
    const base64 = typeof node.src === 'string' ? node.src : undefined;
    if (base64 && base64.length > 40 && !base64.includes(' ')) {
      // Looks like a bare base64 blob — assume PNG/JPEG.
      return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    }
    return null;
  }
  if (raw.startsWith('data:') || raw.startsWith('http')) return raw;
  if (raw.length > 40) return `data:image/png;base64,${raw}`;
  return null;
}

// ── text ─────────────────────────────────────────────────────────────────────

const renderHeading: Renderer = (node, ctx, key) => (
  <h2 key={key} className="wafp-heading wafp-block">{resolveText(node.text, ctx)}</h2>
);
const renderSubheading: Renderer = (node, ctx, key) => (
  <h3 key={key} className="wafp-subheading wafp-block">{resolveText(node.text, ctx)}</h3>
);
const renderBody: Renderer = (node, ctx, key) => (
  <p key={key} className="wafp-body wafp-block">{resolveText(node.text, ctx)}</p>
);
const renderCaption: Renderer = (node, ctx, key) => (
  <p key={key} className="wafp-caption wafp-block">{resolveText(node.text, ctx)}</p>
);

const renderRichText: Renderer = (node, ctx, key) => {
  const raw = resolveTemplateValue(node.text, ctx);
  const lines = Array.isArray(raw)
    ? raw.map((line) => (line == null ? '' : String(line)))
    : String(raw ?? '').split('\n');
  return (
    <div key={key} className="wafp-richtext wafp-block">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );
};

// ── inputs ────────────────────────────────────────────────────────────────────

function renderTextEntry(node: FlowComponentNode, ctx: PreviewRenderContext, key: React.Key, textarea: boolean) {
  const label = resolveText(node.label, ctx);
  const value = resolveText(formValue(node, ctx), ctx);
  const placeholder = resolveText(node['helper-text'] ?? node.placeholder, ctx) || 'Type your answer…';
  return (
    <div key={key} className="wafp-field wafp-block">
      <FieldLabel label={label} required={resolveFlag(node.required, ctx) && node.required != null} />
      <div className={`wafp-input${textarea ? ' wafp-input--textarea' : ''}`}>
        <span className={`wafp-input-value${value ? '' : ' wafp-input-placeholder'}`}>
          {value || placeholder}
        </span>
      </div>
    </div>
  );
}

const renderTextInput: Renderer = (node, ctx, key) => renderTextEntry(node, ctx, key, false);
const renderTextArea: Renderer = (node, ctx, key) => renderTextEntry(node, ctx, key, true);

const renderDropdown: Renderer = (node, ctx, key) => {
  const label = resolveText(node.label, ctx);
  const options = resolveDataSource(node['data-source'], ctx);
  const selectedId = formValue(node, ctx);
  const selected = options.find((option) => option.id === String(selectedId ?? ''));
  const value = selected?.title ?? '';
  return (
    <div key={key} className="wafp-field wafp-block">
      <FieldLabel label={label} required={node.required != null && resolveFlag(node.required, ctx)} />
      <div className="wafp-input">
        <span className={`wafp-input-value${value ? '' : ' wafp-input-placeholder'}`}>
          {value || 'Select'}
        </span>
        <span className="wafp-input-affix"><ChevronDownIcon size={18} /></span>
      </div>
    </div>
  );
};

const renderDatePicker: Renderer = (node, ctx, key) => {
  const label = resolveText(node.label, ctx);
  const value = resolveText(formValue(node, ctx), ctx);
  return (
    <div key={key} className="wafp-field wafp-block">
      <FieldLabel label={label} required={node.required != null && resolveFlag(node.required, ctx)} />
      <div className="wafp-input">
        <span className={`wafp-input-value${value ? '' : ' wafp-input-placeholder'}`}>
          {value || 'Select date'}
        </span>
        <span className="wafp-input-affix"><CalendarIcon size={18} /></span>
      </div>
    </div>
  );
};

// ── choice groups ──────────────────────────────────────────────────────────────

function selectedSet(node: FlowComponentNode, ctx: PreviewRenderContext): Set<string> {
  const value = formValue(node, ctx);
  if (Array.isArray(value)) return new Set(value.map((entry) => String(entry)));
  if (value == null || value === '') return new Set();
  return new Set([String(value)]);
}

function renderChoiceGroup(
  node: FlowComponentNode,
  ctx: PreviewRenderContext,
  key: React.Key,
  variant: 'radio' | 'check',
) {
  const label = resolveText(node.label, ctx);
  const options = resolveDataSource(node['data-source'], ctx);
  const selected = selectedSet(node, ctx);
  return (
    <div key={key} className="wafp-choice wafp-block">
      {label ? <div className="wafp-choice-label">{label}{node.required != null && resolveFlag(node.required, ctx) ? <span className="wafp-req">*</span> : null}</div> : null}
      {options.map((option: FlowDataSourceItem) => {
        const on = selected.has(option.id);
        return (
          <div key={option.id} className={`wafp-choice-row${option.enabled === false ? ' wafp-choice-row--disabled' : ''}`}>
            <div className="wafp-choice-text">
              {option.title}
              {option.description ? <div className="wafp-choice-desc">{option.description}</div> : null}
            </div>
            {variant === 'radio' ? (
              <span className={`wafp-radio${on ? ' wafp-radio--on' : ''}`} />
            ) : (
              <span className={`wafp-check${on ? ' wafp-check--on' : ''}`}>{on ? <CheckIcon size={15} /> : null}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const renderRadioGroup: Renderer = (node, ctx, key) => renderChoiceGroup(node, ctx, key, 'radio');
const renderCheckboxGroup: Renderer = (node, ctx, key) => renderChoiceGroup(node, ctx, key, 'check');

const renderChips: Renderer = (node, ctx, key) => {
  const options = resolveDataSource(node['data-source'], ctx);
  const selected = selectedSet(node, ctx);
  return (
    <div key={key} className="wafp-chips wafp-block">
      {options.map((option) => {
        const on = selected.has(option.id);
        return (
          <span key={option.id} className={`wafp-chip${on ? ' wafp-chip--on' : ''}${option.enabled === false ? ' wafp-chip--disabled' : ''}`}>
            {option.title}
          </span>
        );
      })}
    </div>
  );
};

const renderOptIn: Renderer = (node, ctx, key) => {
  const on = Boolean(resolveTemplateValue(formValue(node, ctx), ctx));
  const label = resolveText(node.label, ctx);
  return (
    <div key={key} className="wafp-optin wafp-block">
      <span className={`wafp-check${on ? ' wafp-check--on' : ''}`}>{on ? <CheckIcon size={15} /> : null}</span>
      <span className="wafp-optin-label">{label}</span>
    </div>
  );
};

// ── media ──────────────────────────────────────────────────────────────────────

const renderImage: Renderer = (node, ctx, key) => {
  const src = asImageSrc(node, ctx);
  const alt = resolveText(node['alt-text'], ctx);
  const aspect = typeof node['aspect-ratio'] === 'number' ? node['aspect-ratio'] : undefined;
  const style = aspect ? { aspectRatio: String(aspect) } : undefined;
  return (
    <div key={key} className={`wafp-image wafp-block${src ? '' : ' wafp-image--placeholder'}`} style={style}>
      {src ? <img src={src} alt={alt} /> : <ImagePlaceholderIcon size={34} />}
    </div>
  );
};

const renderImageCarousel: Renderer = (node, ctx, key) => {
  const images = Array.isArray(node.images) ? node.images : [];
  return (
    <div key={key} className="wafp-carousel wafp-block">
      {images.map((entry, index) => {
        const src = asImageSrc(entry as FlowComponentNode, ctx);
        return (
          <div key={index} className={`wafp-carousel-item wafp-image${src ? '' : ' wafp-image--placeholder'}`}>
            {src ? <img src={src} alt="" /> : <ImagePlaceholderIcon size={30} />}
          </div>
        );
      })}
    </div>
  );
};

function renderUpload(node: FlowComponentNode, ctx: PreviewRenderContext, key: React.Key, kind: 'photo' | 'document') {
  const label = resolveText(node.label, ctx) || (kind === 'photo' ? 'Upload photo' : 'Upload document');
  const description = resolveText(node.description, ctx);
  return (
    <div key={key} className="wafp-upload wafp-block">
      <span className="wafp-upload-icon">{kind === 'photo' ? <CameraIcon size={20} /> : <DocumentIcon size={20} />}</span>
      <div className="wafp-upload-text">
        <div className="wafp-upload-title">{label}</div>
        {description ? <div className="wafp-upload-sub">{description}</div> : null}
      </div>
    </div>
  );
}

const renderPhotoPicker: Renderer = (node, ctx, key) => renderUpload(node, ctx, key, 'photo');
const renderDocumentPicker: Renderer = (node, ctx, key) => renderUpload(node, ctx, key, 'document');

// ── links / navigation ──────────────────────────────────────────────────────────

const renderEmbeddedLink: Renderer = (node, ctx, key) => (
  <a key={key} className="wafp-link wafp-block" role="link">{resolveText(node.text, ctx)}</a>
);

const renderNavigationList: Renderer = (node, ctx, key) => {
  const items = resolveDataSource(node['list-items'] ?? node['data-source'], ctx);
  return (
    <div key={key} className="wafp-navlist wafp-block">
      {items.map((item) => (
        <div key={item.id} className="wafp-nav-row">
          <span className="wafp-nav-avatar">
            {item.image ? <img src={item.image} alt="" /> : (item.title || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="wafp-nav-text">
            <div className="wafp-nav-title">{item.title}</div>
            {item.description ? <div className="wafp-nav-sub">{item.description}</div> : null}
          </div>
          {item.metadata ? <span className="wafp-nav-meta">{item.metadata}</span> : null}
          <span className="wafp-nav-chevron"><ChevronRightIcon size={18} /></span>
        </div>
      ))}
    </div>
  );
};

// ── calendar ─────────────────────────────────────────────────────────────────────

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const renderCalendar: Renderer = (node, ctx, key) => {
  const label = resolveText(node.label, ctx) || 'Select date';
  // A neutral static month grid (1..30 starting on a Wednesday) purely for shape.
  const cells: Array<number | null> = [null, null, null];
  for (let day = 1; day <= 30; day += 1) cells.push(day);
  const selected = 14;
  return (
    <div key={key} className="wafp-calendar wafp-block">
      <div className="wafp-cal-title">{label}</div>
      <div className="wafp-cal-grid">
        {DOW.map((d, i) => <div key={`dow-${i}`} className="wafp-cal-dow">{d}</div>)}
        {cells.map((day, i) => (
          <div
            key={`day-${i}`}
            className={`wafp-cal-day${day == null ? ' wafp-cal-day--muted' : ''}${day === selected ? ' wafp-cal-day--sel' : ''}`}
          >
            {day ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── registry + dispatch ────────────────────────────────────────────────────────

const REGISTRY: Record<string, Renderer> = {
  TextHeading: renderHeading,
  TextSubheading: renderSubheading,
  TextBody: renderBody,
  TextCaption: renderCaption,
  RichText: renderRichText,
  TextInput: renderTextInput,
  TextArea: renderTextArea,
  Dropdown: renderDropdown,
  DatePicker: renderDatePicker,
  CalendarPicker: renderCalendar,
  RadioButtonsGroup: renderRadioGroup,
  CheckboxGroup: renderCheckboxGroup,
  ChipsSelector: renderChips,
  OptIn: renderOptIn,
  Image: renderImage,
  ImageCarousel: renderImageCarousel,
  PhotoPicker: renderPhotoPicker,
  DocumentPicker: renderDocumentPicker,
  EmbeddedLink: renderEmbeddedLink,
  NavigationList: renderNavigationList,
};

const renderUnknown: Renderer = (node, _ctx, key) => (
  <div key={key} className="wafp-unknown wafp-block">
    Unsupported component <code>{node.type}</code>
  </div>
);

/** Render a single body node via the registry (unknown types fall back). */
export function renderNode(node: FlowComponentNode, ctx: PreviewRenderContext, key: React.Key): React.ReactNode {
  const renderer = REGISTRY[node.type] ?? renderUnknown;
  return renderer(node, ctx, key);
}
