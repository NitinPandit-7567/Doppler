import { z } from 'zod';

export const CreateAgentContract = {
  params: z.object({}),
  query: z.object({}),
  body: z.object({
    name: z.string().min(1).max(100),
    systemPrompt: z.string().min(10).max(5000),
    tools: z.array(z.string()).min(1),
    scheduleType: z.enum(['INTERVAL', 'CRON', 'EVENT', 'MANUAL']),
    scheduleValue: z.string(),
    autoApproveEnabled: z.boolean().optional().default(false),
    maxBuyOverride: z.number().positive().optional(),
  }),
  response: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
  }),
} as const;

export const GetAgentHistoryContract = {
  params: z.object({
    id: z.string(),
  }),
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
  body: z.object({}),
  response: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
      startedAt: z.string().datetime(),
      completedAt: z.string().datetime().nullable(),
      dealsFound: z.number(),
      actionsCount: z.number(),
      summary: z.string().nullable(),
    }),
  ),
} as const;
