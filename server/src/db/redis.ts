import { createClient } from 'redis';

// 固定 RESP2 客户端类型：兼容本地 Redis 3.0（不支持 HELLO/RESP3），RESP2 亦通用于新版 Redis 与华为云 DCS
type RedisClient = ReturnType<typeof createClient<{}, {}, {}, 2>>;

let client: RedisClient | null = null;
let connectFailed = false;

export async function getRedisClient(): Promise<RedisClient | null> {
  if (connectFailed) return null;
  if (client) return client;

  try {
    const instance = createClient({
      RESP: 2,
      url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`,
      socket: { connectTimeout: 2000, reconnectStrategy: false },
    });

    instance.on('error', () => {
      connectFailed = true;
    });

    await instance.connect();
    client = instance;
    console.log('Redis connected');
    return instance;
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
