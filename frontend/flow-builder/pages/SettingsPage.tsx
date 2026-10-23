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

import React, { useRef, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/badge/Badge';
import { Button } from '../components/button/Button';
import { Card, CardBody } from '../components/card/Card';
import { ConfirmDialog } from '../components/dialog/ConfirmDialog';
import { FIELD_ERROR_CLASS, FIELD_HINT_CLASS } from '../components/input/Field';
import { Input } from '../components/input/Input';
import { PageBody } from '../components/layout/PageBody';
import { Skeleton } from '../components/loading/Skeleton';
import { SegmentedControl, type SegmentedOption } from '../components/tabs/SegmentedControl';
import { BRAND_LABEL_KEYS } from '../components/theme/brand';
import { useTheme } from '../components/theme/ThemeProvider';
import { useFeatures } from '../app/hostConfig';
import { useT } from '../i18n/I18nProvider';
import { maskApiKey, normalizeApiKey } from '../services/apiKey';
import { describeSettingsSections } from './settingsSections';
import { useApiKeySetting } from '../state/useApiKeySetting';
import { useChatHistoryBackup } from '../state/useChatHistoryBackup';
import { BRANDS, type BrandName, type ThemeName } from '../styles/tokens';

/** Both settings hooks report their outcome in this shape. */
type SettingsResult = { tone: 'info' | 'error'; text: string };

/** A row of buttons beside (or, when narrow, under) a setting. */
const ACTIONS_CLASS = 'flex shrink-0 items-center gap-2.5 narrow:flex-wrap';
/** Mono, like every other machine-written value in the app (flow ids, JSON). */
const KEY_VALUE_CLASS = 'font-mono text-12.5 tracking-[0.04em] text-default';

// A titled block with its explanation outside the card, so the card holds only
// the controls and every section reads the same way down the page.
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-15 font-semibold text-default">{title}</h2>
        <p className="max-w-[68ch] text-13 text-muted">{description}</p>
      </div>
      <Card>
        <CardBody className="flex flex-col gap-4">{children}</CardBody>
      </Card>
    </section>
  );
}

// One labelled setting with its controls on the right. Stacks on a narrow window.
function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 narrow:flex-col narrow:items-stretch narrow:gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-13 font-semibold text-default">{title}</span>
        <span className="text-12 text-subtle">{description}</span>
      </div>
      <div className={ACTIONS_CLASS}>{children}</div>
    </div>
  );
}

// The live region stays mounted and displayed even while empty, so a result
// that arrives later is announced — a region hidden with display:none is not
// reliably picked up. While empty, the negative margin cancels the card's row
// gap so it costs no space.
function SettingsStatus({ result }: { result: SettingsResult | null }) {
  return (
    <div className="empty:-mt-4" role="status" aria-live="polite">
      {result && <p className={result.tone === 'error' ? FIELD_ERROR_CLASS : FIELD_HINT_CLASS}>{result.text}</p>}
    </div>
  );
}

function AppearanceSection({ themeSwitch, brandPicker }: { themeSwitch: boolean; brandPicker: boolean }) {
  const { theme, setTheme, brand, setBrand } = useTheme();
  const t = useT();
  const themeOptions: ReadonlyArray<SegmentedOption<ThemeName>> = [
    { value: 'light', label: t('settings.appearance.theme.light') },
    { value: 'dark', label: t('settings.appearance.theme.dark') },
  ];
  const brandOptions: ReadonlyArray<SegmentedOption<BrandName>> = BRANDS.map((name) => ({ value: name, label: t(BRAND_LABEL_KEYS[name]) }));

  return (
    <SettingsSection
      title={t('settings.appearance.title')}
      description={t('settings.appearance.description')}
    >
      {themeSwitch ? (
        <SettingsRow title={t('settings.appearance.theme.title')} description={t('settings.appearance.theme.description')}>
          <SegmentedControl<ThemeName>
            ariaLabel={t('settings.appearance.theme.title')}
            semantics="choice"
            options={themeOptions}
            value={theme}
            onChange={setTheme}
          />
        </SettingsRow>
      ) : null}
      {brandPicker ? (
        <SettingsRow title={t('settings.appearance.brand.title')} description={t('settings.appearance.brand.description')}>
          <SegmentedControl<BrandName>
            ariaLabel={t('settings.appearance.brand.title')}
            semantics="choice"
            options={brandOptions}
            value={brand}
            onChange={setBrand}
          />
        </SettingsRow>
      ) : null}
    </SettingsSection>
  );
}

