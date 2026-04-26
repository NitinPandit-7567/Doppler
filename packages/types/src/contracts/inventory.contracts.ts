import { z } from 'zod';
import { SteamInventoryItemSchema } from '../market';

export const GetInventoryContract = {
  params: z.object({}),
  query: z.object({
    includeNonTradable: z.coerce.boolean().optional().default(false),
  }),
  body: z.object({}),
  response: z.array(SteamInventoryItemSchema),
} as const;

export const GetInventoryValueContract = {
  params: z.object({}),
  query: z.object({}),
  body: z.object({}),
  response: z.object({
    totalValueUsd: z.number(),
    itemCount: z.number(),
    lastSyncedAt: z.string().datetime(),
  }),
} as const;

export const SyncInventoryContract = {
  params: z.object({}),
  query: z.object({}),
  body: z.object({}),
  response: z.object({
    itemCount: z.number(),
    totalValueUsd: z.number(),
  }),
} as const;
