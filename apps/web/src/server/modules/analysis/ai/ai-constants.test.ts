import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — declared BEFORE any source imports
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const createOpenAICalls: unknown[] = [];
  return {
    appLogger: {
      debug: vi.fn(),
      error: vi.fn(),
      flush: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    // Runs at module load time with GROQ_API_KEY; capture the options.
    createOpenAI: vi.fn((options: unknown) => {
      createOpenAICalls.push(options);
      return {};
    }),
    createOpenAICalls,
    getEdgeConfig: vi.fn(),
  };
});

vi.mock("@ai-sdk/openai", () => ({ createOpenAI: mocks.createOpenAI }));
vi.mock("@vercel/edge-config", () => ({ get: mocks.getEdgeConfig }));
vi.mock("@/shared/config/env.server", () => ({ GROQ_API_KEY: "test-groq-key" }));
vi.mock("@/server/core/app-logger", () => ({ appLogger: mocks.appLogger }));

// ---------------------------------------------------------------------------
// Module under test (import must follow the mocks)
// ---------------------------------------------------------------------------
import { DEFAULT_AI_MODELS, getActiveModels, SAFETY_SETTINGS } from "./ai-constants";

const ALL_ROLES = [
  "AGENT",
  "ARCHITECT",
  "CARTOGRAPHER",
  "FALLBACK",
  "POWERFUL",
  "SENTINEL",
  "WRITER",
] as const;

describe("ai-constants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("module initialization", () => {
    it("creates the groq client at load time with the GROQ_API_KEY and Groq base URL", () => {
      expect(mocks.createOpenAICalls).toEqual([
        {
          apiKey: "test-groq-key",
          baseURL: "https://api.groq.com/openai/v1",
        },
      ]);
    });
  });

  describe("DEFAULT_AI_MODELS", () => {
    it("covers all seven AI roles as keys", () => {
      expect(Object.keys(DEFAULT_AI_MODELS).sort()).toEqual([...ALL_ROLES].sort());
    });

    it("provides two candidate models per role", () => {
      for (const role of ALL_ROLES) {
        expect(DEFAULT_AI_MODELS[role]).toHaveLength(2);
      }
    });
  });

  describe("SAFETY_SETTINGS", () => {
    it("defines five settings that all block nothing", () => {
      expect(SAFETY_SETTINGS).toHaveLength(5);
      for (const setting of SAFETY_SETTINGS) {
        expect(setting.threshold).toBe("BLOCK_NONE");
      }
    });
  });

  describe("getActiveModels", () => {
    it("returns DEFAULT_AI_MODELS when edge config resolves null", async () => {
      mocks.getEdgeConfig.mockResolvedValue(null);

      await expect(getActiveModels()).resolves.toBe(DEFAULT_AI_MODELS);
    });

    it("returns a valid remote config as-is", async () => {
      // Zod 4 z.record(enum, value) requires ALL enum keys to be present.
      const remoteConfig = {
        AGENT: ["m1"],
        ARCHITECT: ["m2"],
        CARTOGRAPHER: ["m3"],
        FALLBACK: ["m4"],
        POWERFUL: ["m5"],
        SENTINEL: ["m6"],
        WRITER: ["m7"],
      };
      mocks.getEdgeConfig.mockResolvedValue(remoteConfig);

      await expect(getActiveModels()).resolves.toEqual(remoteConfig);
      expect(mocks.getEdgeConfig).toHaveBeenCalledWith("AI_MODELS_CONFIG");
    });

    it("falls back to defaults when a partial remote config omits roles", async () => {
      // Zod 4 treats partial records as invalid (missing enum keys -> parse failure).
      mocks.getEdgeConfig.mockResolvedValue({ AGENT: ["m1"], SENTINEL: ["m2"] });

      await expect(getActiveModels()).resolves.toBe(DEFAULT_AI_MODELS);
      expect(mocks.appLogger.error).toHaveBeenCalledOnce();
    });

    it("falls back to defaults and logs when the remote config contains invalid keys", async () => {
      mocks.getEdgeConfig.mockResolvedValue({ WRONG: ["x"] });

      await expect(getActiveModels()).resolves.toBe(DEFAULT_AI_MODELS);
      expect(mocks.appLogger.error).toHaveBeenCalledOnce();
    });

    it("falls back to defaults and logs when a role value is malformed", async () => {
      mocks.getEdgeConfig.mockResolvedValue({ AGENT: "not-an-array" });

      await expect(getActiveModels()).resolves.toBe(DEFAULT_AI_MODELS);
      expect(mocks.appLogger.error).toHaveBeenCalledOnce();
    });

    it("falls back to defaults and warns when edge config get() throws", async () => {
      mocks.getEdgeConfig.mockRejectedValue(new Error("edge down"));

      await expect(getActiveModels()).resolves.toBe(DEFAULT_AI_MODELS);
      expect(mocks.appLogger.warn).toHaveBeenCalledOnce();
    });
  });
});
