import * as p from "@clack/prompts";

import { brand } from "./colors";

export type OutputJsonOptions = {
  json?: boolean;
};

export type OutputFailOptions = {
  code?: string;
  json?: boolean;
};

export const output = {
  // The single failure exit path: `p.outro` alone leaves the process at 0, so scripts
  // cannot branch on it.
  fail(message: string, options: OutputFailOptions = {}): void {
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          { code: options.code ?? "ERROR", error: message, success: false },
          null,
          2,
        )}\n`,
      );
    } else {
      p.outro(brand.error(message));
    }

    process.exitCode = 1;
  },
  json(data: unknown, isJson?: boolean): boolean {
    if (isJson) {
      process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      return true;
    }
    return false;
  },

  stderr(text: string): void {
    process.stderr.write(`${text}\n`);
  },

  write(text: string): void {
    process.stdout.write(`${text}\n`);
  },
};
