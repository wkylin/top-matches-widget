<template>
  <div class="report">
    <div class="report__header">
      <h1>📘 运行会话总结</h1>
      <p>基于最近一次开发运行会话生成，适合看 Ctrl+C 结束后的整体表现。</p>
    </div>

    <div v-if="loading" class="report__state">正在加载最新 session 报告...</div>
    <div v-else-if="error" class="report__state report__state--error">{{ error }}</div>

    <div v-else-if="reportData" class="report__body">
      <div class="report__note">
        <strong>统计时机：</strong>
        本报告在服务端收到 <code>Ctrl+C</code> 退出信号后落盘到 <code>public/perf-session-report.json</code>。
        会话 ID <code>{{ reportData.sessionId }}</code>，开始时间 {{ sessionStarted }}，结束时间 {{ sessionEnded }}，总时长 {{ reportData.durationSec }} 秒。
      </div>

      <div class="report__toolbar">
        <label class="report__selector">
          <span>查看会话</span>
          <select v-model="selectedReportPath" @change="onSelectSession">
            <option value="__latest__">最新报告（perf-session-report.json）</option>
            <option v-for="item in sessionIndex" :key="item.sessionId" :value="item.archiveFile">
              {{ item.sessionId }} · {{ formatSessionOption(item.startedAt, item.durationSec) }}
            </option>
          </select>
        </label>
        <div class="report__hint">
          <strong>查看方式：</strong>
          `Ctrl+C` 会同时停掉前后端开发服务，所以报告生成后需要重新启动前端（例如 `pnpm dev`）再打开这个页面查看。
        </div>
      </div>

      <div class="cards">
        <div class="card" v-for="item in summaryCards" :key="item.label">
          <div class="card__label">{{ item.label }}</div>
          <div class="card__value">{{ item.value }}</div>
          <div class="card__sub">{{ item.sub }}</div>
        </div>
      </div>

      <div class="cards cards--top">
        <div class="card card--accent" v-for="item in topFindings" :key="item.label">
          <div class="card__label">{{ item.label }}</div>
          <div class="card__value">{{ item.value }}</div>
          <div class="card__sub">{{ item.sub }}</div>
        </div>
      </div>

      <div class="panel">
        <h3>🧭 优化建议</h3>
        <div class="advice-list">
          <div class="advice" v-for="item in recommendations" :key="item.title">
            <div class="advice__title">{{ item.title }}</div>
            <div class="advice__body">{{ item.body }}</div>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <h3>前端运行趋势</h3>
          <canvas ref="frontendCanvas"></canvas>
        </div>
        <div class="panel">
          <h3>服务端 WS 批量趋势</h3>
          <canvas ref="serverCanvas"></canvas>
        </div>
        <div class="panel panel--wide">
          <h3>核心指标摘要</h3>
          <canvas ref="summaryCanvas"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  BarController,
  BarElement,
);

type MetricSummary = {
  min: number;
  max: number;
  avg: number;
  p95: number;
  count: number;
};

type FrontendPoint = {
  elapsedSec: number;
  timestamp: string;
  fps: number;
  frameTime: number;
  wsRate: number;
  wsMb: number;
  memoryMb: number;
  totalUpdates: number;
  totalMessages: number;
  connected: boolean;
};

type ServerPoint = {
  elapsedSec: number;
  timestamp: string;
  batchSize: number;
  live: number;
  prematch: number;
  payloadMb: number;
  stringifyMs: number;
  clientCount: number;
};

type PerfSessionReport = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  summary: {
    frontendSamples: number;
    serverBatches: number;
    totalServerPushedUpdates: number;
    totalServerPayloadMb: number;
    peakMemoryMb: number;
    peakFps: number;
    peakWsMb: number;
  };
  metrics: {
    frontend: {
      fps: MetricSummary;
      frameTime: MetricSummary;
      wsRate: MetricSummary;
      wsMb: MetricSummary;
      memoryMb: MetricSummary;
    };
    server: {
      batchSize: MetricSummary;
      payloadMb: MetricSummary;
      stringifyMs: MetricSummary;
      clientCount: MetricSummary;
    };
  };
  timeline: {
    frontend: FrontendPoint[];
    server: ServerPoint[];
  };
};

type PerfSessionIndexItem = {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  archiveFile: string;
};

const reportData = ref<PerfSessionReport | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const sessionIndex = ref<PerfSessionIndexItem[]>([]);
const selectedReportPath = ref("__latest__");
const frontendCanvas = ref<HTMLCanvasElement | null>(null);
const serverCanvas = ref<HTMLCanvasElement | null>(null);
const summaryCanvas = ref<HTMLCanvasElement | null>(null);
const charts = new Map<string, Chart>();

const sessionStarted = computed(() => reportData.value ? new Date(reportData.value.startedAt).toLocaleString("zh-CN") : "--");
const sessionEnded = computed(() => reportData.value ? new Date(reportData.value.endedAt).toLocaleString("zh-CN") : "--");

