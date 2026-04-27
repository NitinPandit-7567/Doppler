import axios from 'axios';
import { z } from 'zod';
import { SteamInventoryItemSchema } from '@doppler/types';
import type { SteamInventoryItem } from '@doppler/types';
import { getOrFetch } from './cache';

const STEAM_COMMUNITY_URL = 'https://steamcommunity.com';
const CACHE_TTL_SECONDS = 5 * 60;
const CS2_APP_ID = 730;
const CS2_CONTEXT_ID = 2;
const PAGE_SIZE = 2000;

export class SteamPrivateInventoryError extends Error {
  readonly code: string;
  constructor(steamId: string, reason: 'profile_private' | 'inventory_private') {
    const message =
      reason === 'profile_private'
        ? `Steam profile is private for Steam ID ${steamId}`
        : `Steam inventory is private for Steam ID ${steamId}`;
    super(message);
    this.name = 'SteamPrivateInventoryError';
    this.code = reason;
  }
}

export class SteamNoCS2Error extends Error {
  constructor(steamId: string) {
    super(`No CS2 game data found for Steam ID ${steamId}`);
    this.name = 'SteamNoCS2Error';
  }
}

const RawSteamAssetSchema = z.object({
  assetid: z.string(),
  classid: z.string(),
  instanceid: z.string().default('0'),
});

const RawSteamDescriptionSchema = z.object({
  classid: z.string(),
  instanceid: z.string().default('0'),
  market_hash_name: z.string().optional().default('Unknown Item'),
  icon_url: z.string().optional().default(''),
  tradable: z.number().default(0),
  marketable: z.number().default(0),
  tags: z
    .array(
      z.object({
        category: z.string().optional().default(''),
        internal_name: z.string().optional().default(''),
        localized_category_name: z.string().optional().default(''),
        localized_tag_name: z.string().optional().default(''),
      }),
    )
    .optional()
    .default([]),
});

const RawInventoryResponseSchema = z.object({
  assets: z.array(RawSteamAssetSchema).optional().default([]),
  descriptions: z.array(RawSteamDescriptionSchema).optional().default([]),
  total_inventory_count: z.number().optional().default(0),
  success: z.union([z.number(), z.boolean()]).transform((v) => (v === 1 || v === true ? 1 : 0)),
  more_items: z.union([z.number(), z.boolean()]).optional(),
  last_assetid: z.string().optional(),
});

function buildHeaders(steamId: string) {
  return {
    Referer: `${STEAM_COMMUNITY_URL}/profiles/${steamId}/inventory`,
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept: 'application/json',
  };
}

async function fetchInventoryPage(
  steamId: string,
  startAssetId?: string,
): Promise<z.infer<typeof RawInventoryResponseSchema>> {
  const params: Record<string, string | number> = {
    l: 'english',
    count: PAGE_SIZE,
  };
  if (startAssetId) {
    params.start_assetid = startAssetId;
  }

  const response = await axios.get(
    `${STEAM_COMMUNITY_URL}/inventory/${steamId}/${CS2_APP_ID}/${CS2_CONTEXT_ID}`,
    {
      params,
      headers: buildHeaders(steamId),
      timeout: 15_000,
    },
  );

  if (typeof response.data === 'string') {
    if (response.data.includes('private') || response.data.includes('<html')) {
      throw new SteamPrivateInventoryError(steamId, 'profile_private');
    }
    throw new Error(`Unexpected Steam response format for ${steamId}`);
  }

  const parsed = RawInventoryResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new SteamPrivateInventoryError(steamId, 'inventory_private');
  }

  if (parsed.data.success !== 1) {
    throw new SteamPrivateInventoryError(steamId, 'inventory_private');
  }

  return parsed.data;
}

async function fetchInventory(
  steamId: string,
  includeNonTradable: boolean,
): Promise<readonly SteamInventoryItem[]> {
  try {
    const allAssets: z.infer<typeof RawSteamAssetSchema>[] = [];
    const allDescriptions: z.infer<typeof RawSteamDescriptionSchema>[] = [];
    let startAssetId: string | undefined;

    do {
      const page = await fetchInventoryPage(steamId, startAssetId);
      allAssets.push(...page.assets);
      allDescriptions.push(...page.descriptions);

      if (page.more_items && page.last_assetid) {
        startAssetId = page.last_assetid;
      } else {
        break;
      }
    } while (true);

    if (allAssets.length === 0) {
      return [];
    }

    const descriptionMap = new Map(
      allDescriptions.map((d) => [`${d.classid}_${d.instanceid}`, d]),
    );

    const items: SteamInventoryItem[] = [];
    for (const asset of allAssets) {
      const desc = descriptionMap.get(`${asset.classid}_${asset.instanceid}`);
      if (!desc) continue;
      if (!includeNonTradable && desc.tradable !== 1) continue;

      items.push(
        SteamInventoryItemSchema.parse({
          assetId: asset.assetid,
          classId: asset.classid,
          instanceId: asset.instanceid,
          marketHashName: desc.market_hash_name,
          iconUrl: desc.icon_url
            ? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}`
            : '',
          tradable: desc.tradable === 1,
          marketable: desc.marketable === 1,
          tags: desc.tags.map((t) => ({
            category: t.category,
            internalName: t.internal_name,
            localizedCategoryName: t.localized_category_name,
            localizedTagName: t.localized_tag_name,
          })),
        }),
      );
    }

    return items;
  } catch (error) {
    if (error instanceof SteamPrivateInventoryError) throw error;
    if (error instanceof SteamNoCS2Error) throw error;

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 403) throw new SteamPrivateInventoryError(steamId, 'profile_private');
      if (status === 401) throw new SteamPrivateInventoryError(steamId, 'inventory_private');
      if (status === 404) throw new SteamNoCS2Error(steamId);
      if (status === 429) {
        throw new Error('Steam is rate-limiting requests. Please try again in a few minutes.');
      }
    }

    throw error;
  }
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
