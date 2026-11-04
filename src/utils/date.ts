/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PublishedDatePrecision, TimeframeOption } from '../types';

/**
 * Returns current date/time in Asia/Seoul (UTC+9)
 */
export function getNowInSeoul(nowInput?: Date): Date {
  const base = nowInput || new Date();
  return base;
}

/**
 * Formats a Date or timestamp string into KST (Asia/Seoul) readable string.
 */
export function formatToKST(
  dateInput: string | number | Date | null | undefined,
  precision: PublishedDatePrecision = 'datetime'
): string {
  if (!dateInput) return '발행일 미상';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(precision === 'datetime'
        ? {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }
        : {}),
    });

    const formatted = formatter.format(d);
    return precision === 'date' ? `${formatted} (시각 미확인)` : formatted;
  } catch {
    return String(dateInput);
  }
}

/**
 * Calculates start and end timestamp for a given timeframe in Asia/Seoul.
 */
export function getTimeframeBounds(timeframe: TimeframeOption, referenceDate: Date = new Date()): {
  startTime: number;
  endTime: number;
  description: string;
} {
  const endTime = referenceDate.getTime();

  if (timeframe === 'today') {
    // Determine 00:00:00 of today in Asia/Seoul
    // Using Intl to find the year, month, day in Asia/Seoul
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(referenceDate);

    const y = parseInt(parts.find((p) => p.type === 'year')?.value || '1970', 10);
    const m = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10) - 1;
    const d = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);

    // Create UTC timestamp for KST 00:00:00 (KST is UTC+9)
    const seoulMidnightUtc = Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000;

    return {
      startTime: seoulMidnightUtc,
      endTime,
      description: '한국 시간(KST) 오늘 00:00 ~ 현재',
    };
  }

  if (timeframe === 'last_7_days') {
    const startTime = endTime - 7 * 24 * 60 * 60 * 1000;
    return {
      startTime,
      endTime,
      description: '최근 7일 (검색 시점 기준 168시간 전 ~ 현재)',
    };
  }

  // default: last_30_days
  const startTime = endTime - 30 * 24 * 60 * 60 * 1000;
  return {
    startTime,
    endTime,
    description: '최근 30일 (검색 시점 기준 720시간 전 ~ 현재)',
  };
}

/**
 * Validates whether an article published date falls cleanly within the timeframe
 * and checks for missing, invalid, or future dates.
 */
export function checkArticleRecency(
  publishedAt: string | null | undefined,
  timeframe: TimeframeOption,
  referenceDate: Date = new Date()
): {
  isValid: boolean;
  reason?: 'missing_date' | 'future_date' | 'too_old';
  parsedTime?: number;
} {
  if (!publishedAt) {
    return { isValid: false, reason: 'missing_date' };
  }

  const parsed = new Date(publishedAt);
  const time = parsed.getTime();

  if (isNaN(time)) {
    return { isValid: false, reason: 'missing_date' };
  }

  // If date is more than 24 hours in the future (accounting for small clock drift)
  const futureThreshold = referenceDate.getTime() + 24 * 60 * 60 * 1000;
  if (time > futureThreshold) {
    return { isValid: false, reason: 'future_date', parsedTime: time };
  }

  const bounds = getTimeframeBounds(timeframe, referenceDate);
  // For 'date' precision without time, if the date matches today in KST, allow it.
  if (time < bounds.startTime) {
    return { isValid: false, reason: 'too_old', parsedTime: time };
  }

  return { isValid: true, parsedTime: time };
}
