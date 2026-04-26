import { describe, it, expect, vi } from 'vitest';
import { isExpiringWithin } from '../auctions';

describe('isExpiringWithin', () => {
  it('returns true when auction expires within the window', () => {
    const now = new Date();
    const in15Min = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    expect(isExpiringWithin(in15Min, 30)).toBe(true);
  });

  it('returns false when auction expires after the window', () => {
    const now = new Date();
    const in60Min = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    expect(isExpiringWithin(in60Min, 30)).toBe(false);
  });

  it('returns false when auction already expired', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(isExpiringWithin(past, 30)).toBe(false);
  });

  it('handles edge case at exact boundary', () => {
    const now = new Date();
    const exactly30Min = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    expect(isExpiringWithin(exactly30Min, 30)).toBe(true);
  });

  it('handles ISO datetime with timezone offset', () => {
    const now = new Date();
    const in10Min = new Date(now.getTime() + 10 * 60 * 1000);
    const withOffset = in10Min.toISOString().replace('Z', '+00:00');
    expect(isExpiringWithin(withOffset, 30)).toBe(true);
  });
});
