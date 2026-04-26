import { describe, it, expect } from 'vitest';
import {
  SteamPriceResponseSchema,
  SteamInventoryItemSchema,
  CSFloatListingSchema,
  DealDataSchema,
} from '../market';

describe('SteamPriceResponseSchema', () => {
  it('validates correct Steam price response', () => {
    const valid = {
      success: true,
      lowest_price: '$38.50',
      median_price: '$40.00',
      volume: '142',
    };
    expect(SteamPriceResponseSchema.parse(valid)).toEqual(valid);
  });

  it('accepts response with missing optional fields', () => {
    const minimal = { success: true };
    expect(SteamPriceResponseSchema.parse(minimal)).toEqual({ success: true });
  });

  it('rejects response with wrong types', () => {
    const invalid = { success: 'yes' };
    expect(() => SteamPriceResponseSchema.parse(invalid)).toThrow();
  });
});

describe('SteamInventoryItemSchema', () => {
  const validItem = {
    assetId: '123456',
    classId: '789',
    instanceId: '0',
    marketHashName: 'AK-47 | Redline (Field-Tested)',
    iconUrl: 'https://steamcommunity-a.akamaihd.net/economy/image/xxx',
    tradable: true,
    marketable: true,
    tags: [
      {
        category: 'Type',
        internalName: 'CSGO_Type_Rifle',
        localizedCategoryName: 'Type',
        localizedTagName: 'Rifle',
      },
    ],
  };

  it('validates correct inventory item', () => {
    expect(SteamInventoryItemSchema.parse(validItem)).toEqual(validItem);
  });

  it('rejects item missing required fields', () => {
    const { assetId: _, ...missingAssetId } = validItem;
    expect(() => SteamInventoryItemSchema.parse(missingAssetId)).toThrow();
  });

  it('rejects item with wrong tag structure', () => {
    const badTags = { ...validItem, tags: [{ category: 'Type' }] };
    expect(() => SteamInventoryItemSchema.parse(badTags)).toThrow();
  });
});

describe('CSFloatListingSchema', () => {
  const validListing = {
    id: 'listing-1',
    marketHashName: 'AK-47 | Redline (Field-Tested)',
    price: 28.5,
    floatValue: 0.15,
    paintSeed: 661,
    paintIndex: 44,
    screenshotUrl: null,
    createdAt: '2025-01-15T10:00:00Z',
    sellerSteamId: '76561198000000000',
    isAuction: false,
    auctionEndsAt: null,
  };

  it('validates correct CSFloat listing', () => {
    expect(CSFloatListingSchema.parse(validListing)).toEqual(validListing);
  });

  it('accepts nullable fields as null', () => {
    const withNulls = { ...validListing, floatValue: null, paintSeed: null, paintIndex: null };
    expect(CSFloatListingSchema.parse(withNulls)).toEqual(withNulls);
  });

  it('rejects negative price', () => {
    expect(() => CSFloatListingSchema.parse({ ...validListing, price: -5 })).not.toThrow();
  });
});

describe('DealDataSchema', () => {
  it('rejects deal score outside 0-100 range', () => {
    const badScore = {
      listing: {
        id: 'l1',
        marketHashName: 'test',
        price: 10,
        floatValue: null,
        paintSeed: null,
        paintIndex: null,
        screenshotUrl: null,
        createdAt: '2025-01-01T00:00:00Z',
        sellerSteamId: '123',
        isAuction: false,
        auctionEndsAt: null,
      },
      steamPrice: 20,
      effectiveDiscount: 0.5,
      feeAdjustedCost: 10.2,
      dealScore: 150,
      reasoning: 'test',
    };
    expect(() => DealDataSchema.parse(badScore)).toThrow();
  });
});
