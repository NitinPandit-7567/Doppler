import axios from 'axios';
import { z } from 'zod';
import { CSFloatListingSchema } from '@doppler/types';
import type { CSFloatListing } from '@doppler/types';

const CSFLOAT_BASE = 'https://csfloat.com/api/v1';

export interface ListingSearchParams {
  readonly itemName: string;
  readonly maxPrice?: number;
  readonly minFloat?: number;
  readonly maxFloat?: number;
  readonly sortBy?: 'price_asc' | 'price_desc' | 'float_asc' | 'float_desc' | 'listed_at';
  readonly limit?: number;
}

const RawCSFloatListingSchema = z.object({
  id: z.string(),
  market_hash_name: z.string(),
  price: z.number(),
  float_value: z.number().nullable().optional(),
  paint_seed: z.number().nullable().optional(),
  paint_index: z.number().nullable().optional(),
  screenshot_url: z.string().nullable().optional(),
  created_at: z.string(),
  seller_steam_id: z.string().optional(),
  is_auction: z.boolean().optional(),
  auction_ends_at: z.string().nullable().optional(),
});

const RawListingsResponseSchema = z.object({
  data: z.array(RawCSFloatListingSchema),
});

export function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

export function validateFloat(value: number): boolean {
  return value >= 0 && value <= 1;
}

function mapToListing(raw: z.infer<typeof RawCSFloatListingSchema>): CSFloatListing {
  return CSFloatListingSchema.parse({
    id: raw.id,
    marketHashName: raw.market_hash_name,
    price: centsToUsd(raw.price),
    floatValue: raw.float_value ?? null,
    paintSeed: raw.paint_seed ?? null,
    paintIndex: raw.paint_index ?? null,
    screenshotUrl: raw.screenshot_url ?? null,
    createdAt: raw.created_at,
    sellerSteamId: raw.seller_steam_id ?? '',
    isAuction: raw.is_auction ?? false,
    auctionEndsAt: raw.auction_ends_at ?? null,
  });
}

export async function searchListings(
  params: ListingSearchParams,
): Promise<readonly CSFloatListing[]> {
  const response = await axios.get(`${CSFLOAT_BASE}/listings`, {
    params: {
      market_hash_name: params.itemName,
      max_price: params.maxPrice !== undefined ? Math.round(params.maxPrice * 100) : undefined,
      min_float: params.minFloat,
      max_float: params.maxFloat,
      sort_by: params.sortBy ?? 'price_asc',
      limit: params.limit ?? 20,
      type: 'buy_now',
    },
    headers: {
      Authorization: process.env.CSFLOAT_API_KEY ?? '',
    },
    timeout: 10_000,
  });

  const raw = RawListingsResponseSchema.parse(response.data);
  return raw.data.map(mapToListing);
}
