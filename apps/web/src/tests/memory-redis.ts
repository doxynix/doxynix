import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

/**
 * In-memory stand-in for the Upstash Redis REST API.
 *
 * Tests used to run without a REST URL, so every command failed after five retries with an
 * `e^n * 50 ms` backoff — 4.2s per call, which dominated the integration suite. Pointing the client
 * at this server keeps the failure path out of the way: commands succeed in microseconds and the
 * services under test behave the way they do in production.
 *
 * Only the commands this codebase issues are implemented. Anything else answers with a fast error
 * instead of hanging.
 */
export const MEMORY_REDIS_PORT = 18_777;

type Entry = { expiresAt: null | number; value: string };

const STRINGS = new Map<string, Entry>();
const HASHES = new Map<string, Map<string, string>>();

function alive(entry: Entry | undefined): Entry | undefined {
  if (entry == null) {
    return undefined;
  }
  if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
    return undefined;
  }
  return entry;
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function run(command: unknown[]): unknown {
  const [name, ...args] = command;
  const key = asString(args[0]);

  switch (String(name).toLowerCase()) {
    case "del": {
      let removed = 0;
      for (const candidate of args) {
        const target = asString(candidate);
        if (STRINGS.delete(target) || HASHES.delete(target)) {
          removed += 1;
        }
      }
      return removed;
    }
    case "eval": {
      const script = String(args[0]);
      // @upstash/ratelimit expects [currentIds, previousIds, success] for the window script and
      // [matches, status] for the deny list. Empty + permissive keeps the limiters out of the way.
      return script.includes("deny list") ? [[], -1] : [[], [], 1];
    }
    case "evalsha": {
      // Forces the client down the documented NOSCRIPT fallback, where the script text is visible.
      throw new Error("NOSCRIPT No matching script. Please use EVAL.");
    }
    case "expire": {
      const entry = alive(STRINGS.get(key));
      if (entry == null) {
        return 0;
      }
      entry.expiresAt = Date.now() + toNumber(args[1]) * 1000;
      return 1;
    }
    case "get": {
      return alive(STRINGS.get(key))?.value ?? null;
    }
    case "getdel": {
      const entry = alive(STRINGS.get(key));
      STRINGS.delete(key);
      return entry?.value ?? null;
    }
    case "hdel": {
      const hash = HASHES.get(key);
      if (hash == null) {
        return 0;
      }
      let removed = 0;
      for (const field of args.slice(1)) {
        if (hash.delete(asString(field))) {
          removed += 1;
        }
      }
      return removed;
    }
    case "hgetall": {
      const hash = HASHES.get(key);
      return hash == null ? {} : Object.fromEntries(hash);
    }
    case "hlen": {
      return HASHES.get(key)?.size ?? 0;
    }
    case "hset": {
      const hash = HASHES.get(key) ?? new Map<string, string>();
      HASHES.set(key, hash);
      const rest = args.slice(1);
      if (rest.length === 1 && typeof rest[0] === "object" && rest[0] != null) {
        for (const [field, value] of Object.entries(rest[0] as Record<string, unknown>)) {
          hash.set(field, asString(value));
        }
      } else {
        for (let index = 0; index < rest.length; index += 2) {
          hash.set(asString(rest[index]), asString(rest[index + 1]));
        }
      }
      return hash.size;
    }
    case "incr": {
      const next = Number(alive(STRINGS.get(key))?.value ?? 0) + 1;
      STRINGS.set(key, {
        expiresAt: alive(STRINGS.get(key))?.expiresAt ?? null,
        value: String(next),
      });
      return next;
    }
    case "ping": {
      return "PONG";
    }
    case "set": {
      const value = asString(args[1]);
      const options = args.slice(2).map((option) => String(option).toLowerCase());
      const exists = alive(STRINGS.get(key)) != null;
      if (options.includes("nx") && exists) {
        return null;
      }
      if (options.includes("xx") && !exists) {
        return null;
      }

      let expiresAt: null | number = null;
      const px = options.indexOf("px");
      const ex = options.indexOf("ex");
      if (px !== -1) {
        expiresAt = Date.now() + toNumber(args[2 + px + 1]);
      } else if (ex !== -1) {
        expiresAt = Date.now() + toNumber(args[2 + ex + 1]) * 1000;
      }

      const previous = alive(STRINGS.get(key))?.value ?? null;
      STRINGS.set(key, { expiresAt, value });
      return options.includes("get") ? previous : "OK";
    }
    default: {
      // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring — test double, command name comes from the app under test
      console.warn(`memory redis: unsupported command "${String(name)}"`, command);
      throw new Error(`memory redis: unsupported command "${String(name)}"`);
    }
  }
}

function encode(value: unknown, base64: boolean): unknown {
  const payload = value ?? null;
  return base64 ? Buffer.from(JSON.stringify(payload)).toString("base64") : payload;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length === 0 ? null : JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const base64 = request.headers["upstash-encoding"] === "base64";
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };

  try {
    const body = await readBody(request);
    const commands = request.url === "/pipeline" ? (body as unknown[][]) : [body as unknown[]];

    if (!Array.isArray(commands)) {
      send(400, { error: "memory redis: expected a command array" });
      return;
    }

    const results = commands.map((command) => {
      try {
        return { result: encode(run(command), base64) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    });

    send(200, request.url === "/pipeline" ? results : results[0]);
  } catch (error) {
    send(400, { error: error instanceof Error ? error.message : String(error) });
  }
}

export type MemoryRedisHandle = {
  close: () => Promise<void>;
  url: string;
};

export async function startMemoryRedis(port = MEMORY_REDIS_PORT): Promise<MemoryRedisHandle> {
  const server = createServer((request, response) => {
    void handle(request, response);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
  } catch (error) {
    // A second run (unit + integration at once) can reach the port first; sharing it is harmless.
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      return { close: async () => undefined, url: `http://127.0.0.1:${port}` };
    }
    throw error;
  }

  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
    url: `http://127.0.0.1:${port}`,
  };
}
