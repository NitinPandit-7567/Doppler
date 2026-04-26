import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { createRoute } from '../createRoute';

const TestContract = {
  params: z.object({}),
  query: z.object({}),
  body: z.object({
    name: z.string().min(1),
    count: z.number().int().positive(),
  }),
  response: z.object({ id: z.string() }),
} as const;

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-1', steamId: '123', plan: 'FREE' },
    ...overrides,
  } as Request;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('createRoute', () => {
  it('passes validated data to handler', async () => {
    const handler = vi.fn().mockImplementation(async (_data, res) => {
      res.json({ success: true, data: { id: 'created' } });
    });

    const middleware = createRoute(TestContract, handler);
    const req = createMockReq({ body: { name: 'test', count: 5 } });
    const res = createMockRes();

    await middleware(req, res, vi.fn());

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0].body).toEqual({ name: 'test', count: 5 });
    expect(handler.mock.calls[0]?.[0].user.id).toBe('user-1');
  });

  it('returns 400 when body validation fails', async () => {
    const handler = vi.fn();
    const middleware = createRoute(TestContract, handler);
    const req = createMockReq({ body: { name: '', count: -1 } });
    const res = createMockRes();

    await middleware(req, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
    expect((res.body as Record<string, unknown>).error).toContain('Invalid body');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const handler = vi.fn();
    const middleware = createRoute(TestContract, handler);
    const req = createMockReq({ body: {} });
    const res = createMockRes();

    await middleware(req, res, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 500 when handler throws', async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error('Database connection failed'));
    const middleware = createRoute(TestContract, handler);
    const req = createMockReq({ body: { name: 'test', count: 1 } });
    const res = createMockRes();

    await middleware(req, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect((res.body as Record<string, unknown>).success).toBe(false);
    expect((res.body as Record<string, unknown>).error).toBe('Database connection failed');
  });

  it('validates query params', async () => {
    const WithQueryContract = {
      params: z.object({}),
      query: z.object({ page: z.coerce.number().positive() }),
      body: z.object({}),
      response: z.object({}),
    } as const;

    const handler = vi.fn().mockImplementation(async (_data, res) => {
      res.json({ success: true, data: {} });
    });

    const middleware = createRoute(WithQueryContract, handler);
    const req = createMockReq({ query: { page: '3' } });
    const res = createMockRes();

    await middleware(req, res, vi.fn());

    expect(handler.mock.calls[0]?.[0].query.page).toBe(3);
  });
});
