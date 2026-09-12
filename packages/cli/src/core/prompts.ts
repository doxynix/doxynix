import * as p from "@clack/prompts";

import { brand } from "@/ui/colors";

export class PromptCancelledError extends Error {
  constructor(message = "Operation cancelled.") {
    super(message);
    this.name = "PromptCancelledError";
  }
}

export async function guardPrompt<T>(
  promptPromise: Promise<T | symbol>,
  cancelMessage = "Operation cancelled.",
): Promise<T> {
  const result = await promptPromise;
  if (p.isCancel(result)) {
    p.cancel(cancelMessage);
    throw new PromptCancelledError(cancelMessage);
  }
  return result as T;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResolveEntityOptions<T extends { id: string }> = {
  idArg?: string;
  selectMessage: string;
  emptyMessage?: string;
  notFoundMessage?: (target: string) => string;
  cancelMessage?: string;
  fetchItems: () => Promise<T[]>;
  getLabel: (item: T) => string;
  matcher?: (item: T, query: string) => boolean;
};

export async function resolveEntityOrPick<T extends { id: string }>(
  options: ResolveEntityOptions<T>,
): Promise<string | null> {
  const target = options.idArg?.trim();

  if (target && UUID_REGEX.test(target)) {
    return target;
  }

  const items = await options.fetchItems();
  if (items.length === 0) {
    p.outro(brand.muted(options.emptyMessage ?? "No items found."));
    return null;
  }

  if (target) {
    const prefix = target.toLowerCase();
    const match = items.find((item) =>
      options.matcher ? options.matcher(item, prefix) : item.id.toLowerCase().startsWith(prefix),
    );

    if (!match) {
      const msg = options.notFoundMessage
        ? options.notFoundMessage(target)
        : `No item found matching prefix: '${target}'`;
      p.outro(brand.error(msg));
      return null;
    }

    return match.id;
  }

  const selection = await guardPrompt(
    p.select({
      message: options.selectMessage,
      options: items.map((item) => ({
        label: options.getLabel(item),
        value: item.id,
      })),
    }),
    options.cancelMessage ?? "Operation cancelled.",
  );

  return selection;
}

export type ConfirmOrAbortOptions = {
  active?: string;
  cancelMessage?: string;
  danger?: boolean;
  force?: boolean;
  inactive?: string;
  initialValue?: boolean;
  message: string;
};

export async function confirmOrAbort(options: string | ConfirmOrAbortOptions): Promise<boolean> {
  const opts: ConfirmOrAbortOptions = typeof options === "string" ? { message: options } : options;

  const isAutoConfirmed =
    opts.force === true ||
    process.argv.includes("--force") ||
    (!opts.danger &&
      (process.argv.includes("--yes") || process.argv.includes("-y") || process.env.CI === "true"));

  if (isAutoConfirmed) {
    return true;
  }

  const confirmed = await p.confirm({
    active: opts.active,
    inactive: opts.inactive,
    initialValue: opts.initialValue ?? false,
    message: opts.danger ? brand.error(opts.message) : opts.message,
  });

  if (!confirmed || p.isCancel(confirmed)) {
    p.outro(brand.muted(opts.cancelMessage ?? "Action cancelled."));
    return false;
  }

  return true;
}
