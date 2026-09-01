import { Axiom } from "@axiomhq/js";

import { env } from "@/core/env";

export const axiom = new Axiom({
  token: env.AXIOM_TOKEN,
});
