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

// ── Flow Builder editor chat panel ─────────────────────────────────────────
//
// The prompt-side of the editor. On a blank new flow it shows the hero, the
// composer, and the template cards. Once there's a transcript (or a loaded
// flow) it becomes a scrolling message list above a pinned composer. All state
// lives in the editor hook; this component is presentational.

import React, { useEffect, useRef } from 'react';
import { Button } from '../../components/button/Button';
import { InteractiveCard } from '../../components/card/Card';
import type { EditorChatMessage, EditorChatRole } from '../../utils/chatMessages';
import { useT } from '../../i18n/I18nProvider';
import { cx } from '../../utils/cx';
import type { EditorStarterChoice } from '../../utils/editor';

export type ChatPanelProps = {
  messages: EditorChatMessage[];
  hasFlow: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  templates: ReadonlyArray<EditorStarterChoice>;
  onPickTemplate: (prompt: string) => void;
};

// The user's turns sit right in the primary colour; everything else sits left.
const BUBBLE_LEFT = 'self-start rounded-bl border';
const BUBBLE_ROLE_CLASSES: Record<EditorChatRole, string> = {
  user: 'self-end rounded-br bg-primary text-on-primary',
  assistant: cx(BUBBLE_LEFT, 'border-default bg-surface-sunken text-default'),
  pending: cx(BUBBLE_LEFT, 'border-default bg-surface-sunken text-default'),
  error: cx(BUBBLE_LEFT, 'border-danger bg-danger-soft text-danger'),
};

const TYPING_DOT_CLASS = 'size-1.5 animate-typing rounded-full bg-current opacity-50 motion-reduce:animate-none';

function ChatBubble({ message }: { message: EditorChatMessage }) {
  const t = useT();
  return (
    <div
      className={cx(
        'inline-flex max-w-[82%] flex-col gap-1 rounded-bubble px-3.5 py-2.5 text-14 leading-normal',
        BUBBLE_ROLE_CLASSES[message.role],
      )}
    >
      {message.role === 'pending' ? (
        <span className="inline-flex h-[18px] items-center gap-[5px]" aria-label={t('editor.chat.typing')}>
          <span className={TYPING_DOT_CLASS} />
          <span className={cx(TYPING_DOT_CLASS, '[animation-delay:0.15s]')} />
          <span className={cx(TYPING_DOT_CLASS, '[animation-delay:0.3s]')} />
        </span>
      ) : (
        <span className="whitespace-pre-wrap wrap-anywhere">{message.text}</span>
      )}
      <span className="text-11 opacity-70">{message.time}</span>
    </div>
  );
}

function Composer({
  prompt,
  onPromptChange,
  onSubmit,
  busy,
  hasFlow,
}: Pick<ChatPanelProps, 'prompt' | 'onPromptChange' | 'onSubmit' | 'busy' | 'hasFlow'>) {
  const t = useT();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const canSubmit = !busy && prompt.trim().length > 0;

  // Auto-size the textarea up to a cap so multi-line prompts stay readable.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [prompt]);

  const submit = () => {
    if (canSubmit) onSubmit();
  };

  return (
    <form
      className="flex flex-col gap-2.5 rounded border border-strong bg-surface p-3 shadow-(--fb-shadow-card) transition-[border-color,box-shadow] focus-within:border-focus-ring focus-within:ring-2 focus-within:ring-focus-ring"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={inputRef}
        className="max-h-40 min-h-6 w-full resize-none bg-transparent p-0.5 leading-normal text-default placeholder:text-subtle focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        placeholder={hasFlow ? t('editor.chat.placeholderChange') : t('editor.chat.placeholderNew')}
        rows={1}
        value={prompt}
        disabled={busy}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        <Button type="submit" variant="primary" disabled={!canSubmit} startSlot={<span aria-hidden="true">→</span>}>
          {busy ? t('editor.chat.generating') : t('editor.chat.generate')}
        </Button>
      </div>
    </form>
  );
}

export function ChatPanel({
  messages,
  hasFlow,
  prompt,
  onPromptChange,
  onSubmit,
  busy,
  templates,
  onPickTemplate,
}: ChatPanelProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement | null>(null);
  const showTemplates = messages.length === 0 && !hasFlow;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const composer = (
    <Composer
      prompt={prompt}
      onPromptChange={onPromptChange}
      onSubmit={onSubmit}
      busy={busy}
      hasFlow={hasFlow}
    />
  );

  if (showTemplates) {
    return (
      <div className="flex min-h-0 flex-col gap-5">
        <div>
          <h2 className="text-24 font-semibold tracking-[-0.3px] text-default">{t('editor.chat.heroTitle')}</h2>
          <p className="mt-2 max-w-130 text-14 text-muted">
            {t('editor.chat.heroText')}
          </p>
        </div>
        {composer}
        <div className="grid grid-cols-2 gap-3 narrow:grid-cols-[1fr]">
          {templates.map((choice) => (
            <InteractiveCard
              key={choice.label}
              className="gap-1.5 px-4 py-3.5"
              onClick={() => onPickTemplate(choice.prompt)}
            >
              <span className="text-14 font-semibold text-default">{choice.label}</span>
              <span className="text-12 leading-[1.4] text-muted">{choice.prompt}</span>
            </InteractiveCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex max-h-[calc(var(--fb-vh,100vh)*0.52)] flex-col gap-3 overflow-y-auto p-1" ref={listRef}>
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
      </div>
      {composer}
    </div>
  );
}
