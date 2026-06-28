import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface FrontendPerfSampleInput {
  timestamp?: string;
  elapsedSec: number;
  fps: number;
  frameTime: number;
  wsRate: number;
  wsMb: number;
  memoryMb: number;
  totalUpdates: number;
  totalMessages: number;
  wsState: string;
  connected: boolean;
}

export interface ServerBatchPerfSampleInput {
  timestamp?: string;
  elapsedSec: number;
  batchSize: number;
  live: number;
  prematch: number;
  payloadBytes: number;
  stringifyMs: number;
  clientCount: number;
}

type TimelinePoint = {
  elapsedSec: number;
  timestamp: string;
  [key: string]: number | string | boolean;
};

type MetricSummary = {
  min: number;
  max: number;
  avg: number;
  p95: number;
  count: number;
};

type MetricSeries = {
  fps: number[];
  frameTime: number[];
  wsRate: number[];
  wsMb: number[];
  memoryMb: number[];
  batchSize: number[];
  payloadMb: number[];
  stringifyMs: number[];
  clientCount: number[];
};

function computeSummary(values: number[]): MetricSummary {
  if (!values.length) {
    return { min: 0, max: 0, avg: 0, p95: 0, count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / values.length,
    p95: sorted[p95Index],
    count: values.length,
  };
}

export class PerfSessionStore {
  private readonly startedAt = new Date();
  private readonly sessionId: string;
  private readonly frontendTimeline: TimelinePoint[] = [];
  private readonly serverTimeline: TimelinePoint[] = [];
  private readonly metrics: MetricSeries = {
    fps: [],
    frameTime: [],
    wsRate: [],
    wsMb: [],
    memoryMb: [],
    batchSize: [],
    payloadMb: [],
    stringifyMs: [],
    clientCount: [],
  };
  private lastFrontendState: FrontendPerfSampleInput | null = null;
  private totalServerPushedUpdates = 0;
  private totalServerPayloadBytes = 0;

  constructor() {
    const stamp = this.startedAt.toISOString().replace(/[:.]/g, "-");
    const suffix = Math.random().toString(36).slice(2, 8);
    this.sessionId = `session-${stamp}-${suffix}`;
  }

  recordFrontendSample(sample: FrontendPerfSampleInput): void {
    const timestamp = sample.timestamp ?? new Date().toISOString();
    this.lastFrontendState = sample;
    this.metrics.fps.push(sample.fps);
    this.metrics.frameTime.push(sample.frameTime);
    this.metrics.wsRate.push(sample.wsRate);
    this.metrics.wsMb.push(sample.wsMb);
    this.metrics.memoryMb.push(sample.memoryMb);
    this.frontendTimeline.push({
      elapsedSec: sample.elapsedSec,
      timestamp,
      fps: sample.fps,
      frameTime: sample.frameTime,
      wsRate: sample.wsRate,
      wsMb: sample.wsMb,
      memoryMb: sample.memoryMb,
      totalUpdates: sample.totalUpdates,
      totalMessages: sample.totalMessages,
      connected: sample.connected,
    });
  }

  recordServerBatch(sample: ServerBatchPerfSampleInput): void {
    const timestamp = sample.timestamp ?? new Date().toISOString();
    const payloadMb = sample.payloadBytes / 1024 / 1024;
    this.totalServerPushedUpdates += sample.batchSize;
    this.totalServerPayloadBytes += sample.payloadBytes;
    this.metrics.batchSize.push(sample.batchSize);
    this.metrics.payloadMb.push(payloadMb);
    this.metrics.stringifyMs.push(sample.stringifyMs);
    this.metrics.clientCount.push(sample.clientCount);
    this.serverTimeline.push({
      elapsedSec: sample.elapsedSec,
      timestamp,
      batchSize: sample.batchSize,
      live: sample.live,
      prematch: sample.prematch,
      payloadMb: +payloadMb.toFixed(2),
      stringifyMs: +sample.stringifyMs.toFixed(2),
      clientCount: sample.clientCount,
    });
  }

  buildReport() {
    const endedAt = new Date();
    const durationSec = Math.max(0, Math.round((endedAt.getTime() - this.startedAt.getTime()) / 1000));
    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSec,
      summary: {
        frontendSamples: this.frontendTimeline.length,
        serverBatches: this.serverTimeline.length,
        totalServerPushedUpdates: this.totalServerPushedUpdates,
        totalServerPayloadMb: +(this.totalServerPayloadBytes / 1024 / 1024).toFixed(2),
        peakMemoryMb: computeSummary(this.metrics.memoryMb).max,
        peakFps: computeSummary(this.metrics.fps).max,
        peakWsMb: computeSummary(this.metrics.wsMb).max,
        latestFrontendState: this.lastFrontendState,
      },
      metrics: {
        frontend: {
          fps: computeSummary(this.metrics.fps),
          frameTime: computeSummary(this.metrics.frameTime),
          wsRate: computeSummary(this.metrics.wsRate),
          wsMb: computeSummary(this.metrics.wsMb),
          memoryMb: computeSummary(this.metrics.memoryMb),
        },
        server: {
          batchSize: computeSummary(this.metrics.batchSize),
          payloadMb: computeSummary(this.metrics.payloadMb),
          stringifyMs: computeSummary(this.metrics.stringifyMs),
          clientCount: computeSummary(this.metrics.clientCount),
        },
      },
      timeline: {
        frontend: this.frontendTimeline,
        server: this.serverTimeline,
      },
    };
  }

  saveReport(): { latestPath: string; archivePath: string; indexPath: string } {
    const report = this.buildReport();
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const outDir = join(__dirname, "..", "public");
    const archiveDir = join(outDir, "perf-sessions");
    const latestFile = join(outDir, "perf-session-report.json");
    const archiveFile = join(archiveDir, `${this.sessionId}.json`);
    const indexFile = join(archiveDir, "index.json");
    mkdirSync(outDir, { recursive: true });
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(latestFile, JSON.stringify(report, null, 2));
    writeFileSync(archiveFile, JSON.stringify(report, null, 2));

    const index = existsSync(indexFile)
      ? JSON.parse(readFileSync(indexFile, "utf8")) as Array<{ sessionId: string; startedAt: string; endedAt: string; durationSec: number; archiveFile: string; }>
      : [];
    index.unshift({
      sessionId: this.sessionId,
      startedAt: report.startedAt,
      endedAt: report.endedAt,
      durationSec: report.durationSec,
      archiveFile: `/perf-sessions/${this.sessionId}.json`,
    });
    writeFileSync(indexFile, JSON.stringify(index.slice(0, 50), null, 2));

    return {
      latestPath: latestFile,
      archivePath: archiveFile,
      indexPath: indexFile,
    };
  }
}
