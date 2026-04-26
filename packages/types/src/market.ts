import { z } from 'zod';

// ── Steam Price Response ────────────────────────
export const SteamPriceResponseSchema = z.object({
  success: z.boolean(),
  lowest_price: z.string().optional(),
  median_price: z.string().optional(),
  volume: z.string().optional(),
});

export type SteamPriceResponse = z.infer<typeof SteamPriceResponseSchema>;

// ── Steam Inventory Item ────────────────────────
export const SteamInventoryItemSchema = z.object({
  assetId: z.string(),
  classId: z.string(),
  instanceId: z.string(),
  marketHashName: z.string(),
  iconUrl: z.string(),
  tradable: z.boolean(),
  marketable: z.boolean(),
  tags: z.array(
    z.object({
      category: z.string(),
      internalName: z.string(),
      localizedCategoryName: z.string(),
      localizedTagName: z.string(),
    }),
  ),
});

export type SteamInventoryItem = z.infer<typeof SteamInventoryItemSchema>;

// ── CSFloat Listing ─────────────────────────────
export const CSFloatListingSchema = z.object({
  id: z.string(),
  marketHashName: z.string(),
  price: z.number(),
  floatValue: z.number().nullable(),
  paintSeed: z.number().nullable(),
  paintIndex: z.number().nullable(),
  screenshotUrl: z.string().nullable(),
  createdAt: z.string(),
  sellerSteamId: z.string(),
  isAuction: z.boolean(),
  auctionEndsAt: z.string().nullable(),
});

export type CSFloatListing = z.infer<typeof CSFloatListingSchema>;

// ── Deal Data (stored in Deal.dealData Json) ────
export const DealDataSchema = z.object({
  listing: CSFloatListingSchema,
  steamPrice: z.number(),
  effectiveDiscount: z.number(),
  feeAdjustedCost: z.number(),
  dealScore: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type DealData = z.infer<typeof DealDataSchema>;
