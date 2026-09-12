export type OutputJsonOptions = {
  json?: boolean;
};

export const output = {
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
