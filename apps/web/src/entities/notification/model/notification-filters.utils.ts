import type { MarkAllInput } from "./notifications.types";
import type { NotificationsParsersState } from "./notifications-parsers";

export const mapFiltersToInput = (filters?: NotificationsParsersState): MarkAllInput => {
  if (filters == null) {
    return {};
  }

  return {
    repoName: filters.repo ?? undefined,
    repoOwner: filters.owner ?? undefined,
    search: filters.search || undefined,
    type: filters.type ?? undefined,
  };
};
