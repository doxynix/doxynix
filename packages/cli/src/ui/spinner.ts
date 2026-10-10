import ora, { type Ora } from "ora";

import { icons } from "./icons";

export type TaskSpinnerOptions = {
  silent?: boolean;
  start: string;
  stop?: string;
};

function create(start: string, silent: boolean): Ora {
  return ora({
    color: "white",
    discardStdin: false,
    isSilent: silent,
    stream: process.stderr,
    text: start,
  });
}

export function createSpinner(start: string): Ora {
  return create(start, false);
}

export async function withTaskSpinner<T>(
  options: string | TaskSpinnerOptions,
  task: (updateMessage: (msg: string) => void) => Promise<T>,
): Promise<T> {
  const resolved: TaskSpinnerOptions = typeof options === "string" ? { start: options } : options;
  const startMsg = resolved.start;
  const stopMsg = resolved.stop;
  const isSilent = Boolean(resolved.silent);

  if (isSilent) {
    return task(() => {});
  }

  const s = create(startMsg, false);

  s.start();

  try {
    const result = await task((msg: string) => {
      s.text = msg;
    });
    s.stopAndPersist({ symbol: icons.check, text: stopMsg ?? startMsg });
    return result;
  } catch (error) {
    s.stopAndPersist({ symbol: icons.cross, text: startMsg });
    throw error;
  }
}
