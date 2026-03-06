import {
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { NotifyTypeSchema } from "@/generated/zod";

export const notificationsParsers = {
  isRead: parseAsBoolean,
  limit: parseAsInteger.withDefault(5),
  owner: parseAsString,
  page: parseAsInteger.withDefault(1),
  repo: parseAsString,
  search: parseAsString.withDefault(""),
  type: parseAsStringLiteral(NotifyTypeSchema.options),
};

export type NotificationsParsersState = inferParserType<typeof notificationsParsers>;
