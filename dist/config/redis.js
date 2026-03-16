"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRedis = initializeRedis;
exports.isRedisReady = isRedisReady;
exports.getRedisCommandClient = getRedisCommandClient;
exports.getRedisPubClient = getRedisPubClient;
exports.getRedisSubClient = getRedisSubClient;
exports.pingRedis = pingRedis;
const redis_1 = require("redis");
const env_1 = require("./env");
let commandClient = null;
let pubClient = null;
let subClient = null;
let connected = false;
function redisEnabled() {
    return env_1.ENV.REDIS_URL.length > 0;
}
function wireErrorLog(client, label) {
    client.on('error', (error) => {
        console.error(`[Redis] ${label} error:`, error);
    });
}
async function initializeRedis() {
    if (!redisEnabled() || connected)
        return;
    commandClient = (0, redis_1.createClient)({ url: env_1.ENV.REDIS_URL });
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
function isRedisReady() {
    return connected && commandClient !== null && pubClient !== null && subClient !== null;
}
function getRedisCommandClient() {
    return commandClient;
}
function getRedisPubClient() {
    return pubClient;
}
function getRedisSubClient() {
    return subClient;
}
async function pingRedis() {
    if (!isRedisReady() || !commandClient)
        return false;
    try {
        const pong = await commandClient.ping();
        return pong === 'PONG';
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=redis.js.map