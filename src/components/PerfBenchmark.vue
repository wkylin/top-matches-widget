<template>
  <div class="pbench">
    <div class="pbench__header">
      <h1>⚽ Top Matches — 100,000 条数据性能分析</h1>
      <p>数据生成 · 序列化传输 · JSON 解析 · 虚拟滚动 · WebSocket 实时推送</p>
    </div>

    <div v-if="loading" class="pbench__state">正在加载最新 benchmark 快照...</div>
    <div v-else-if="error" class="pbench__state pbench__state--error">{{ error }}</div>

    <div v-else-if="benchmark" class="pbench__body">
      <div class="insight insight--red">
        <span class="insight__icon">⚠️</span>
        <div>
          <h4>当前主要压力在大体积数据传输与批量消息处理</h4>
          <p>
            当前链路里最需要关注的是 <code>100K</code> 赛事数据的响应体积、
            <code>JSON.stringify</code> / <code>JSON.parse</code>，以及
            <code>100K x 3 outcomes</code> 批量 WebSocket 消息带来的解析和更新压力。
            页面展示的数据来自最近一次 benchmark 结果文件，而不是写死在前端代码里的静态快照。
          </p>
        </div>
      </div>

      <div class="insight">
        <span class="insight__icon">💡</span>
        <div>
          <h4>前端渲染侧已经比较轻，热点主要不在可视区计算</h4>
          <p>
            虚拟滚动切片、列数计算和 <code>rowMap</code> 查找都很轻量；
            真正需要持续盯住的是批量 <code>WS parse</code>、<code>patchOutcome</code> 和整体内存增长。
          </p>
        </div>
      </div>

      <div class="stat-note">
        <div class="stat-note__title">统计时机</div>
        <div class="stat-note__text">
          当前页面展示的是一次离线压测快照，不是实时统计。数据由 <code>scripts/benchmark.mjs</code>
          执行后写入 <code>public/benchmark-results.json</code>，本次快照生成时间为
          <strong>{{ benchmarkTime }}</strong>。
        </div>
        <div class="stat-note__text">
          `数据传输体积` 来自压测时计算出的 JSON / WS 包大小；`内存占用` 来自 100K 数据生成前后
          `process.memoryUsage()` 的对比；`各环节耗时占比` 按这次压测里各操作的平均耗时占比计算。
        </div>
      </div>

      <div class="sum-cards">
        <div class="sum-card" v-for="c in summaryCards" :key="c.label" :class="`sum-card--${c.style}`">
          <div class="sum-card__label">{{ c.label }}</div>
          <div class="sum-card__value">{{ c.value }}</div>
          <div class="sum-card__sub">{{ c.sub }}</div>
        </div>
      </div>

      <div class="bottlenecks">
        <div class="bottleneck" v-for="item in topBottlenecks" :key="item.label">
          <div class="bottleneck__rank">TOP {{ item.rank }}</div>
          <div class="bottleneck__title">{{ item.meta.title }}</div>
          <div class="bottleneck__sub">{{ item.meta.subtitle }}</div>
          <div class="bottleneck__meta">{{ item.meta.group }} · {{ fmtMs(item.avg) }}</div>
          <div class="bottleneck__desc">{{ item.meta.desc }}</div>
        </div>
      </div>

      <div class="panel">
        <h3>🔗 数据流水线耗时对比</h3>
        <div class="pipeline">
          <div class="pipeline__step" v-for="step in pipelineSteps" :key="step.name">
            <div
              class="pipeline__bar"
              :style="{ height: `${barHeight(step.value)}px`, background: step.color }"
              :title="`${step.name}: ${fmtMs(step.value)}`"
            ></div>
            <span class="pipeline__value">{{ fmtMs(step.value) }}</span>
            <span class="pipeline__label" v-html="step.label"></span>
          </div>
        </div>
      </div>

      <div class="charts">
        <div class="panel">
          <h3>📊 各环节平均耗时 — 对数刻度</h3>
          <canvas ref="barCanvas"></canvas>
        </div>
        <div class="panel">
          <h3>🔥 耗时对比 (avg / p95 / max)</h3>
          <canvas ref="heatCanvas"></canvas>
        </div>
        <div class="panel">
          <h3>📦 数据传输体积</h3>
          <canvas ref="sizesCanvas"></canvas>
          <p class="chart-note">统计口径：单场 JSON、100K HTTP 响应、100K x 3 outcomes 的 WS 批量消息，以及折算后的单场平均体积。</p>
        </div>
        <div class="panel">
          <h3>🧠 内存占用</h3>
          <canvas ref="memCanvas"></canvas>
          <p class="chart-note">统计口径：压测脚本在生成 100K 数据前后读取 `process.memoryUsage()`，展示 Heap Used、Heap Total、RSS 和 External 的变化。</p>
        </div>
        <div class="panel panel--wide">
          <h3>📈 各环节耗时占比</h3>
          <canvas ref="pieCanvas"></canvas>
          <p class="chart-note">统计口径：按本次压测各操作的平均耗时 `avg` 计算占比，仅展示当前链路仍在使用的阶段。</p>
        </div>
      </div>

      <div class="panel">
        <h3>📋 完整性能数据明细</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>操作</th>
                <th>中文说明</th>
                <th>Avg (ms)</th>
                <th>Min</th>
                <th>Max</th>
                <th>P95</th>
                <th>评级</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="group in groupedResults" :key="group.name">
                <tr class="group-row">
                  <td colspan="7">{{ group.name }}</td>
                </tr>
                <tr v-for="item in group.items" :key="item.label">
                  <td>
                    <div class="op-cell">
                      <div class="op-cell__title">{{ metaForLabel(item.label).title }}</div>
                      <div class="op-cell__sub">{{ metaForLabel(item.label).subtitle }}</div>
                    </div>
                  </td>
                  <td>{{ metaForLabel(item.label).desc }}</td>
                  <td><span class="heat" :class="heatClass(item.avg)">{{ item.avg.toFixed(2) }}</span></td>
                  <td>{{ item.min.toFixed(2) }}</td>
                  <td>{{ item.max.toFixed(2) }}</td>
                  <td>{{ item.p95.toFixed(2) }}</td>
                  <td>{{ ratingText(item.avg) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3>📌 当前系统结论</h3>
        <div class="report-grid">
          <div class="report-card">
            <div class="report-card__title">第一瓶颈</div>
            <div class="report-card__value">{{ topBottlenecks[0]?.meta.title }}</div>
            <div class="report-card__sub">{{ topBottlenecks[0]?.meta.subtitle }}</div>
          </div>
          <div class="report-card">
            <div class="report-card__title">第二瓶颈</div>
            <div class="report-card__value">{{ topBottlenecks[1]?.meta.title }}</div>
            <div class="report-card__sub">{{ topBottlenecks[1]?.meta.subtitle }}</div>
          </div>
          <div class="report-card">
            <div class="report-card__title">第三瓶颈</div>
            <div class="report-card__value">{{ topBottlenecks[2]?.meta.title }}</div>
            <div class="report-card__sub">{{ topBottlenecks[2]?.meta.subtitle }}</div>
          </div>
        </div>
      </div>

      <div class="pbench__footer">
        Benchmark run at {{ benchmarkTime }} · Chart.js
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LogarithmicScale,
  Tooltip,
} from "chart.js";

Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  Tooltip,
  Legend,
);

