import { describe, it, expect } from 'vitest';
import {
  AgentContextSchema,
  AgentStepSchema,
  TradeActionSchema,
  AutoApproveConfigSchema,
  ApprovalResultSchema,
  PlanSchema,
} from '../agents';

describe('PlanSchema', () => {
  it('accepts valid plan values', () => {
    expect(PlanSchema.parse('FREE')).toBe('FREE');
    expect(PlanSchema.parse('PRO')).toBe('PRO');
  });

  it('rejects invalid plan value', () => {
    expect(() => PlanSchema.parse('PREMIUM')).toThrow();
  });
});

describe('AgentContextSchema', () => {
  it('validates complete context', () => {
    const ctx = {
      userId: 'user-1',
      steamId: '76561198000000000',
      plan: 'TRADER' as const,
      watchlistItems: ['AK-47 | Redline (Field-Tested)'],
    };
    expect(AgentContextSchema.parse(ctx)).toEqual(ctx);
  });

  it('accepts context without optional watchlist', () => {
    const ctx = { userId: 'user-1', steamId: '123', plan: 'FREE' as const };
    expect(AgentContextSchema.parse(ctx)).toEqual(ctx);
  });
});

describe('AgentStepSchema', () => {
  it('validates a step with all fields', () => {
    const step = {
      stepNumber: 1,
      text: 'Searching for deals...',
      toolCalls: [{ toolName: 'searchCSFloatListings', args: { itemName: 'AK-47' } }],
      toolResults: [{ toolName: 'searchCSFloatListings', result: [] }],
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      finishReason: 'tool-calls',
      timestamp: '2025-01-15T10:00:00Z',
    };
    expect(AgentStepSchema.parse(step)).toEqual(step);
  });

  it('rejects step with invalid timestamp', () => {
    const bad = { stepNumber: 1, text: 'test', timestamp: 'not-a-date' };
    expect(() => AgentStepSchema.parse(bad)).toThrow();
  });
});

describe('TradeActionSchema', () => {
  it('validates BUY action', () => {
    const buy = { type: 'BUY' as const, valueUsd: 25 };
    expect(TradeActionSchema.parse(buy)).toEqual(buy);
  });

  it('validates SELL action with steamPriceUsd', () => {
    const sell = { type: 'SELL' as const, valueUsd: 30, steamPriceUsd: 35 };
    expect(TradeActionSchema.parse(sell)).toEqual(sell);
  });

  it('rejects SELL without steamPriceUsd', () => {
    const bad = { type: 'SELL', valueUsd: 30 };
    expect(() => TradeActionSchema.parse(bad)).toThrow();
  });
});

describe('ApprovalResultSchema', () => {
  it('validates approved result', () => {
    const approved = { approved: true as const, reason: 'within_limits' as const };
    expect(ApprovalResultSchema.parse(approved)).toEqual(approved);
  });

  it('validates rejected result with message', () => {
    const rejected = {
      approved: false as const,
      requiresUserApproval: true,
      reason: 'above_confirm_threshold' as const,
      message: 'Value exceeds threshold',
    };
    expect(ApprovalResultSchema.parse(rejected)).toEqual(rejected);
  });
});

describe('AutoApproveConfigSchema', () => {
  it('validates config', () => {
    const config = {
      confirmAbove: 25,
      maxBuyPerTransaction: 10,
      dailySpendLimit: 50,
      maxSellDiscountPct: 0.85,
    };
    expect(AutoApproveConfigSchema.parse(config)).toEqual(config);
  });
});
