// Bun plugin that neutralises the `server-only` guard for the OpenAPI
// generator. That module throws on import unless it is reached from a React
// Server Component, and this script imports the router outside one.
// vitest.integration.config.ts achieves the same with a resolve alias.
import { plugin } from "bun";

plugin({
  name: "stub-server-only",
  setup(build) {
    build.module("server-only", () => ({
      contents: "export default {};",
      loader: "js",
    }));
  },
});
