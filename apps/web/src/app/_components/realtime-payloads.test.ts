import { describe, expect, it } from "vitest";

import { REALTIME_CONFIG } from "@/shared/config/realtime";

import { parseRealtimePayload, RealtimeUserPayloads } from "./realtime-payloads";

describe("realtime user payloads", () => {
  it("keys the record by the event names the config uses", () => {
    expect(Object.keys(RealtimeUserPayloads).sort()).toEqual(
      [
        REALTIME_CONFIG.events.user.analysisProgress,
        REALTIME_CONFIG.events.user.fileActionCompleted,
        REALTIME_CONFIG.events.user.notification,
        REALTIME_CONFIG.events.user.prCommentReceived,
      ].sort(),
    );
  });

  describe("notification", () => {
    const schema = RealtimeUserPayloads.notification;

    it("accepts a well-formed payload", () => {
      expect(parseRealtimePayload(schema, { body: "hi", title: "Saved" })).toEqual({
        body: "hi",
        title: "Saved",
      });
    });

    it("drops a payload missing its title", () => {
      expect(parseRealtimePayload(schema, { body: "hi" })).toBeNull();
    });

    it("drops a payload with wrongly typed fields", () => {
      expect(parseRealtimePayload(schema, { body: 1, title: 2 })).toBeNull();
    });
  });

  describe("fileActionCompleted", () => {
    const schema = RealtimeUserPayloads.fileActionCompleted;

    it("accepts a fix-generated payload with a fixId", () => {
      expect(parseRealtimePayload(schema, { fixId: "f1", type: "FIX_GENERATED" })).toEqual({
        fixId: "f1",
        type: "FIX_GENERATED",
      });
    });

    it("accepts a payload with neither fixId nor path", () => {
      expect(parseRealtimePayload(schema, { type: "AUDIT" })).toEqual({ type: "AUDIT" });
    });

    it("drops an unknown action type", () => {
      expect(parseRealtimePayload(schema, { type: "SOMETHING_ELSE" })).toBeNull();
    });
  });

  describe("prCommentReceived", () => {
    const schema = RealtimeUserPayloads["pr-comment-received"];
    const valid = {
      author: "a",
      authorAvatarUrl: "https://example.com/a.png",
      commentId: "c",
      prNumber: 7,
      prTitle: "Fix",
      repoName: "doxynix",
      repoOwner: "Kramarich0",
    };

    it("accepts a well-formed payload", () => {
      expect(parseRealtimePayload(schema, valid)).toEqual(valid);
    });

    it("drops a payload whose prNumber arrived as a string", () => {
      expect(parseRealtimePayload(schema, { ...valid, prNumber: "7" })).toBeNull();
    });
  });

  describe("analysisProgress", () => {
    const schema = RealtimeUserPayloads["analysis-progress"];

    it("accepts every generated status", () => {
      for (const status of ["DONE", "FAILED", "NEW", "PENDING"]) {
        expect(
          parseRealtimePayload(schema, { analysisId: "a", message: "m", progress: 1, status }),
        ).not.toBeNull();
      }
    });

    it("drops a status outside the generated enum", () => {
      expect(
        parseRealtimePayload(schema, {
          analysisId: "a",
          message: "m",
          progress: 1,
          status: "NOPE",
        }),
      ).toBeNull();
    });

    it("drops a non-numeric progress", () => {
      expect(
        parseRealtimePayload(schema, {
          analysisId: "a",
          message: "m",
          progress: "1",
          status: "NEW",
        }),
      ).toBeNull();
    });
  });

  it("drops a payload that is not an object, for every event", () => {
    expect(parseRealtimePayload(RealtimeUserPayloads.notification, null)).toBeNull();
    expect(parseRealtimePayload(RealtimeUserPayloads.fileActionCompleted, "s")).toBeNull();
    expect(parseRealtimePayload(RealtimeUserPayloads["pr-comment-received"], 42)).toBeNull();
    expect(parseRealtimePayload(RealtimeUserPayloads["analysis-progress"], true)).toBeNull();
  });
});