const summaryCards = computed(() => {
  if (!reportData.value) return [];
  return [
    { label: "运行时长", value: `${reportData.value.durationSec}s`, sub: "本次 session 总时长" },
    { label: "前端样本数", value: String(reportData.value.summary.frontendSamples), sub: "每秒上报聚合" },
    { label: "服务端批次", value: String(reportData.value.summary.serverBatches), sub: "WS 批量推送次数" },
    { label: "总推送更新", value: String(reportData.value.summary.totalServerPushedUpdates), sub: "服务端累计推送" },
    { label: "总推送体积", value: `${reportData.value.summary.totalServerPayloadMb.toFixed(2)} MB`, sub: "累计 WS 负载" },
    { label: "峰值内存", value: `${reportData.value.summary.peakMemoryMb.toFixed(1)} MB`, sub: "前端监控采样峰值" },
  ];
});

const topFindings = computed(() => {
  if (!reportData.value) return [];
  return [
    {
      label: "前端 FPS 峰值",
      value: `${reportData.value.summary.peakFps.toFixed(0)} fps`,
      sub: `平均 ${reportData.value.metrics.frontend.fps.avg.toFixed(1)} fps`,
    },
    {
      label: "前端 WS 吞吐峰值",
      value: `${reportData.value.summary.peakWsMb.toFixed(2)} MB/s`,
      sub: `平均 ${reportData.value.metrics.frontend.wsMb.avg.toFixed(2)} MB/s`,
    },
    {
      label: "服务端 stringify P95",
      value: `${reportData.value.metrics.server.stringifyMs.p95.toFixed(1)} ms`,
      sub: `平均 ${reportData.value.metrics.server.stringifyMs.avg.toFixed(1)} ms`,
    },
  ];
});

const recommendations = computed(() => {
  if (!reportData.value) return [];
  const items: Array<{ title: string; body: string }> = [];
  const frontend = reportData.value.metrics.frontend;
  const server = reportData.value.metrics.server;

  if (server.stringifyMs.p95 > 200) {
    items.push({
      title: "优先缩小 WS 单包体积",
      body: `本次服务端 WS 序列化 P95 为 ${server.stringifyMs.p95.toFixed(1)}ms，说明 100K x 3 outcomes 的单包仍然偏大。建议优先评估分片推送、字段瘦身或二进制压缩。`,
    });
  }

  if (frontend.wsMb.max > 20 || frontend.frameTime.p95 > 20) {
    items.push({
      title: "重点观察前端大包解析与主线程占用",
      body: `本次前端 WS 吞吐峰值 ${reportData.value.summary.peakWsMb.toFixed(2)} MB/s，帧耗时 P95 ${frontend.frameTime.p95.toFixed(1)}ms。建议继续拆分 WS 批量消息，或减少单次 patch 的行数。`,
    });
  }

  if (frontend.memoryMb.max > 250) {
    items.push({
      title: "关注会话期间内存峰值",
      body: `本次前端内存峰值达到 ${frontend.memoryMb.max.toFixed(1)} MB。建议继续减少长生命周期对象、避免保留过多中间结构，并确认离开监控页后是否能及时释放。`,
    });
  }

  if (frontend.fps.avg < 50) {
    items.push({
      title: "渲染稳定性还有优化空间",
      body: `本次平均 FPS 为 ${frontend.fps.avg.toFixed(1)}。如果这不是预期水平，建议继续检查过滤计算频率、图表重绘时机以及大批量更新时的 UI 刷新节奏。`,
    });
  }

  if (items.length === 0) {
    items.push({
      title: "当前会话整体表现稳定",
      body: "本次 session 中前端渲染、内存和服务端批量推送都处在相对可控区间。下一步更适合做更大规模或更极端网络条件下的压力测试。",
    });
  }

  return items;
});

function destroyCharts() {
  for (const chart of charts.values()) chart.destroy();
  charts.clear();
}

function setChart(key: string, chart: Chart) {
  charts.get(key)?.destroy();
  charts.set(key, chart);
}

function formatSessionOption(startedAt: string, durationSec: number) {
  return `${new Date(startedAt).toLocaleString("zh-CN")} · ${durationSec}s`;
}

async function loadIndex() {
  try {
    const res = await fetch(`/perf-sessions/index.json?ts=${Date.now()}`);
    if (!res.ok) {
      sessionIndex.value = [];
      return;
    }
    sessionIndex.value = await res.json() as PerfSessionIndexItem[];
  } catch {
    sessionIndex.value = [];
  }
}

async function loadReport(reportPath = "__latest__", silent = false) {
  if (!silent) {
    loading.value = true;
    error.value = null;
  }
  try {
    const target = reportPath === "__latest__" ? "/perf-session-report.json" : reportPath;
    const res = await fetch(`${target}?ts=${Date.now()}`);
    if (!res.ok) throw new Error("当前还没有生成运行会话报告，请先启动监控并在结束服务后再查看。");
    reportData.value = (await res.json()) as PerfSessionReport;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "加载运行会话报告失败";
  } finally {
    if (!silent) loading.value = false;
  }
}

