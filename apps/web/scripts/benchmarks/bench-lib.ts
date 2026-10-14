export type BenchStats = {
  max: number;
  median: number;
  min: number;
  n: number;
  p95: number;
  p99: number;
};

export function benchStats(samples: number[]): BenchStats {
  if (samples.length === 0) {
    return { max: 0, median: 0, min: 0, n: 0, p95: 0, p99: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
  const r = (n: number) => Number(n.toFixed(2));
  return {
    max: r(sorted.at(-1) ?? 0),
    median: r(at(50)),
    min: r(sorted[0] ?? 0),
    n: sorted.length,
    p95: r(at(95)),
    p99: r(at(99)),
  };
}
