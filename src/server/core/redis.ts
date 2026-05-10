import Redis from "ioredis";

export const redisClient = Redis.fromEnv();
