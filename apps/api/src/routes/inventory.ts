import { Router } from 'express';
import { prisma } from '@doppler/db';
import {
  GetInventoryContract,
  GetInventoryValueContract,
  SyncInventoryContract,
} from '@doppler/types';
import {
  getInventory,
  getPriceOverview,
  parseSteamPriceResponse,
  invalidate,
  SteamPrivateInventoryError,
  SteamNoCS2Error,
} from '@doppler/steam-client';
import { createRoute } from '../lib/createRoute';

const PRICE_CONCURRENCY = 5;

async function getInventoryValue(
  items: readonly import('@doppler/types').SteamInventoryItem[],
): Promise<number> {
  const uniqueNames = [...new Set(items.map((i) => i.marketHashName))];
  const priceMap = new Map<string, number>();

  for (let i = 0; i < uniqueNames.length; i += PRICE_CONCURRENCY) {
    const batch = uniqueNames.slice(i, i + PRICE_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (name) => {
        const raw = await getPriceOverview(name);
        const parsed = parseSteamPriceResponse(raw);
        if (parsed.lowestPrice !== null) {
          priceMap.set(name, parsed.lowestPrice);
        }
      }),
    );
  }

  let total = 0;
  for (const item of items) {
    const price = priceMap.get(item.marketHashName);
    if (price !== undefined) {
      total += price;
    }
  }
  return total;
}

const router = Router();

function handleSteamError(error: unknown, res: import('express').Response): boolean {
  if (error instanceof SteamPrivateInventoryError) {
    const isProfile = error.code === 'profile_private';
    res.status(403).json({
      success: false,
      error: isProfile
        ? 'Your Steam profile is set to private. Please set your profile to public in Steam Privacy Settings, then try again.'
        : 'Your Steam inventory is set to private or friends-only. Please set your inventory visibility to "Public" in Steam Privacy Settings, then try again.',
      code: isProfile ? 'PROFILE_PRIVATE' : 'INVENTORY_PRIVATE',
    });
    return true;
  }
  if (error instanceof SteamNoCS2Error) {
    res.status(404).json({
      success: false,
      error: 'No CS2 inventory found. Make sure you own CS2 and have played at least once.',
      code: 'NO_CS2_INVENTORY',
    });
    return true;
  }
  return false;
}

router.get(
  '/',
  createRoute(GetInventoryContract, async ({ query, user }, res) => {
    try {
      const items = await getInventory(user.steamId, query.includeNonTradable);
      res.json({ success: true, data: [...items] });
    } catch (error) {
      if (handleSteamError(error, res)) return;
      throw error;
    }
  }),
);

router.get(
  '/value',
  createRoute(GetInventoryValueContract, async ({ user }, res) => {
    try {
      const items = await getInventory(user.steamId);
      const totalValueUsd = await getInventoryValue(items);

      res.json({
        success: true,
        data: {
          totalValueUsd,
          itemCount: items.length,
          lastSyncedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (handleSteamError(error, res)) return;
      throw error;
    }
  }),
);

router.post(
  '/sync',
  createRoute(SyncInventoryContract, async ({ user }, res) => {
    try {
      const cacheKey = `steam:inventory:${user.steamId}:tradable`;
      await invalidate(cacheKey);

      const items = await getInventory(user.steamId);
      const totalValueUsd = await getInventoryValue(items);

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
    } catch (error) {
      if (handleSteamError(error, res)) return;
      throw error;
    }
  }),
);

export { router as inventoryRouter };
