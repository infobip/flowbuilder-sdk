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

// ── WhatsApp Flow Preview · phone frame ─────────────────────────────────────
//
// Presentational device chrome: a rounded phone body with an iOS-style status
// bar ("9:41" + signal / wifi / battery) sitting above the Flow surface passed
// as `children`. Purely visual — it holds no flow logic. The `wafp-phone*`
// classes live in the shared preview stylesheet (`styles.ts`).

import React from 'react';

function SignalIcon() {
  return (
    <svg width="13" height="8" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true">
      <rect x="0" y="7.5" width="3" height="3.5" rx="0.6" />
      <rect x="4.5" y="5" width="3" height="6" rx="0.6" />
      <rect x="9" y="2.5" width="3" height="8.5" rx="0.6" />
      <rect x="13.5" y="0" width="3" height="11" rx="0.6" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="12" height="8" viewBox="0 0 16 11" fill="none" aria-hidden="true">
      <path d="M8 9.5l.01 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4.4 6.2a5 5 0 017.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M1.8 3.5a8.6 8.6 0 0112.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="19" height="9" viewBox="0 0 25 12" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.4" />
      <rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor" />
      <rect x="23" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export type PhoneFrameProps = {
  children: React.ReactNode;
  /** Visible content width (px). The frame sizes itself to this. */
  width?: number;
  /** Status bar clock. */
  time?: string;
  className?: string;
};

export function PhoneFrame({ children, width, time = '9:41', className }: PhoneFrameProps) {
  return (
    <div
      className={['wafp-root', 'wafp-phone', className].filter(Boolean).join(' ')}
      style={width ? { width } : undefined}
    >
      <div className="wafp-phone-statusbar">
        <span className="wafp-phone-time">{time}</span>
        <span className="wafp-phone-status-icons">
          <SignalIcon />
          <WifiIcon />
          <BatteryIcon />
        </span>
      </div>
      <div className="wafp-phone-body">{children}</div>
    </div>
  );
}
