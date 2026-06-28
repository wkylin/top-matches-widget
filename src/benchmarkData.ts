export const benchmarkData = {
  timestamp: "2026-06-24T15:07:58.182Z",
  config: { totalMatches: 100000, liveRatio: 0.22, batchSize: 100000 },
  memory: {
    before: { heapUsedMB: "4.67", heapTotalMB: "5.88", rssMB: "46.70", externalMB: "1.87" },
    after: { heapUsedMB: "342.47", heapTotalMB: "438.48", rssMB: "503.22", externalMB: "1.84" },
  },
  sizes: {
    singleMatchBytes: 1060,
    totalJsonMB: "97.25",
    totalJsonKB: "99588.70",
    wsBatchMB: "55.84",
  },
  results: [
    { label: "Data Generation (100K matches)", avg: 191.98, min: 187.94, max: 193.36, p50: 192.93, p95: 193.36, p99: 193.36 },
    { label: "JSON.stringify (100K matches)", avg: 164.56, min: 162.04, max: 168.08, p50: 164.31, p95: 168.08, p99: 168.08 },
    { label: "JSON.parse (100K matches)", avg: 313.16, min: 294.81, max: 364.11, p50: 308.25, p95: 364.11, p99: 364.11 },
    { label: "mapItem (100K items)", avg: 10513.04, min: 7793.53, max: 14950.65, p50: 10097.45, p95: 14950.65, p99: 14950.65 },
    { label: "rowMap.get (100K lookups)", avg: 0.48, min: 0.36, max: 0.82, p50: 0.39, p95: 0.82, p99: 0.82 },
    { label: "Virtual scroll compute (slice + compute)", avg: 0.20, min: 0.10, max: 0.30, p50: 0.23, p95: 0.30, p99: 0.30 },
    { label: "Filter LIVE (100K)", avg: 5.47, min: 5.12, max: 5.94, p50: 5.42, p95: 5.94, p99: 5.94 },
    { label: "Filter PREMATCH (100K)", avg: 5.22, min: 4.44, max: 6.10, p50: 4.96, p95: 6.10, p99: 6.10 },
    { label: "WS batch JSON.stringify", avg: 213.98, min: 116.29, max: 1036.78, p50: 119.90, p95: 1036.78, p99: 1036.78 },
    { label: "WS batch JSON.parse", avg: 182.56, min: 169.60, max: 199.25, p50: 182.99, p95: 199.25, p99: 199.25 },
    { label: "patchOutcome (100K rows, 3 outcomes each)", avg: 53.44, min: 52.20, max: 54.72, p50: 53.41, p95: 54.72, p99: 54.72 },
    { label: "computed filtered(all) 100K", avg: 0.00, min: 0.00, max: 0.00, p50: 0.00, p95: 0.00, p99: 0.00 },
    { label: "computed filtered(live) 100K", avg: 4.83, min: 3.98, max: 6.19, p50: 4.88, p95: 5.26, p99: 6.19 },
    { label: "computed filtered(prematch) 100K", avg: 9.08, min: 4.00, max: 146.65, p50: 5.64, p95: 14.34, p99: 146.65 },
    { label: "columnCount calc (1000 iterations)", avg: 0.04, min: 0.02, max: 0.07, p50: 0.02, p95: 0.07, p99: 0.07 },
  ],
};

export type BenchmarkResult = typeof benchmarkData.results[number];