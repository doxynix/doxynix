import { Axiom } from "@axiomhq/js";
import { env } from "@server/core/env";

export const axiom = new Axiom({
  token: env.AXIOM_TOKEN,
});
