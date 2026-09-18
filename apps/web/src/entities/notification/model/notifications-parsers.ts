import { NotifyTypeSchema } from "@doxynix/shared";
import {
  type inferParserType,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const notificationsParsers = {
  isRead: parseAsBoolean,
  limit: parseAsInteger.withDefault(20),
  owner: parseAsString,
  page: parseAsInteger.withDefault(1),
  repo: parseAsString,
  search: parseAsString.withDefault(""),
  type: parseAsStringLiteral(NotifyTypeSchema.options),
};

export type NotificationsParsersState = inferParserType<typeof notificationsParsers>;
