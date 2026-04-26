import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockSetex = vi.fn();
const mockDel = vi.fn();

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      get = mockGet;
      setex = mockSetex;
      del = mockDel;
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.UPSTASH_REDIS_URL = 'redis://localhost:6379';
});

describe('getOrFetch', () => {
  it('returns cached data without calling fetchFn on cache hit', async () => {
    const { getOrFetch } = await import('../cache');
    const cachedData = { price: 38.5 };
    mockGet.mockResolvedValueOnce(JSON.stringify(cachedData));
    const fetchFn = vi.fn();

    const result = await getOrFetch('test-key', 60, fetchFn);

    expect(result).toEqual(cachedData);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(mockSetex).not.toHaveBeenCalled();
  });

  it('calls fetchFn and caches result on cache miss', async () => {
    const { getOrFetch } = await import('../cache');
    mockGet.mockResolvedValueOnce(null);
    const freshData = { price: 42.0 };
    const fetchFn = vi.fn().mockResolvedValueOnce(freshData);

    const result = await getOrFetch('test-key', 120, fetchFn);

    expect(result).toEqual(freshData);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(mockSetex).toHaveBeenCalledWith('test-key', 120, JSON.stringify(freshData));
  });

  it('propagates fetchFn errors', async () => {
    const { getOrFetch } = await import('../cache');
    mockGet.mockResolvedValueOnce(null);
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('API down'));

    await expect(getOrFetch('key', 60, fetchFn)).rejects.toThrow('API down');
  });
});

describe('invalidate', () => {
  it('deletes the cache key', async () => {
    const { invalidate } = await import('../cache');
    mockDel.mockResolvedValueOnce(1);

    await invalidate('steam:price:ak47');

    expect(mockDel).toHaveBeenCalledWith('steam:price:ak47');
  });
});
