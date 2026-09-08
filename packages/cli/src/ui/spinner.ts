import * as p from "@clack/prompts";

export type TaskSpinnerOptions = {
  silent?: boolean;
  start: string;
  stop?: string;
};

export async function withTaskSpinner<T>(
  options: string | TaskSpinnerOptions,
  task: (updateMessage: (msg: string) => void) => Promise<T>,
): Promise<T> {
  const optionsIsString = typeof options === "string";

  const startMsg = optionsIsString ? options : options.start;
  const stopMsg = optionsIsString ? undefined : options.stop;
  const isSilent = optionsIsString ? false : Boolean(options.silent);

  if (isSilent) {
    return task(() => {});
  }

  const s = p.spinner();
  s.start(startMsg);

  try {
    const result = await task((msg: string) => s.message(msg));
    s.stop(stopMsg ?? "Done");
    return result;
  } catch (error) {
    s.stop();
    throw error;
  }
}
