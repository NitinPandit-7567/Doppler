import axios from 'axios';
import { z } from 'zod';
import { CSFloatListingSchema } from '@doppler/types';
import type { CSFloatListing } from '@doppler/types';
import { centsToUsd } from './listings';

const CSFLOAT_BASE = 'https://csfloat.com/api/v1';

export interface AuctionSearchParams {
  readonly expiresWithinMinutes?: number;
  readonly maxPrice?: number;
  readonly limit?: number;
}

const RawAuctionSchema = z.object({
  id: z.string(),
  market_hash_name: z.string(),
  price: z.number(),
  float_value: z.number().nullable().optional(),
  paint_seed: z.number().nullable().optional(),
  paint_index: z.number().nullable().optional(),
  screenshot_url: z.string().nullable().optional(),
  created_at: z.string(),
  seller_steam_id: z.string().optional(),
  is_auction: z.literal(true),
  auction_ends_at: z.string(),
});

const RawAuctionsResponseSchema = z.object({
  data: z.array(RawAuctionSchema),
});

export function isExpiringWithin(auctionEndsAt: string, minutes: number): boolean {
  const endsAt = new Date(auctionEndsAt);
  const now = new Date();
  const diffMs = endsAt.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= minutes * 60 * 1000;
}

export async function getExpiringAuctions(
  params: AuctionSearchParams = {},
): Promise<readonly CSFloatListing[]> {
  const response = await axios.get(`${CSFLOAT_BASE}/listings`, {
    params: {
      type: 'auction',
      max_price: params.maxPrice !== undefined ? Math.round(params.maxPrice * 100) : undefined,
      limit: params.limit ?? 30,
      sort_by: 'expires_at',
    },
    headers: {
      Authorization: process.env.CSFLOAT_API_KEY ?? '',
    },
    timeout: 10_000,
  });

  const raw = RawAuctionsResponseSchema.parse(response.data);
  const withinMinutes = params.expiresWithinMinutes ?? 30;

  return raw.data
    .filter((a) => isExpiringWithin(a.auction_ends_at, withinMinutes))
    .map((a) =>
      CSFloatListingSchema.parse({
        id: a.id,
        marketHashName: a.market_hash_name,
        price: centsToUsd(a.price),
        floatValue: a.float_value ?? null,
        paintSeed: a.paint_seed ?? null,
        paintIndex: a.paint_index ?? null,
        screenshotUrl: a.screenshot_url ?? null,
        createdAt: a.created_at,
        sellerSteamId: a.seller_steam_id ?? '',
        isAuction: true,
        auctionEndsAt: a.auction_ends_at,
      }),
    );
}
