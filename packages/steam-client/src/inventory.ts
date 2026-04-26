import axios from 'axios';
import { z } from 'zod';
import { SteamInventoryItemSchema } from '@doppler/types';
import type { SteamInventoryItem } from '@doppler/types';
import { getOrFetch } from './cache';

const STEAM_INVENTORY_URL = 'https://steamcommunity.com/inventory';
const CACHE_TTL_SECONDS = 5 * 60;
const CS2_APP_ID = 730;
const CS2_CONTEXT_ID = 2;

const RawSteamAssetSchema = z.object({
  assetid: z.string(),
  classid: z.string(),
  instanceid: z.string(),
});

const RawSteamDescriptionSchema = z.object({
  classid: z.string(),
  instanceid: z.string(),
  market_hash_name: z.string(),
  icon_url: z.string(),
  tradable: z.number(),
  marketable: z.number(),
  tags: z.array(
    z.object({
      category: z.string(),
      internal_name: z.string(),
      localized_category_name: z.string(),
      localized_tag_name: z.string(),
    }),
  ),
});

const RawInventoryResponseSchema = z.object({
  assets: z.array(RawSteamAssetSchema).optional().default([]),
  descriptions: z.array(RawSteamDescriptionSchema).optional().default([]),
  total_inventory_count: z.number(),
  success: z.number(),
});

function mapToInventoryItem(
  asset: z.infer<typeof RawSteamAssetSchema>,
  description: z.infer<typeof RawSteamDescriptionSchema>,
): SteamInventoryItem {
  return SteamInventoryItemSchema.parse({
    assetId: asset.assetid,
    classId: asset.classid,
    instanceId: asset.instanceid,
    marketHashName: description.market_hash_name,
    iconUrl: `https://community.cloudflare.steamstatic.com/economy/image/${description.icon_url}`,
    tradable: description.tradable === 1,
    marketable: description.marketable === 1,
    tags: description.tags.map((t) => ({
      category: t.category,
      internalName: t.internal_name,
      localizedCategoryName: t.localized_category_name,
      localizedTagName: t.localized_tag_name,
    })),
  });
}

async function fetchInventory(
  steamId: string,
  includeNonTradable: boolean,
): Promise<readonly SteamInventoryItem[]> {
  const response = await axios.get(
    `${STEAM_INVENTORY_URL}/${steamId}/${CS2_APP_ID}/${CS2_CONTEXT_ID}`,
    {
      params: { l: 'english', count: 5000 },
      headers: { 'User-Agent': 'Doppler/1.0' },
      timeout: 15_000,
    },
  );

  const raw = RawInventoryResponseSchema.parse(response.data);

  const descriptionMap = new Map(
    raw.descriptions.map((d) => [`${d.classid}_${d.instanceid}`, d]),
  );

  const items: SteamInventoryItem[] = [];
  for (const asset of raw.assets) {
    const desc = descriptionMap.get(`${asset.classid}_${asset.instanceid}`);
    if (!desc) continue;
    if (!includeNonTradable && desc.tradable !== 1) continue;
    items.push(mapToInventoryItem(asset, desc));
  }

  return items;
}

export async function getInventory(
  steamId: string,
  includeNonTradable = false,
): Promise<readonly SteamInventoryItem[]> {
  const cacheKey = `steam:inventory:${steamId}:${includeNonTradable ? 'all' : 'tradable'}`;
  return getOrFetch(cacheKey, CACHE_TTL_SECONDS, () =>
    fetchInventory(steamId, includeNonTradable),
  );
}
