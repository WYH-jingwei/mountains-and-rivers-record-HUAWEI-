import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let connectFailed = false;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (connectFailed) return null;
  if (client) return client;

  try {
    client = createClient({
      url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
      socket: { connectTimeout: 2000, reconnectStrategy: false },
    });

    client.on('error', () => {
      connectFailed = true;
    });

    await client.connect();
    console.log('Redis connected');
    return client;
  } catch {
    connectFailed = true;
    console.log('Redis unavailable — running without cache');
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const c = await getRedisClient();
    if (!c) return null;
    const val = await c.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const c = await getRedisClient();
    if (!c) return;
    await c.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // 缓存写入失败不影响主流程
  }
}

export async function cacheInvalidate(prefix: string): Promise<void> {
  try {
    const c = await getRedisClient();
    if (!c) return;
    const keys = await c.keys(`${prefix}*`);
    if (keys.length > 0) await c.del(keys);
  } catch {
    // 忽略
  }
}