function ChatHistorySection() {
  const t = useT();
  const { hasHistory, result, exportHistory, importHistory, clearHistory } = useChatHistoryBackup();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file twice still fires a change event.
    event.target.value = '';
    if (file) importHistory(file);
  };

  return (
    <SettingsSection
      title={t('settings.chatHistory.title')}
      description={t('settings.chatHistory.description')}
    >
      <SettingsRow
        title={t('settings.chatHistory.backup.title')}
        description={
          hasHistory ? t('settings.chatHistory.backup.importHint') : t('settings.chatHistory.backup.emptyHint')
        }
      >
        <Button variant="secondary" onClick={exportHistory} disabled={!hasHistory}>
          {t('settings.chatHistory.backup.export')}
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          {t('settings.chatHistory.backup.import')}
        </Button>
      </SettingsRow>

      <SettingsRow
        title={t('settings.chatHistory.stored.title')}
        description={t('settings.chatHistory.stored.description')}
      >
        <Button variant="danger" onClick={() => setConfirmingClear(true)} disabled={!hasHistory}>
          {t('settings.chatHistory.stored.clear')}
        </Button>
      </SettingsRow>

      <SettingsStatus result={result} />

      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFile} />

      <ConfirmDialog
        open={confirmingClear}
        title={t('settings.chatHistory.confirmClear.title')}
        tone="danger"
        confirmLabel={t('settings.chatHistory.confirmClear.confirm')}
        message={t('settings.chatHistory.confirmClear.message')}
        onConfirm={() => {
          clearHistory();
          setConfirmingClear(false);
        }}
        onCancel={() => setConfirmingClear(false)}
      />
    </SettingsSection>
  );
}

function ApiKeySection() {
  const t = useT();
  const { status, loading, pending, result, save, reset } = useApiKeySetting();
  const [draft, setDraft] = useState('');
  const busy = pending !== null;
  // Normalized, so a paste of the bare `App ` scheme reads as an empty field
  // rather than something worth sending.
  const candidate = normalizeApiKey(draft);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !candidate) return;
    if (await save(candidate)) setDraft('');
  };

  return (
    <SettingsSection
      title={t('settings.apiKey.title')}
      description={t('settings.apiKey.description')}
    >
      <div className="flex items-center gap-2.5 text-13 text-muted narrow:flex-wrap">
        <span>{t('settings.apiKey.inUse')}</span>
        {loading ? (
          <Skeleton width={120} height={14} />
        ) : status ? (
          <>
            <span className={KEY_VALUE_CLASS}>{maskApiKey(status.hint)}</span>
            <Badge tone={status.source === 'override' ? 'accent' : 'neutral'}>
              {status.source === 'override' ? t('settings.apiKey.sourceOverride') : t('settings.apiKey.sourceServer')}
            </Badge>
          </>
        ) : (
          <span className={KEY_VALUE_CLASS}>{t('settings.apiKey.unavailable')}</span>
        )}
      </div>

      <form className="flex flex-col gap-3.5" autoComplete="off" onSubmit={handleSubmit}>
        <Input
          name="infobip-api-key"
          type="password"
          label={t('settings.apiKey.fieldLabel')}
          // Browsers ignore `off` on password fields and would offer to save
          // the key — the one place this design refuses to put it.
          autoComplete="new-password"
          spellCheck={false}
          placeholder={t('settings.apiKey.placeholder')}
          hint={t('settings.apiKey.hint')}
          fieldClassName="max-w-105 narrow:max-w-none"
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className={ACTIONS_CLASS}>
          <Button type="submit" variant="primary" disabled={busy || !candidate}>
            {pending === 'save' ? t('settings.apiKey.saving') : t('settings.apiKey.save')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void reset()}
            disabled={busy || status?.source !== 'override'}
          >
            {pending === 'reset' ? t('settings.apiKey.resetting') : t('settings.apiKey.reset')}
          </Button>
        </div>
      </form>

      <SettingsStatus result={result} />
    </SettingsSection>
  );
}

export function SettingsPage() {
  const features = useFeatures();
  const t = useT();
  const { appearance, subtitle } = describeSettingsSections(t, features);

  return (
    <PageBody>
      <PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} subtitle={subtitle || undefined} />
      {/* A single reading column rather than the full content width: these are
          short rows of prose and controls, and a 1600px-wide label/control
          pair is unusable. */}
      <div className="flex w-full max-w-190 flex-col gap-6">
        {appearance ? <AppearanceSection themeSwitch={features.themeSwitch} brandPicker={features.brandPicker} /> : null}
        {features.chatHistoryBackup ? <ChatHistorySection /> : null}
        {features.apiKeySettings ? <ApiKeySection /> : null}
      </div>
    </PageBody>
  );
}
