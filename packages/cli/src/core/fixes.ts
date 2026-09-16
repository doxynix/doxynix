import { type RouterOutput, trpc } from "./client";

export type FixItem = RouterOutput["analysis"]["getByRepository"][number];

export async function fetchFixes(repoId: string): Promise<FixItem[]> {
  return trpc.analysis.getByRepository.query({ repoId });
}
