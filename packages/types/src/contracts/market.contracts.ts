import { z } from 'zod';
import { SteamPriceResponseSchema, CSFloatListingSchema } from '../market';

export const GetPriceContract = {
  params: z.object({
    item: z.string(),
  }),
  query: z.object({}),
  body: z.object({}),
  response: z.object({
    steam: SteamPriceResponseSchema.nullable(),
    csfloat: z.object({
      lowestPrice: z.number().nullable(),
      listingCount: z.number(),
    }).nullable(),
  }),
} as const;

export const GetListingsContract = {
  params: z.object({}),
  query: z.object({
    item: z.string(),
    maxPrice: z.coerce.number().optional(),
    maxFloat: z.coerce.number().min(0).max(1).optional(),
    sortBy: z
      .enum(['price_asc', 'price_desc', 'float_asc', 'float_desc', 'listed_at'])
      .optional()
      .default('price_asc'),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
  body: z.object({}),
  response: z.array(CSFloatListingSchema),
} as const;
