import { appLogger } from "@/server/core/app-logger";
import { redisClient } from "@/server/core/redis";

// Атомарный Lua-скрипт алгоритма Token Bucket (TPM)
// KEYS[1]: Ключ лимитера в Redis (например, "llm:tpm-limiter")
// ARGV[1]: Вес текущего запроса (tokens weight)
// ARGV[2]: Максимальный лимит бакета (capacity - 150000)
// ARGV[3]: Скорость регенерации токенов в миллисекунду (capacity / interval_ms)
// ARGV[4]: Текущий timestamp (Date.now())
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local weight = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local fill_rate = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_update')
local tokens = tonumber(data[1])
local last_update = tonumber(data[2])

if not tokens then
  tokens = capacity
  last_update = now
else
  local elapsed = now - last_update
  local regenerated = elapsed * fill_rate
  tokens = math.min(capacity, tokens + regenerated)
  last_update = now
end

if tokens >= weight then
  tokens = tokens - weight
  redis.call('HMSET', key, 'tokens', tokens, 'last_update', last_update)
  redis.call('EXPIRE', key, 120)
  return 1
else
  return 0
end
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Единый интерфейс лимитера
 */
export const llmLimiter = {
  schedule: async <T>(
    options: { id: string; weight: number },
    task: () => Promise<T>
  ): Promise<T> => {
    const key = "llm:tpm-limiter";
    const capacity = 230_000;
    const intervalMs = 60 * 1000;
    const fillRate = capacity / intervalMs;

    const requestWeight = Math.min(options.weight, capacity);
    const requestId = `${options.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const MAX_ATTEMPTS = 10;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const now = Date.now();

        const allowed = await redisClient.eval(
          TOKEN_BUCKET_LUA,
          [key],
          [requestWeight, capacity, fillRate, now]
        );

        if (Number(allowed) === 1) {
          if (attempt > 1) {
            appLogger.info({
              baseRequestId: options.id,
              msg: `LLM request admitted after ${attempt} attempts`,
              requestId,
              weight: options.weight,
            });
          }
          return await task();
        }

        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `LLM Rate limit reached (TPM). Max retry attempts (${MAX_ATTEMPTS}) exceeded.`
          );
        }

        const waitTimeMs = Math.max(Math.min(Math.ceil(requestWeight / fillRate), 35_000), 3000);

        appLogger.warn({
          baseRequestId: options.id,
          msg: `LLM Rate limit reached (TPM). Attempt ${attempt}/${MAX_ATTEMPTS}. Backing off for ${Math.round(waitTimeMs / 1000)}s...`,
          requestId,
          weight: options.weight,
        });

        await sleep(waitTimeMs);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Max retry attempts")) {
          throw error;
        }

        appLogger.error({
          error,
          id: options.id,
          msg: "Upstash API error in llmLimiter. Executing fallback directly.",
        });
        return await task();
      }
    }

    return task();
  },
};
