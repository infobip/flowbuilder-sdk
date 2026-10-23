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
import { cx } from '../../utils/cx';
import { Card, CardBody } from '../card/Card';

export type SkeletonRounded = 'sm' | 'md' | 'lg' | 'xl';

const ROUNDED_CLASSES: Record<SkeletonRounded, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

export type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  /** Corner radius from the theme (`--radius-*`). Defaults to `sm`. */
  rounded?: SkeletonRounded;
  /** A raw CSS radius; overrides `rounded`. */
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * The shimmering placeholder fill, without a corner radius so placeholders
 * built from plain elements can set their own. Still under reduced motion.
 */
export const SKELETON_CLASS =
  'block animate-shimmer bg-[linear-gradient(90deg,var(--fb-color-surface-sunken)_25%,var(--fb-border-color-default)_37%,var(--fb-color-surface-sunken)_63%)] bg-size-[400%_100%] motion-reduce:animate-none';

// Shimmering placeholder block.
export function Skeleton({ width = '100%', height = 16, rounded = 'sm', radius, className, style }: SkeletonProps) {
  return (
    <span
      className={cx(SKELETON_CLASS, ROUNDED_CLASSES[rounded], className)}
      aria-hidden="true"
      style={{ width, height, ...(radius != null ? { borderRadius: radius } : null), ...style }}
    />
  );
}

// Convenience: a card-shaped skeleton used by the library grid while loading.
export function SkeletonCard() {
  return (
    <Card aria-hidden="true">
      <CardBody className="flex flex-col gap-3">
        <Skeleton width="60%" height={18} />
        <Skeleton width="90%" height={12} />
        <Skeleton width="40%" height={12} />
        <div className="mt-1.5 flex gap-2">
          <Skeleton width={64} height={22} />
          <Skeleton width={80} height={22} />
        </div>
      </CardBody>
    </Card>
  );
}
