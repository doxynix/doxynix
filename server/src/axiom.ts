import { Axiom } from "@axiomhq/js";
import { env } from "@server/env";

export const axiom = new Axiom({
  token: env.AXIOM_TOKEN,
});
