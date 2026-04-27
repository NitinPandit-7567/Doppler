import Redis from 'ioredis';

let redis: Redis | null = null;
let redisAvailable = true;

function getRedis(): Redis | null {
  if (!redisAvailable) return null;

  if (!redis) {
    const url = process.env.UPSTASH_REDIS_URL;
    if (!url) {
      redisAvailable = false;
      return null;
    }
    try {
      redis = new Redis(url, { maxRetriesPerRequest: 3 });
    } catch {
      redisAvailable = false;
      return null;
    }
  }
  return redis;
}

export async function getOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const client = getRedis();

  if (client) {
    try {
      const cached = await client.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch {
      // Redis read failed — fall through to fetch
    }
  }

  const data = await fetchFn();

  if (client) {
    try {
      await client.setex(key, ttlSeconds, JSON.stringify(data));
    } catch {
      // Redis write failed — data still returned to caller
    }
  }

  return data;
}

export async function invalidate(key: string): Promise<void> {
  const client = getRedis();
  if (client) {
    try {
      await client.del(key);
    } catch {
      // Redis delete failed — non-critical
    }
  }
}