type BenchmarkResult = {
  label: string;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
};

type BenchmarkData = {
  timestamp: string;
  config: { totalMatches: number; liveRatio: number; batchSize: number };
  memory: {
    before: { heapUsedMB: string; heapTotalMB: string; rssMB: string; externalMB: string };
    after: { heapUsedMB: string; heapTotalMB: string; rssMB: string; externalMB: string };
  };
  sizes: {
    singleMatchBytes: number;
    totalJsonMB: string;
    totalJsonKB: string;
    wsBatchMB: string;
  };
  results: BenchmarkResult[];
};

type OperationGroup = "服务端" | "网络" | "浏览器" | "渲染";

type OperationMeta = {
  title: string;
  subtitle: string;
  desc: string;
  group: OperationGroup;
};

const barCanvas = ref<HTMLCanvasElement | null>(null);
const heatCanvas = ref<HTMLCanvasElement | null>(null);
const sizesCanvas = ref<HTMLCanvasElement | null>(null);
const memCanvas = ref<HTMLCanvasElement | null>(null);
const pieCanvas = ref<HTMLCanvasElement | null>(null);

const benchmark = ref<BenchmarkData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const charts = new Map<string, Chart>();
const groupOrder: OperationGroup[] = ["服务端", "网络", "浏览器", "渲染"];

