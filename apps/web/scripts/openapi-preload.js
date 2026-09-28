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
