import axios, { type AxiosError } from 'axios';
import { SteamPriceResponseSchema } from '@doppler/types';
import type { SteamPriceResponse } from '@doppler/types';
import { getOrFetch } from './cache';

const STEAM_MARKET_URL = 'https://steamcommunity.com/market/priceoverview/';
const CACHE_TTL_SECONDS = 15 * 60;
const STEAM_APP_ID = 730;

const INITIAL_BACKOFF_MS = 2000;
const MAX_RETRIES = 3;

export function parsePriceString(price: string | undefined): number | null {
  if (price === undefined || price === '') return null;
  const cleaned = price.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

async function fetchFromSteam(itemName: string): Promise<SteamPriceResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(STEAM_MARKET_URL, {
        params: {
          appid: STEAM_APP_ID,
          currency: 1,
          market_hash_name: itemName,
        },
        headers: {
          'User-Agent': 'Doppler/1.0',
        },
        timeout: 10_000,
      });

      return SteamPriceResponseSchema.parse(response.data);
    } catch (error) {
      const axiosErr = error as AxiosError;
      if (axiosErr.response?.status === 429) {
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        lastError = new Error(`Steam API rate limited (attempt ${attempt + 1}/${MAX_RETRIES})`);
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Steam API request failed after retries');
}

export async function getPriceOverview(itemName: string): Promise<SteamPriceResponse> {
  const cacheKey = `steam:price:${itemName}`;
  return getOrFetch(cacheKey, CACHE_TTL_SECONDS, () => fetchFromSteam(itemName));
}

export interface ParsedSteamPrice {
  readonly lowestPrice: number | null;
  readonly medianPrice: number | null;
  readonly volume: number | null;
}

export function parseSteamPriceResponse(raw: SteamPriceResponse): ParsedSteamPrice {
  return {
    lowestPrice: parsePriceString(raw.lowest_price),
    medianPrice: parsePriceString(raw.median_price),
    volume: raw.volume !== undefined ? parseInt(raw.volume.replace(/,/g, ''), 10) : null,
  };
}