async function onSelectSession() {
  await loadReport(selectedReportPath.value);
}

function renderCharts() {
  if (!reportData.value) return;
  destroyCharts();

  if (frontendCanvas.value) {
    setChart("frontend", new Chart(frontendCanvas.value, {
      type: "line",
      data: {
        labels: reportData.value.timeline.frontend.map((item) => `${item.elapsedSec}s`),
        datasets: [
          {
            label: "FPS",
            data: reportData.value.timeline.frontend.map((item) => item.fps),
            borderColor: "#22c55e",
            backgroundColor: "rgba(34,197,94,0.12)",
            yAxisID: "y",
            tension: 0.25,
            pointRadius: 0,
          },
          {
            label: "Memory MB",
            data: reportData.value.timeline.frontend.map((item) => item.memoryMb),
            borderColor: "#ef4444",
            backgroundColor: "rgba(239,68,68,0.12)",
            yAxisID: "y1",
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { position: "left", title: { display: true, text: "FPS" } },
          y1: { position: "right", title: { display: true, text: "MB" }, grid: { drawOnChartArea: false } },
        },
      },
    }));
  }

  if (serverCanvas.value) {
    setChart("server", new Chart(serverCanvas.value, {
      type: "line",
      data: {
        labels: reportData.value.timeline.server.map((item) => `${item.elapsedSec}s`),
        datasets: [
          {
            label: "Batch Size",
            data: reportData.value.timeline.server.map((item) => item.batchSize),
            borderColor: "#6366f1",
            backgroundColor: "rgba(99,102,241,0.12)",
            yAxisID: "y",
            tension: 0.25,
            pointRadius: 0,
          },
          {
            label: "Payload MB",
            data: reportData.value.timeline.server.map((item) => item.payloadMb),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245,158,11,0.12)",
            yAxisID: "y1",
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { position: "left", title: { display: true, text: "Rows" } },
          y1: { position: "right", title: { display: true, text: "MB" }, grid: { drawOnChartArea: false } },
        },
      },
    }));
  }

  if (summaryCanvas.value) {
    setChart("summary", new Chart(summaryCanvas.value, {
      type: "bar",
      data: {
        labels: [
          ["前端 FPS", "Frontend FPS"],
          ["前端帧耗时", "Frame Time"],
          ["前端 WS 解析", "WS MB/s"],
          ["服务端批量", "Batch Size"],
          ["服务端序列化", "Stringify ms"],
        ],
        datasets: [
          {
            label: "Avg",
            data: [
              reportData.value.metrics.frontend.fps.avg,
              reportData.value.metrics.frontend.frameTime.avg,
              reportData.value.metrics.frontend.wsMb.avg,
              reportData.value.metrics.server.batchSize.avg,
              reportData.value.metrics.server.stringifyMs.avg,
            ],
            backgroundColor: ["#22c55e", "#818cf8", "#f97316", "#6366f1", "#ef4444"],
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    }));
  }
}

watch(reportData, async (next) => {
  if (!next) return;
  await nextTick();
  renderCharts();
});

onMounted(() => {
  void (async () => {
    await loadIndex();
    await loadReport();
  })();
});

onBeforeUnmount(() => {
  destroyCharts();
});
</script>

<style scoped>
.report {
  min-height: 100vh;
  background: #f8fafc;
  color: #0f172a;
}

.report__header {
  padding: 28px 24px 20px;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: #fff;
}

.report__header h1 {
  font-size: 24px;
  margin: 0 0 6px;
}

.report__header p {
  margin: 0;
  color: #cbd5e1;
  font-size: 13px;
}

.report__state {
  max-width: 1320px;
  margin: 24px auto;
  padding: 24px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  color: #475569;
}

.report__state--error {
  background: #fff1f2;
  color: #be123c;
}

.report__body {
  max-width: 1320px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}

.report__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.report__selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 320px;
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}

.report__selector select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
  font-size: 12px;
}

.report__hint {
  max-width: 620px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
  line-height: 1.7;
}

.report__note {
  margin-bottom: 18px;
  padding: 16px 18px;
  border-radius: 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 13px;
  line-height: 1.7;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.cards--top .card {
  background: linear-gradient(160deg, #fff7ed, #ffffff);
  border-color: #fed7aa;
}

.advice-list {
  display: grid;
  gap: 12px;
}

.advice {
  padding: 14px 16px;
  border-radius: 14px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.advice__title {
  font-size: 14px;
  font-weight: 800;
  color: #9a3412;
}

.advice__body {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #7c2d12;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 18px;
}

.card--accent .card__value {
  color: #c2410c;
}

.card__label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card__value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
}

.card__sub {
  margin-top: 6px;
  font-size: 12px;
  color: #94a3b8;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 18px;
  min-height: 320px;
}

.panel--wide {
  grid-column: span 2;
}

.panel h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #334155;
}

.panel canvas {
  height: 260px !important;
}

code {
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .panel--wide {
    grid-column: span 1;
  }
}
</style>
