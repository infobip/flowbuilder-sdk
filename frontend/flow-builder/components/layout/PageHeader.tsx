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

import React from 'react';

export type PageHeaderProps = {
  title: string;
  /** Small uppercase label above the title (orange accent). */
  eyebrow?: string;
  subtitle?: React.ReactNode;
  /** Right-aligned action controls. */
  actions?: React.ReactNode;
};

// Sticky-feeling page header used at the top of every route body.
export function PageHeader({ title, eyebrow, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-default bg-surface px-8 py-5.5 narrow:flex-col narrow:items-stretch">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-11 font-semibold uppercase tracking-[0.9px] text-accent">{eyebrow}</p>}
        {/* Plex runs wide; large sizes need the tracking pulled back in. */}
        <h1 className="text-24 font-semibold tracking-[-0.3px] text-default">{title}</h1>
        {subtitle && <p className="mt-1 text-13 text-muted">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2.5 narrow:w-full narrow:justify-start">{actions}</div>
      )}
    </header>
  );
}
