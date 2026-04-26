import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const TEST_SECRET = 'test-jwt-secret-minimum-16';

const mockFindUnique = vi.fn();

vi.mock('@doppler/db', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...overrides,
  } as Request;
}

function createMockRes(): Response & { statusCode: number; body: unknown } {
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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = TEST_SECRET;
});

describe('authenticate middleware', () => {
  it('populates req.user with valid Bearer token', async () => {
    const { authenticate } = await import('../auth');

    const token = jwt.sign({ sub: 'user-1', steamId: '76561198000000000' }, TEST_SECRET);
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      steamId: '76561198000000000',
      plan: 'FREE',
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({
      id: 'user-1',
      steamId: '76561198000000000',
      plan: 'FREE',
    });
  });

  it('reads token from cookie when no Authorization header', async () => {
    const { authenticate } = await import('../auth');

    const token = jwt.sign({ sub: 'user-1', steamId: '123' }, TEST_SECRET);
    const req = createMockReq({ cookies: { token } });
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    mockFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      steamId: '123',
      plan: 'TRADER',
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 when no token provided', async () => {
    const { authenticate } = await import('../auth');

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect((res.body as Record<string, unknown>).error).toBe('Missing authentication token');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for expired token', async () => {
    const { authenticate } = await import('../auth');

    const token = jwt.sign(
      { sub: 'user-1', steamId: '123' },
      TEST_SECRET,
      { expiresIn: '0s' },
    );
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect((res.body as Record<string, unknown>).code).toBe('TOKEN_EXPIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed token', async () => {
    const { authenticate } = await import('../auth');

    const req = createMockReq({
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect((res.body as Record<string, unknown>).error).toBe('Invalid token');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user not found in DB', async () => {
    const { authenticate } = await import('../auth');

    const token = jwt.sign({ sub: 'deleted-user', steamId: '123' }, TEST_SECRET);
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    mockFindUnique.mockResolvedValueOnce(null);

    await authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    expect((res.body as Record<string, unknown>).error).toBe('User not found');
    expect(next).not.toHaveBeenCalled();
  });
});
