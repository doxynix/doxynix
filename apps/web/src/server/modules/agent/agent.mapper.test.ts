import type { ChatMessage } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { agentMapper } from "./agent.mapper";

const UUID_A = "018f0000-0000-7000-8000-0000000000a1";

function makeMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    createdAt: new Date("2026-03-01T12:00:00Z"),
    id: UUID_A,
    parts: JSON.stringify([{ text: "hello", type: "text" }]),
    role: "user",
    sessionId: "018f0000-0000-7000-8000-0000000000bb",
    ...overrides,
  };
}

describe("agentMapper.toSessionMessage", () => {
  it("projects only the four wire fields and deserialises parts", () => {
    const result = agentMapper.toSessionMessage(makeMessage());

    expect(result).toStrictEqual({
      createdAt: new Date("2026-03-01T12:00:00Z"),
      id: UUID_A,
      parts: [{ text: "hello", type: "text" }],
      role: "user",
    });
    expect(Object.keys(result).sort()).toStrictEqual(["createdAt", "id", "parts", "role"]);
  });

  it("keeps the assistant role and an empty parts array", () => {
    expect(
      agentMapper.toSessionMessage(makeMessage({ parts: "[]", role: "assistant" })),
    ).toStrictEqual({
      createdAt: new Date("2026-03-01T12:00:00Z"),
      id: UUID_A,
      parts: [],
      role: "assistant",
    });
  });

  it("logs and yields empty parts instead of throwing on unparseable parts", () => {
    const mapped = agentMapper.toSessionMessage(makeMessage({ parts: "{not json" }));

    expect(mapped.parts).toEqual([]);
    expect(mapped.id).toBe(UUID_A);
  });
});
