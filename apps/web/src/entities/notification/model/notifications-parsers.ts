import { NotifyTypeSchema } from "@doxynix/shared";
import {
  type inferParserType,
  parseAsBoolean,
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const NOTIFICATIONS_DEFAULT_LIMIT = 20;

export const notificationsParsers = {
  from: parseAsIsoDate,
  isRead: parseAsBoolean,
  limit: parseAsInteger.withDefault(NOTIFICATIONS_DEFAULT_LIMIT),
  owner: parseAsString,
  page: parseAsInteger.withDefault(1),
  repo: parseAsString,
  search: parseAsString.withDefault(""),
  to: parseAsIsoDate,
  type: parseAsStringLiteral(NotifyTypeSchema.options),
};

export type NotificationsParsersState = inferParserType<typeof notificationsParsers>;