const operationMeta: Record<string, OperationMeta> = {
  "Data Generation (100K matches)": {
    title: "赛事数据生成",
    subtitle: "Data Generation (100K matches)",
    desc: "服务端一次性生成 100000 条赛事数据的耗时",
    group: "服务端",
  },
  "JSON.stringify (100K matches)": {
    title: "HTTP 响应序列化",
    subtitle: "JSON.stringify (100K matches)",
    desc: "服务端把 100000 条赛事对象序列化成 HTTP JSON 文本的耗时",
    group: "服务端",
  },
  "JSON.parse (100K matches)": {
    title: "HTTP 响应解析",
    subtitle: "JSON.parse (100K matches)",
    desc: "浏览器或客户端把整包 HTTP JSON 文本解析回对象的耗时",
    group: "浏览器",
  },
  "rowMap.get (100K lookups)": {
    title: "行索引查找",
    subtitle: "rowMap.get (100K lookups)",
    desc: "前端用 eventId 从 rowMap 中查找 100000 次的耗时",
    group: "渲染",
  },
  "Virtual scroll compute (slice + compute)": {
    title: "虚拟滚动切片",
    subtitle: "Virtual scroll compute (slice + compute)",
    desc: "虚拟滚动切片、可视区索引和布局计算的耗时",
    group: "渲染",
  },
  "Filter LIVE (100K)": {
    title: "Live 列表筛选",
    subtitle: "Filter LIVE (100K)",
    desc: "在 100000 条赛事里筛选 live 数据的耗时",
    group: "渲染",
  },
  "Filter PREMATCH (100K)": {
    title: "Prematch 列表筛选",
    subtitle: "Filter PREMATCH (100K)",
    desc: "在 100000 条赛事里筛选 prematch 数据的耗时",
    group: "渲染",
  },
  "WS batch JSON.stringify": {
    title: "WS 批量消息序列化",
    subtitle: "WS batch JSON.stringify",
    desc: "服务端把 WS 批量赔率变更序列化成消息文本的耗时",
    group: "服务端",
  },
  "WS batch JSON.parse": {
    title: "WS 批量消息解析",
    subtitle: "WS batch JSON.parse",
    desc: "前端解析一整包 WS 批量赔率消息的耗时",
    group: "浏览器",
  },
  "patchOutcome (100K rows, 3 outcomes each)": {
    title: "赔率批量打补丁",
    subtitle: "patchOutcome (100K rows, 3 outcomes each)",
    desc: "前端把 100000 行、每行 3 个 outcome 的变更打到现有数据上的耗时",
    group: "渲染",
  },
  "computed filtered(all) 100K": {
    title: "全部赛事视图计算",
    subtitle: "computed filtered(all) 100K",
    desc: "前端计算全部赛事视图的 computed 耗时",
    group: "渲染",
  },
  "computed filtered(live) 100K": {
    title: "Live 视图计算",
    subtitle: "computed filtered(live) 100K",
    desc: "前端计算 live 赛事视图的 computed 耗时",
    group: "渲染",
  },
  "computed filtered(prematch) 100K": {
    title: "Prematch 视图计算",
    subtitle: "computed filtered(prematch) 100K",
    desc: "前端计算 prematch 赛事视图的 computed 耗时",
    group: "渲染",
  },
  "columnCount calc (1000 iterations)": {
    title: "列数计算",
    subtitle: "columnCount calc (1000 iterations)",
    desc: "响应式布局里列数计算循环 1000 次的耗时",
    group: "渲染",
  },
};

function metaForLabel(label: string): OperationMeta {
  return operationMeta[label] ?? {
    title: label,
    subtitle: label,
    desc: "当前压测项",
    group: "渲染",
  };
}

function chartLabel(label: string): string[] {
  const meta = metaForLabel(label);
  return [meta.title, meta.subtitle];
}

