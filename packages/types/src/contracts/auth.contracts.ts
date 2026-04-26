import { z } from 'zod';

export const SteamCallbackContract = {
  params: z.object({}),
  query: z.object({
    'openid.claimed_id': z.string(),
    'openid.identity': z.string(),
    'openid.sig': z.string(),
    'openid.signed': z.string(),
  }).passthrough(),
  body: z.object({}),
  response: z.object({
    token: z.string(),
    user: z.object({
      id: z.string(),
      steamId: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
    }),
  }),
} as const;
