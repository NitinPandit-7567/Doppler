import { Router } from 'express';
import { prisma } from '@doppler/db';
import {
  GetInventoryContract,
  GetInventoryValueContract,
  SyncInventoryContract,
} from '@doppler/types';
import { getInventory, getPriceOverview, parseSteamPriceResponse, invalidate } from '@doppler/steam-client';
import { createRoute } from '../lib/createRoute';

const router = Router();

router.get(
  '/',
  createRoute(GetInventoryContract, async ({ query, user }, res) => {
    const items = await getInventory(user.steamId, query.includeNonTradable);
    res.json({ success: true, data: [...items] });
  }),
);

router.get(
  '/value',
  createRoute(GetInventoryValueContract, async ({ user }, res) => {
    const items = await getInventory(user.steamId);

    let totalValueUsd = 0;
    for (const item of items) {
      try {
        const priceRaw = await getPriceOverview(item.marketHashName);
        const parsed = parseSteamPriceResponse(priceRaw);
        if (parsed.lowestPrice !== null) {
          totalValueUsd += parsed.lowestPrice;
        }
      } catch {
        // Skip items where price lookup fails — don't block the whole response
      }
    }

    res.json({
      success: true,
      data: {
        totalValueUsd,
        itemCount: items.length,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  }),
);

router.post(
  '/sync',
  createRoute(SyncInventoryContract, async ({ user }, res) => {
    const cacheKey = `steam:inventory:${user.steamId}:tradable`;
    await invalidate(cacheKey);

    const items = await getInventory(user.steamId);

    let totalValueUsd = 0;
    for (const item of items) {
      try {
        const priceRaw = await getPriceOverview(item.marketHashName);
        const parsed = parseSteamPriceResponse(priceRaw);
        if (parsed.lowestPrice !== null) {
          totalValueUsd += parsed.lowestPrice;
        }
      } catch {
        // Skip failed price lookups
      }
    }

    await prisma.inventorySnapshot.create({
      data: {
        userId: user.id,
        items: JSON.parse(JSON.stringify(items)),
        totalValue: totalValueUsd,
      },
    });

    res.json({
      success: true,
      data: { itemCount: items.length, totalValueUsd },
    });
  }),
);

export { router as inventoryRouter };