const results = computed(() => benchmark.value?.results ?? []);
const rMap = computed(() => Object.fromEntries(results.value.map((item) => [item.label, item])));
const currentResults = computed(() => results.value.filter((item) => item.label !== "mapItem (100K items)"));
const benchmarkTime = computed(() => benchmark.value ? new Date(benchmark.value.timestamp).toLocaleString("zh-CN") : "--");
const totalJsonSize = computed(() => Number.parseFloat(benchmark.value?.sizes.totalJsonMB ?? "0"));
const wsBatchSize = computed(() => Number.parseFloat(benchmark.value?.sizes.wsBatchMB ?? "0"));
const memoryGrowth = computed(() => {
  if (!benchmark.value) return 0;
  return Number.parseFloat(benchmark.value.memory.after.heapUsedMB) - Number.parseFloat(benchmark.value.memory.before.heapUsedMB);
});
const wsStringifyAvg = computed(() => rMap.value["WS batch JSON.stringify"]?.avg ?? 0);
const wsParseAvg = computed(() => rMap.value["WS batch JSON.parse"]?.avg ?? 0);
const patchAvg = computed(() => rMap.value["patchOutcome (100K rows, 3 outcomes each)"]?.avg ?? 0);

const summaryCards = computed(() => [
  { label: "JSON 响应体积", value: `${totalJsonSize.value.toFixed(1)} MB`, sub: "~1020 bytes/match", style: "danger" },
  { label: "WS 批量体积", value: `${wsBatchSize.value.toFixed(2)} MB`, sub: "100K x 3 outcomes", style: "danger" },
  { label: "内存增长", value: `${memoryGrowth.value.toFixed(2)} MB`, sub: `Heap ${benchmark.value?.memory.after.heapUsedMB ?? "--"} MB`, style: "warn" },
  { label: "WS 批量推送", value: `${(wsStringifyAvg.value / 1000).toFixed(2)} s`, sub: `${wsBatchSize.value.toFixed(2)} MB`, style: "warn" },
  { label: "WS 批量解析", value: `${wsParseAvg.value.toFixed(1)} ms`, sub: "浏览器 JSON.parse", style: "warn" },
  { label: "虚拟滚动切片", value: `${(rMap.value["Virtual scroll compute (slice + compute)"]?.avg ?? 0).toFixed(2)} ms`, sub: "极致优化 ✅", style: "ok" },
  { label: "赔率批量更新", value: `${patchAvg.value.toFixed(1)} ms`, sub: "patchOutcome", style: "ok" },
]);

const groupedResults = computed(() =>
  groupOrder
    .map((group) => ({
      name: group,
      items: currentResults.value.filter((item) => metaForLabel(item.label).group === group),
    }))
    .filter((group) => group.items.length > 0),
);

const topBottlenecks = computed(() =>
  [...currentResults.value]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      meta: metaForLabel(item.label),
    })),
);

const pipelineSteps = computed(() => {
  const net = +(totalJsonSize.value / 10 * 1000).toFixed(0);
  return [
    { name: "Data Gen", label: "服务端生成<br><small style='color:#6b7280'>Data Generation</small>", value: rMap.value["Data Generation (100K matches)"]?.avg ?? 0, color: "#8b5cf6" },
    { name: "Stringify", label: "HTTP 序列化<br><small style='color:#6b7280'>JSON.stringify</small>", value: rMap.value["JSON.stringify (100K matches)"]?.avg ?? 0, color: "#6366f1" },
    { name: "Network", label: "网络传输<br><small style='color:#6b7280'>Estimated @ 10MB/s</small>", value: net, color: "#64748b" },
    { name: "Parse", label: "HTTP 解析<br><small style='color:#6b7280'>JSON.parse</small>", value: rMap.value["JSON.parse (100K matches)"]?.avg ?? 0, color: "#3b82f6" },
    { name: "VScroll", label: "虚拟滚动<br><small style='color:#6b7280'>Virtual Scroll</small>", value: rMap.value["Virtual scroll compute (slice + compute)"]?.avg ?? 0, color: "#22c55e" },
    { name: "Patch", label: "赔率更新<br><small style='color:#6b7280'>WS Patch</small>", value: patchAvg.value, color: "#f59e0b" },
  ];
});

