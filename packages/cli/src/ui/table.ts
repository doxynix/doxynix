import Table from "cli-table3";

import { pc } from "./colors";

export function createTable(head: string[]): Table.Table {
  return new Table({
    head: head.map((h) => pc.cyan(pc.bold(h))),
    style: {
      border: ["gray"],
      head: [],
    },
  });
}
