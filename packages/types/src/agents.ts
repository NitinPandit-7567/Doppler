import { z } from 'zod';

// ── Plan enum (mirrors Prisma enum) ─────────────
export const PlanValues = ['FREE', 'TRADER', 'INVESTOR', 'PRO'] as const;
export const PlanSchema = z.enum(PlanValues);
export type Plan = z.infer<typeof PlanSchema>;

// ── Agent Context (passed to AgentRunner) ───────
export const AgentContextSchema = z.object({
  userId: z.string(),
  steamId: z.string(),
  plan: PlanSchema,
  watchlistItems: z.array(z.string()).optional(),
});

export type AgentContext = z.infer<typeof AgentContextSchema>;

// ── Agent Step (stored in AgentRun.steps Json) ──
export const AgentStepSchema = z.object({
  stepNumber: z.number(),
  text: z.string(),
  toolCalls: z
    .array(
      z.object({
        toolName: z.string(),
        args: z.record(z.unknown()),
      }),
    )
    .optional(),
  toolResults: z
    .array(
      z.object({
        toolName: z.string(),
        result: z.unknown(),
      }),
    )
    .optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  finishReason: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type AgentStep = z.infer<typeof AgentStepSchema>;

// ── Agent Run Result (returned by AgentRunner) ──
export const AgentRunResultSchema = z.object({
  text: z.string(),
  steps: z.array(AgentStepSchema),
  totalTokens: z.number(),
  finishReason: z.string(),
});

export type AgentRunResult = z.infer<typeof AgentRunResultSchema>;

// ── Trade Action (evaluated by ActionGuard) ─────
export const TradeActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BUY'),
    valueUsd: z.number(),
  }),
  z.object({
    type: z.literal('SELL'),
    valueUsd: z.number(),
    steamPriceUsd: z.number(),
  }),
]);

export type TradeAction = z.infer<typeof TradeActionSchema>;

// ── Auto-Approve Config (from UserSettings) ─────
export const AutoApproveConfigSchema = z.object({
  confirmAbove: z.number(),
  maxBuyPerTransaction: z.number(),
  dailySpendLimit: z.number(),
  maxSellDiscountPct: z.number(),
});

export type AutoApproveConfig = z.infer<typeof AutoApproveConfigSchema>;

// ── Approval Result (returned by ActionGuard) ───
export const ApprovalResultSchema = z.discriminatedUnion('approved', [
  z.object({
    approved: z.literal(true),
    reason: z.literal('within_limits'),
  }),
  z.object({
    approved: z.literal(false),
    requiresUserApproval: z.boolean(),
    reason: z.enum([
      'above_confirm_threshold',
      'exceeds_per_transaction_limit',
      'daily_limit_reached',
      'below_sell_floor',
    ]),
    message: z.string(),
  }),
]);

export type ApprovalResult = z.infer<typeof ApprovalResultSchema>;

// ── Trade Action Payload (stored in AgentAction.payload Json) ─
export const TradeActionPayloadSchema = z.object({
  listingId: z.string(),
  platform: z.enum(['STEAM', 'CSFLOAT']),
  itemName: z.string(),
  priceUsd: z.number(),
  floatValue: z.number().nullable(),
  listingUrl: z.string(),
});

export type TradeActionPayload = z.infer<typeof TradeActionPayloadSchema>;

// ── Patch Report Analysis (stored in PatchReport.analysis Json) ─
export const PatchAnalysisSchema = z.object({
  summary: z.string(),
  buffedWeapons: z.array(z.string()),
  nerfedWeapons: z.array(z.string()),
  newContent: z.array(z.string()),
  metaChanges: z.string(),
});

export type PatchAnalysis = z.infer<typeof PatchAnalysisSchema>;

// ── Affected Item (stored in PatchReport.affectedItems Json) ─
export const AffectedItemSchema = z.object({
  itemName: z.string(),
  direction: z.enum(['up', 'down', 'neutral']),
  confidence: z.number().min(1).max(10),
  timeHorizon: z.enum(['immediate', '1week', '1month']),
  reasoning: z.string(),
});

export type AffectedItem = z.infer<typeof AffectedItemSchema>;