function fmtMs(value: number): string {
  return value > 1000 ? `${(value / 1000).toFixed(1)}s` : `${value.toFixed(1)}ms`;
}

function barHeight(value: number): number {
  const max = Math.max(...pipelineSteps.value.map((item) => item.value), 1);
  return Math.max(4, (value / max) * 200);
}

function heatClass(avg: number): string {
  if (avg > 5000) return "heat--red";
  if (avg > 500) return "heat--orange";
  if (avg > 50) return "heat--yellow";
  return "heat--green";
}

function ratingText(avg: number): string {
  if (avg > 5000) return "🔴 严重";
  if (avg > 500) return "🟠 警告";
  if (avg > 50) return "🟡 一般";
  return "🟢 优秀";
}

function destroyCharts() {
  for (const chart of charts.values()) chart.destroy();
  charts.clear();
}

function setChart(key: string, chart: Chart) {
  const existing = charts.get(key);
  existing?.destroy();
  charts.set(key, chart);
}

async function loadBenchmark() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`/benchmark-results.json?ts=${Date.now()}`);
    if (!res.ok) throw new Error(`加载 benchmark 结果失败: ${res.status} ${res.statusText}`);
    benchmark.value = (await res.json()) as BenchmarkData;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : "加载 benchmark 结果失败";
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  if (!benchmark.value) return;
  destroyCharts();

  if (barCanvas.value) {
    setChart("bar", new Chart(barCanvas.value, {
      type: "bar",
      data: {
        labels: currentResults.value.map((item) => chartLabel(item.label)),
        datasets: [{
          label: "Avg (ms)",
          data: currentResults.value.map((item) => item.avg),
          backgroundColor: currentResults.value.map((item) => item.avg > 1000 ? "#ef4444" : item.avg > 100 ? "#f59e0b" : item.avg > 10 ? "#3b82f6" : "#22c55e"),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: {
            type: "logarithmic",
            title: { display: true, text: "ms (log)" },
            ticks: { callback: (value) => Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}s` : `${value}ms` },
          },
          y: { ticks: { font: { size: 10 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const rawLabel = currentResults.value[items[0].dataIndex]?.label;
                const meta = rawLabel ? metaForLabel(rawLabel) : null;
                return meta ? `${meta.title} | ${meta.subtitle}` : "";
              },
              label: (ctx) => `${Number(ctx.raw).toFixed(2)} ms`,
            },
          },
        },
      },
    }));
  }

  if (heatCanvas.value) {
    setChart("heat", new Chart(heatCanvas.value, {
      type: "bar",
      data: {
        labels: currentResults.value.map((item) => chartLabel(item.label)),
        datasets: [
          { label: "Avg", data: currentResults.value.map((item) => item.avg), backgroundColor: "#6366f1", borderRadius: 4 },
          { label: "P95", data: currentResults.value.map((item) => item.p95), backgroundColor: "#f59e0b", borderRadius: 4 },
          { label: "Max", data: currentResults.value.map((item) => item.max), backgroundColor: "#ef4444", borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { font: { size: 9 } } },
          y: {
            type: "logarithmic",
            title: { display: true, text: "ms (log)" },
            ticks: { callback: (value) => Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}s` : `${value}ms` },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => {
                const rawLabel = currentResults.value[items[0].dataIndex]?.label;
                const meta = rawLabel ? metaForLabel(rawLabel) : null;
                return meta ? `${meta.title} | ${meta.subtitle}` : "";
              },
              label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(2)} ms`,
            },
          },
        },
      },
    }));
  }

  if (sizesCanvas.value && benchmark.value) {
    setChart("sizes", new Chart(sizesCanvas.value, {
      type: "bar",
      data: {
        labels: [["单场赛事", "Single Match"], ["100K 响应包", "100K JSON"], ["WS 批量包", "WS Batch"], ["单场均值", "Avg / Match"]],
        datasets: [{
          label: "Size",
          data: [
            benchmark.value.sizes.singleMatchBytes / 1024,
            Number.parseFloat(benchmark.value.sizes.totalJsonKB),
            Number.parseFloat(benchmark.value.sizes.wsBatchMB) * 1024,
            Number.parseFloat(benchmark.value.sizes.totalJsonKB) / 100,
          ],
          backgroundColor: ["#818cf8", "#6366f1", "#f59e0b", "#34d399"],
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y: {
            type: "logarithmic",
            title: { display: true, text: "KB (log)" },
            ticks: { callback: (value) => Number(value) >= 1024 ? `${(Number(value) / 1024).toFixed(1)} MB` : `${Number(value).toFixed(1)} KB` },
          },
        },
      },
    }));
  }

  if (memCanvas.value && benchmark.value) {
    setChart("mem", new Chart(memCanvas.value, {
      type: "bar",
      data: {
        labels: [["已用堆", "Heap Used"], ["总堆", "Heap Total"], ["驻留集", "RSS"], ["外部内存", "External"]],
        datasets: [
          {
            label: "Before",
            data: [benchmark.value.memory.before.heapUsedMB, benchmark.value.memory.before.heapTotalMB, benchmark.value.memory.before.rssMB, benchmark.value.memory.before.externalMB].map(Number.parseFloat),
            backgroundColor: "#a5b4fc",
            borderRadius: 6,
          },
          {
            label: "After (100K)",
            data: [benchmark.value.memory.after.heapUsedMB, benchmark.value.memory.after.heapTotalMB, benchmark.value.memory.after.rssMB, benchmark.value.memory.after.externalMB].map(Number.parseFloat),
            backgroundColor: "#6366f1",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} MB` },
          },
        },
        scales: { y: { title: { display: true, text: "MB" } } },
      },
    }));
  }

  if (pieCanvas.value) {
    const total = currentResults.value.reduce((sum, item) => sum + item.avg, 0);
    setChart("pie", new Chart(pieCanvas.value, {
      type: "doughnut",
      data: {
        labels: currentResults.value.map((item) => chartLabel(item.label)),
        datasets: [{
          data: currentResults.value.map((item) => item.avg),
          backgroundColor: ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7"],
          borderWidth: 2,
          borderColor: "#fff",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
        legend: {
          position: "right",
          labels: {
            font: { size: 11 },
            padding: 12,
            generateLabels: (chart) => {
              const labels = chart.data.labels ?? [];
              const backgroundColors = Array.isArray(chart.data.datasets[0]?.backgroundColor)
                ? chart.data.datasets[0].backgroundColor
                : [];
              return labels.map((label, index) => {
                const text = Array.isArray(label) ? label[0] : String(label);
                return {
                  text: `${text} (${(Number(chart.data.datasets[0].data[index]) / total * 100).toFixed(1)}%)`,
                  fillStyle: String(backgroundColors[index] ?? "#000"),
                  hidden: false,
                  index,
                };
              });
            },
          },
        },
          tooltip: {
            callbacks: {
              title: (items) => {
                const rawLabel = currentResults.value[items[0].dataIndex]?.label;
                const meta = rawLabel ? metaForLabel(rawLabel) : null;
                return meta ? `${meta.title} | ${meta.subtitle}` : "";
              },
              label: (ctx) => {
                const value = Number(ctx.raw);
                return `${value > 1000 ? `${(value / 1000).toFixed(2)}s` : `${value.toFixed(1)}ms`} (${(value / total * 100).toFixed(1)}%)`;
              },
            },
          },
        },
      },
    }));
  }
}

