import { describe, expect, it } from "vitest";

import {
  DELETE as routeDELETE,
  GET as routeGET,
  HEAD as routeHEAD,
  OPTIONS as routeOPTIONS,
  PATCH as routePATCH,
  POST as routePOST,
  PUT as routePUT,
} from "./route";

describe("[...all] catch-all route", () => {
  const methods = [
    ["GET", routeGET],
    ["POST", routePOST],
    ["PUT", routePUT],
    ["PATCH", routePATCH],
    ["DELETE", routeDELETE],
    ["HEAD", routeHEAD],
    ["OPTIONS", routeOPTIONS],
  ] as const;

  for (const [name, handler] of methods) {
    it(`${name} returns 404 with "Not found" error`, async () => {
      const response = handler();

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Not found" });
    });
  }
});
