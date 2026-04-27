import { Router } from 'express';
import { GetPriceContract, GetListingsContract } from '@doppler/types';
import { getPriceOverview, parseSteamPriceResponse } from '@doppler/steam-client';
import { searchListings } from '@doppler/csfloat-client';
import { createRoute } from '../lib/createRoute';

const router = Router();

router.get(
  '/price/:item',
  createRoute(GetPriceContract, async ({ params }, res) => {
    let steam = null;
    try {
      steam = await getPriceOverview(params.item);
    } catch {
      // Steam API may fail — return null instead of erroring the whole request
    }

    let csfloat = null;
    try {
      const listings = await searchListings({ itemName: params.item, limit: 1 });
      const first = listings[0];
      csfloat = {
        lowestPrice: first?.price ?? null,
        listingCount: listings.length,
      };
    } catch {
      // CSFloat API may fail — return null
    }

    res.json({ success: true, data: { steam, csfloat } });
  }),
);

router.get(
  '/listings',
  createRoute(GetListingsContract, async ({ query }, res) => {
    const params: import('@doppler/csfloat-client').ListingSearchParams = {
      itemName: query.item,
      sortBy: query.sortBy,
      limit: query.limit,
      ...(query.maxPrice !== undefined && { maxPrice: query.maxPrice }),
      ...(query.maxFloat !== undefined && { maxFloat: query.maxFloat }),
    };
    const listings = await searchListings(params);

    res.json({ success: true, data: [...listings] });
  }),
);

export { router as marketRouter };