watch(benchmark, async (next) => {
  if (!next) return;
  await nextTick();
  renderCharts();
});

onMounted(() => {
  loadBenchmark();
});

onBeforeUnmount(() => {
  destroyCharts();
});
</script>

<style scoped>
.pbench {
  min-height: 100vh;
  background: #f0f2f5;
  color: #1a1a2e;
  font-family: system-ui, sans-serif;
}

.pbench__header {
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  color: #fff;
  text-align: center;
  padding: 40px 32px 32px;
}

.pbench__header h1 {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 6px;
}

.pbench__header p {
  font-size: 14px;
  opacity: 0.7;
}

.pbench__state {
  max-width: 1400px;
  margin: 24px auto;
  padding: 24px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  text-align: center;
  color: #475569;
  font-weight: 700;
}

.pbench__state--error {
  color: #b91c1c;
  background: #fff1f2;
}

.pbench__body {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px;
}

.insight {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 20px 24px;
  border-radius: 14px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fcd34d;
}

.insight--red {
  background: linear-gradient(135deg, #fef2f2, #fecaca);
  border-color: #fca5a5;
}

.insight__icon {
  font-size: 32px;
  flex-shrink: 0;
}

.insight h4 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 6px;
}

.insight p {
  font-size: 13px;
  color: #78716c;
  line-height: 1.6;
}

