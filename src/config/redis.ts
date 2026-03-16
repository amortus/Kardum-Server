import { createClient, type RedisClientType } from 'redis';
import { ENV } from './env';

let commandClient: RedisClientType | null = null;
let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;
let connected = false;

function redisEnabled(): boolean {
  return ENV.REDIS_URL.length > 0;
}

function wireErrorLog(client: RedisClientType, label: string): void {
  client.on('error', (error) => {
    console.error(`[Redis] ${label} error:`, error);
  });
}

export async function initializeRedis(): Promise<void> {
  if (!redisEnabled() || connected) return;
  commandClient = createClient({ url: ENV.REDIS_URL });
  wireErrorLog(commandClient, 'command');
  await commandClient.connect();

  pubClient = commandClient.duplicate();
  subClient = commandClient.duplicate();
  wireErrorLog(pubClient, 'pub');
  wireErrorLog(subClient, 'sub');
  await Promise.all([pubClient.connect(), subClient.connect()]);
  connected = true;
  console.log('[Redis] Connected');
}

export function isRedisReady(): boolean {
  return connected && commandClient !== null && pubClient !== null && subClient !== null;
}

export function getRedisCommandClient(): RedisClientType | null {
  return commandClient;
}

export function getRedisPubClient(): RedisClientType | null {
  return pubClient;
}

export function getRedisSubClient(): RedisClientType | null {
  return subClient;
}

export async function pingRedis(): Promise<boolean> {
  if (!isRedisReady() || !commandClient) return false;
  try {
    const pong = await commandClient.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

