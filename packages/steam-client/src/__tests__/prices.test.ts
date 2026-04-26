import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePriceString, parseSteamPriceResponse } from '../prices';
import type { SteamPriceResponse } from '@doppler/types';

describe('parsePriceString', () => {
  it('parses standard USD price', () => {
    expect(parsePriceString('$38.50')).toBe(38.5);
  });

  it('parses price with thousands separator', () => {
    expect(parsePriceString('$1,234.56')).toBe(1234.56);
  });

  it('parses price with euro symbol', () => {
    expect(parsePriceString('€42.99')).toBe(42.99);
  });

  it('parses price with no decimals', () => {
    expect(parsePriceString('$100')).toBe(100);
  });

  it('returns null for undefined', () => {
    expect(parsePriceString(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePriceString('')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(parsePriceString('N/A')).toBeNull();
  });

  it('parses small price correctly', () => {
    expect(parsePriceString('$0.03')).toBe(0.03);
  });
});

describe('parseSteamPriceResponse', () => {
  it('parses complete response', () => {
    const raw: SteamPriceResponse = {
      success: true,
      lowest_price: '$38.50',
      median_price: '$40.00',
      volume: '142',
    };
    const parsed = parseSteamPriceResponse(raw);
    expect(parsed.lowestPrice).toBe(38.5);
    expect(parsed.medianPrice).toBe(40);
    expect(parsed.volume).toBe(142);
  });

  it('handles missing optional fields', () => {
    const raw: SteamPriceResponse = { success: true };
    const parsed = parseSteamPriceResponse(raw);
    expect(parsed.lowestPrice).toBeNull();
    expect(parsed.medianPrice).toBeNull();
    expect(parsed.volume).toBeNull();
  });

  it('handles volume with commas', () => {
    const raw: SteamPriceResponse = {
      success: true,
      volume: '1,234',
    };
    expect(parseSteamPriceResponse(raw).volume).toBe(1234);
  });
});