.insight--red p {
  color: #7f1d1d;
}

.stat-note {
  margin-bottom: 20px;
  padding: 18px 20px;
  border-radius: 14px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
}

.stat-note__title {
  font-size: 13px;
  font-weight: 800;
  color: #3730a3;
  margin-bottom: 8px;
}

.stat-note__text {
  font-size: 13px;
  line-height: 1.7;
  color: #4338ca;
}

.stat-note__text + .stat-note__text {
  margin-top: 6px;
}

code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}

.sum-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.sum-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.sum-card__label {
  font-size: 11px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.sum-card__value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.1;
}

.sum-card__sub {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.sum-card--danger .sum-card__value {
  color: #ef4444;
}

.sum-card--warn .sum-card__value {
  color: #f59e0b;
}

.sum-card--ok .sum-card__value {
  color: #22c55e;
}

.bottlenecks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.bottleneck {
  background: linear-gradient(160deg, #fff7ed, #ffffff);
  border: 1px solid #fed7aa;
  border-radius: 16px;
  padding: 18px;
}

.bottleneck__rank {
  font-size: 11px;
  font-weight: 800;
  color: #ea580c;
  margin-bottom: 8px;
}

.bottleneck__title {
  font-size: 18px;
  font-weight: 800;
  color: #1f2937;
}

.bottleneck__sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

.bottleneck__meta {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #c2410c;
}

.bottleneck__desc {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #7c2d12;
}

.panel {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 18px;
}

.panel--wide {
  grid-column: span 2;
}

.panel h3 {
  font-size: 14px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 14px;
}

.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}

.charts .panel canvas {
  max-height: 320px;
}

.chart-note {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #6b7280;
}

.pipeline {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: wrap;
  justify-content: center;
  padding: 12px 0;
}

.pipeline__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.pipeline__bar {
  width: 56px;
  border-radius: 8px 8px 0 0;
  min-height: 8px;
}

.pipeline__value {
  font-size: 12px;
  font-weight: 800;
  color: #374151;
}

.pipeline__label {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-align: center;
  max-width: 78px;
  line-height: 1.3;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

thead th {
  background: #f9fafb;
  padding: 8px 10px;
  text-align: left;
  color: #6b7280;
  font-weight: 600;
  border-bottom: 2px solid #e5e7eb;
}

td {
  padding: 8px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}

tr:hover td {
  background: #fafbfd;
}

.group-row td {
  background: #eef2ff;
  color: #3730a3;
  font-weight: 800;
  border-bottom: 1px solid #c7d2fe;
}

.op-cell__title {
  font-weight: 800;
  color: #111827;
}

.op-cell__sub {
  margin-top: 2px;
  font-size: 11px;
  color: #9ca3af;
}

.heat {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.heat--red {
  background: #fee2e2;
  color: #dc2626;
}

.heat--orange {
  background: #fff7ed;
  color: #ea580c;
}

.heat--yellow {
  background: #fef9c3;
  color: #ca8a04;
}

.heat--green {
  background: #dcfce7;
  color: #16a34a;
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.report-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px;
}

.report-card__title {
  font-size: 12px;
  font-weight: 800;
  color: #64748b;
  margin-bottom: 8px;
}

.report-card__value {
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
}

.report-card__sub {
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
}

.pbench__footer {
  text-align: center;
  padding: 24px;
  font-size: 12px;
  color: #9ca3af;
}

@media (max-width: 900px) {
  .charts,
  .bottlenecks,
  .report-grid {
    grid-template-columns: 1fr;
  }

  .panel--wide {
    grid-column: span 1;
  }

  .pipeline__bar {
    width: 44px;
  }
}
</style>
