import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_URL;
    if (!url) {
      throw new Error('UPSTASH_REDIS_URL is not set');
    }
    redis = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return redis;
}

export async function getOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const client = getRedis();
  const cached = await client.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  const data = await fetchFn();
  await client.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}

export async function invalidate(key: string): Promise<void> {
  const client = getRedis();
  await client.del(key);
}
