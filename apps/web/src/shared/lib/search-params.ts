import { parseAsString, throttle } from "nuqs";

// 100ms keeps URL writes inside the 0.1s "instantaneous" perception limit
export const searchTextParam = parseAsString.withDefault("").withOptions({
  limitUrlUpdates: throttle(100),
});
