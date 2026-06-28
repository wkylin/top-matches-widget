<template>
  <div class="monitor">
    <div class="monitor__header">
      <h1>⚽ Top Matches <span>实时性能监控</span></h1>
      <div class="status-bar">
        <div class="status-item"><span class="dot" :class="wsDotClass"></span> WS: <strong>{{ wsState }}</strong></div>
        <div class="status-item">消息/秒: <strong>{{ currentWsRate }}</strong></div>
        <div class="status-item">运行: <strong>{{ uptime }}</strong></div>
        <div class="status-item">内存: <strong>{{ currentMem.toFixed(1) }}</strong> MB</div>
      </div>
    </div>

    <div class="monitor__controls">
      <button class="btn btn--primary" @click="connectWS" :disabled="connected">连接 WS</button>
      <button class="btn btn--danger" @click="disconnectWS" :disabled="!connected">断开</button>
      <label class="ctrl-label">WS URL:</label>
      <input v-model="wsUrl" type="text" class="ctrl-input" placeholder="ws://localhost:8080/gateway/ws/stream"
        :disabled="connected" />
      <button class="btn btn--outline" @click="resetCharts">重置图表</button>
    </div>

    <!-- Metrics Row -->
    <div class="metrics-row">
      <div class="mcard">
        <div class="mcard__label">FPS</div>
        <div class="mcard__value" :style="{ color: fpsColor }">{{ currentFps }}</div>
        <div class="mcard__sub">帧率</div>
      </div>
      <div class="mcard">
        <div class="mcard__label">Frame Time</div>
        <div class="mcard__value" style="color:#818cf8">{{ currentFrameTime.toFixed(1) }}ms</div>
        <div class="mcard__sub">ms/帧</div>
      </div>
      <div class="mcard">
        <div class="mcard__label">WS Msg/Sec</div>
        <div class="mcard__value" style="color:#f59e0b">{{ currentWsRate }}</div>
        <div class="mcard__sub">消息吞吐</div>
      </div>
      <div class="mcard">
        <div class="mcard__label">WS MB/Sec</div>
        <div class="mcard__value" style="color:#f97316">{{ currentWsMb.toFixed(2) }}</div>
        <div class="mcard__sub">数据吞吐</div>
      </div>
      <div class="mcard">
        <div class="mcard__label">Heap Used</div>
        <div class="mcard__value" style="color:#ef4444">{{ currentMem.toFixed(1) }}</div>
        <div class="mcard__sub">MB</div>
      </div>
      <div class="mcard">
        <div class="mcard__label">WS Updates</div>
        <div class="mcard__value" style="color:#a78bfa">{{ totalUpdates }}</div>
        <div class="mcard__sub">累计</div>
      </div>
      <div class="mcard">
        <div class="mcard__label">Peak FPS</div>
        <div class="mcard__value" style="color:#818cf8">{{ peakFps }}</div>
        <div class="mcard__sub">最大帧率</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="charts-grid">
      <div class="panel panel--chart panel--wide">
        <h3>📈 FPS 实时变化 <span class="cur-val" :class="fpsClass">{{ currentFps }} fps</span></h3>
        <canvas ref="fpsCanvas"></canvas>
      </div>
      <div class="panel panel--chart">
        <h3>⚡ 帧渲染耗时 <span class="cur-val" :class="ftClass">{{ currentFrameTime.toFixed(1) }} ms</span></h3>
        <canvas ref="ftCanvas"></canvas>
      </div>
      <div class="panel panel--chart">
        <h3>📡 WS 消息速率 <span class="cur-val">{{ currentWsRate }} msg/s</span></h3>
        <canvas ref="wsrCanvas"></canvas>
      </div>
      <div class="panel panel--chart">
        <h3>📦 WS 数据吞吐 <span class="cur-val">{{ currentWsMb.toFixed(2) }} MB/s</span></h3>
        <canvas ref="wskbCanvas"></canvas>
      </div>
      <div class="panel panel--chart">
        <h3>🧠 内存占用 <span class="cur-val" :class="memClass">{{ currentMem.toFixed(1) }} MB</span></h3>
        <canvas ref="memCanvas"></canvas>
      </div>
    </div>

    <!-- Event Log -->
    <div class="panel">
      <h3>📋 事件日志</h3>
      <div class="log-box" ref="logBox">
        <div class="log-entry"><span class="log-ts">--</span> 等待连接...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, nextTick } from "vue";
import {
  Chart, LineController, LineElement, PointElement, CategoryScale,
  LinearScale, Filler, Tooltip, Legend,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend);

const PERF_SAMPLE_URL = "/gateway/api/perf-session/frontend-sample";

// ── State ──
const wsUrl = ref("ws://localhost:8080/gateway/ws/stream");
let ws: WebSocket | null = null;
const connected = ref(false);
const wsState = ref("--");
const wsDotClass = ref("dot--gray");

let startTime = Date.now();
let totalMsgCount = 0;
let totalBytes = 0;
let totalUpdates = ref(0);
let peakFps = ref(0);
const currentFps = ref(0);
const currentFrameTime = ref(0);
const currentWsRate = ref(0);
const currentWsMb = ref(0);
const currentMem = ref(0);

const uptime = ref("00:00");

// ── Computed classes ──
const fpsColor = computed(() => currentFps.value >= 55 ? '#22c55e' : currentFps.value >= 30 ? '#f59e0b' : '#ef4444');
const fpsClass = computed(() => currentFps.value >= 55 ? 'ok' : currentFps.value >= 30 ? 'warn' : 'bad');
const ftClass = computed(() => currentFrameTime.value <= 16 ? 'ok' : currentFrameTime.value <= 33 ? 'warn' : 'bad');
const memClass = computed(() => currentMem.value < 200 ? 'ok' : currentMem.value < 400 ? 'warn' : 'bad');

// ── Canvases ──
const fpsCanvas = ref<HTMLCanvasElement | null>(null);
const ftCanvas = ref<HTMLCanvasElement | null>(null);
const wsrCanvas = ref<HTMLCanvasElement | null>(null);
const wskbCanvas = ref<HTMLCanvasElement | null>(null);
const memCanvas = ref<HTMLCanvasElement | null>(null);
const logBox = ref<HTMLElement | null>(null);

// ── Ring buffers ──
const MAX_POINTS = 120;
type BufferPoint = { elapsedSec: number; clockTime: string; value: number };
type BufferMap = Record<string, BufferPoint[]>;
const buffers: BufferMap = {
  fps: [],
  frameTime: [],
  wsRate: [],
  wsMB: [],
  memory: [],
};

const chartColors: Record<string, { line: string; fill: string }> = {
  fps: { line: '#22c55e', fill: 'rgba(34,197,94,0.12)' },
  frameTime: { line: '#818cf8', fill: 'rgba(129,140,248,0.12)' },
  wsRate: { line: '#f59e0b', fill: 'rgba(245,158,11,0.12)' },
  wsMB: { line: '#f97316', fill: 'rgba(249,115,22,0.12)' },
  memory: { line: '#ef4444', fill: 'rgba(239,68,68,0.12)' },
};

const charts: Record<string, Chart> = {};
let wsParseLogCount = 0;

// Fixed Y ranges for each chart so the scale doesn't keep growing
const CHART_Y_CONFIG: Record<string, { min: number; max: number; label: string }> = {
  fps: { min: 0, max: 240, label: 'FPS (帧/秒)' },
  frameTime: { min: 0, max: 140, label: 'ms (毫秒)' },
  wsRate: { min: 0, max: 6, label: 'msg/s (消息/秒)' },
  wsMB: { min: 0, max: 80, label: 'MB/s (兆字节/秒)' },
  memory: { min: 0, max: 300, label: 'MB (兆字节)' },
};

function getHeapMb() {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  };
  const bytes = perf.memory?.usedJSHeapSize;
  if (!bytes || !Number.isFinite(bytes)) return 'n/a';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function createLineChart(canvas: HTMLCanvasElement, key: string) {
  const c = chartColors[key];
  const yc = CHART_Y_CONFIG[key] || { min: 0, max: 100, label: key };
  const valueSuffix =
    key === 'fps' ? ' fps' :
      key === 'frameTime' ? ' ms' :
        key === 'wsRate' ? ' msg/s' :
          key === 'wsMB' ? ' MB/s' :
            key === 'memory' ? ' MB' : '';
  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [{
        data: [],
        borderColor: c.line,
        backgroundColor: c.fill,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          title: { display: true, text: '运行秒数', color: '#64748b', font: { size: 10 } },
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            callback: (value) => `${value}s`,
          },
        },
        y: {
          min: yc.min,
          max: yc.max,
          title: { display: true, text: yc.label, color: '#64748b', font: { size: 10 } },
          grid: { color: '#1e293b' },
          ticks: { color: '#64748b', font: { size: 10 }, stepSize: yc.max <= 10 ? 1 : yc.max <= 50 ? 5 : yc.max <= 100 ? 10 : 50 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const raw = items[0]?.raw as { x: number; y: number; clockTime?: string } | undefined;
              if (!raw) return '';
              return `x: ${raw.x}s`;
            },
            label: (item) => {
              const raw = item.raw as { x: number; y: number; clockTime?: string } | undefined;
              if (!raw) return '';
              return `y: ${raw.y}${valueSuffix}`;
            },
            afterLabel: (item) => {
              const raw = item.raw as { x: number; y: number; clockTime?: string } | undefined;
              if (!raw) return '';
              return `时间: ${raw.clockTime ?? '--'}`;
            },
          },
        },
      },
    },
  });
}

function pushBuffer(key: string, value: number) {
  const buf = buffers[key];
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  buf.push({
    elapsedSec,
    clockTime: new Date().toLocaleTimeString('zh-CN'),
    value,
  });
  if (buf.length > MAX_POINTS) buf.shift();
  const chart = charts[key];
  if (chart) {
    chart.data.datasets[0].data = buf.map((point) => ({
      x: point.elapsedSec,
      y: point.value,
      clockTime: point.clockTime,
    }));
    chart.update('none');
  }
}

// ── FPS monitoring ──
let lastFrameTs = performance.now();
let fpsAcc = 0;
let fpsSamples = 0;
let animId = 0;

function measureFps() {
  const now = performance.now();
  const elapsed = now - lastFrameTs;
  lastFrameTs = now;
  if (elapsed > 0) { fpsAcc += 1000 / elapsed; fpsSamples++; currentFrameTime.value = elapsed; }
  animId = requestAnimationFrame(measureFps);
}

// ── Sampling ──
let lastSampleTs = Date.now();
let lastMsgCount = 0;
let lastBytes = 0;
let sampleTimer = 0;

function sample() {
  const now = Date.now();
  const elapsedSec = (now - lastSampleTs) / 1000;

  if (fpsSamples > 0) { currentFps.value = Math.round(fpsAcc / fpsSamples); fpsAcc = 0; fpsSamples = 0; }
  if (currentFps.value > peakFps.value) peakFps.value = currentFps.value;

  currentWsRate.value = Math.round((totalMsgCount - lastMsgCount) / Math.max(elapsedSec, 0.1));
  currentWsMb.value = Math.round((totalBytes - lastBytes) / Math.max(elapsedSec, 0.1) / 1024 / 1024 * 100) / 100;
  lastMsgCount = totalMsgCount;
  lastBytes = totalBytes;

  if ((performance as any).memory) {
    currentMem.value = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100;
  }

  pushBuffer('fps', currentFps.value);
  pushBuffer('frameTime', Math.min(currentFrameTime.value, 100));
  pushBuffer('wsRate', currentWsRate.value);
  pushBuffer('wsMB', currentWsMb.value);
  pushBuffer('memory', currentMem.value);

  const sec = Math.floor((Date.now() - startTime) / 1000);
  uptime.value = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  void postPerfSample(sec);

  if (currentFps.value < 30 && currentFps.value > 0) addLog(`⚠️ FPS dropped to ${currentFps.value}`, 'warn');
  lastSampleTs = now;
}

async function postPerfSample(elapsedSec: number) {
  try {
    await fetch(PERF_SAMPLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        elapsedSec,
        fps: currentFps.value,
        frameTime: currentFrameTime.value,
        wsRate: currentWsRate.value,
        wsMb: currentWsMb.value,
        memoryMb: currentMem.value,
        totalUpdates: totalUpdates.value,
        totalMessages: totalMsgCount,
        wsState: wsState.value,
        connected: connected.value,
      }),
    });
  } catch {
    // Ignore transient reporting errors during local profiling.
  }
}

// ── Logging ──
function addLog(msg: string, level = '') {
  if (!logBox.value) return;
  const ts = new Date().toLocaleTimeString('zh-CN');
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-ts">${ts}</span> <span class="log-${level}">${msg}</span>`;
  logBox.value.prepend(div);
  while (logBox.value.children.length > 100) logBox.value.lastChild?.remove();
}

// ── WebSocket ──
function connectWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  const url = wsUrl.value.trim();
  if (!url) { addLog('请输入 WS URL', 'bad'); return; }

  addLog(`正在连接 ${url}...`);
  wsState.value = '连接中...';
  wsDotClass.value = 'dot--yellow';

  try { ws = new WebSocket(url); } catch (e: any) {
    addLog(`连接失败: ${e.message}`, 'bad');
    wsState.value = '失败'; wsDotClass.value = 'dot--red'; return;
  }

  ws.onopen = () => {
    connected.value = true; startTime = Date.now();
    totalMsgCount = 0; totalBytes = 0; totalUpdates.value = 0;
    lastMsgCount = 0; lastBytes = 0;
    wsState.value = '已连接'; wsDotClass.value = 'dot--green';
    addLog('✅ WebSocket 连接成功', 'ok');
    addLog(`🧠 WS 基线内存 ${getHeapMb()}`);
  };

  ws.onmessage = (event) => {
    totalMsgCount++;
    const size = typeof event.data === 'string' ? new Blob([event.data]).size : event.data.byteLength || 0;
    totalBytes += size;
    try {
      const shouldLogParse = wsParseLogCount < 8;
      const parseStartedAt = shouldLogParse ? performance.now() : 0;
      const heapBefore = shouldLogParse ? getHeapMb() : '';
      const msg = JSON.parse(event.data);
      if (shouldLogParse) {
        const heapAfter = getHeapMb();
        addLog(
          `🧪 WS parse ${(size / 1024 / 1024).toFixed(2)} MB | ${heapBefore} -> ${heapAfter} | ${(performance.now() - parseStartedAt).toFixed(1)} ms`,
        );
        wsParseLogCount += 1;
      }
      if (msg.type === 'sportradar_odds_change_batch') {
        totalUpdates.value += msg.batchSize || msg.changes?.length || 0;
        if (totalMsgCount % 5 === 0) addLog(`📡 batch: ${msg.batchSize || msg.changes?.length || 0} 变更 | 累计 ${totalUpdates.value}`, 'ok');
      }
    } catch (_) { }
  };

  ws.onclose = () => {
    connected.value = false; wsState.value = '已断开'; wsDotClass.value = 'dot--red';
    addLog('❌ WebSocket 断开', 'bad');
  };

  ws.onerror = () => { wsState.value = '错误'; wsDotClass.value = 'dot--red'; addLog('WebSocket 错误', 'bad'); };
}

function disconnectWS() {
  ws?.close(); ws = null; connected.value = false;
  addLog('手动断开连接');
}

function resetCharts() {
  for (const key of Object.keys(buffers) as Array<keyof BufferMap>) { buffers[key] = []; }
  for (const chart of Object.values(charts)) { chart.data.datasets[0].data = []; chart.update(); }
  peakFps.value = 0; totalUpdates.value = 0; totalMsgCount = 0; totalBytes = 0;
  lastMsgCount = 0; lastBytes = 0;
  wsParseLogCount = 0;
  startTime = Date.now();
  addLog('🔄 图表已重置');
}

// ── Lifecycle ──
onMounted(() => {
  nextTick(() => {
    if (fpsCanvas.value) charts.fps = createLineChart(fpsCanvas.value, 'fps');
    if (ftCanvas.value) charts.frameTime = createLineChart(ftCanvas.value, 'frameTime');
    if (wsrCanvas.value) charts.wsRate = createLineChart(wsrCanvas.value, 'wsRate');
    if (wskbCanvas.value) charts.wsMB = createLineChart(wskbCanvas.value, 'wsMB');
    if (memCanvas.value) charts.memory = createLineChart(memCanvas.value, 'memory');
  });

  animId = requestAnimationFrame(measureFps);
  sampleTimer = window.setInterval(sample, 1000);

  // Auto connect
  setTimeout(() => {
    if (wsUrl.value.trim()) connectWS();
  }, 500);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animId);
  clearInterval(sampleTimer);
  ws?.close();
});
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.monitor {
  min-height: 100vh;
  background: #0f1117;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
}

.monitor__header {
  background: linear-gradient(135deg, #1a1040, #0f0c29);
  border-bottom: 1px solid #1e293b;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.monitor__header h1 {
  font-size: 18px;
  font-weight: 800;
}

.monitor__header h1 span {
  color: #818cf8;
}

.status-bar {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}

.status-item {
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-item strong {
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot--green {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.dot--yellow {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}

.dot--red {
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
}

.dot--gray {
  background: #475569;
}

.monitor__controls {
  padding: 10px 24px;
  background: #161923;
  border-bottom: 1px solid #1e293b;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.btn {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s;
  border: 1px solid transparent;
}

.btn--primary {
  background: #6366f1;
  color: #fff;
  border-color: #818cf8;
}

.btn--primary:hover {
  background: #4f46e5;
}

.btn--primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn--danger {
  background: transparent;
  color: #f87171;
  border-color: #7f1d1d;
}

.btn--danger:hover {
  background: #7f1d1d20;
}

.btn--danger:disabled {
  opacity: 0.3;
  cursor: default;
}

.btn--outline {
  background: transparent;
  color: #94a3b8;
  border-color: #334155;
}

.btn--outline:hover {
  background: #1e293b;
}

.ctrl-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

.ctrl-input {
  flex: 1;
  min-width: 200px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f1117;
  color: #e2e8f0;
  font-size: 12px;
  font-family: monospace;
}

.metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  padding: 16px 24px;
}

.mcard {
  background: #161923;
  border: 1px solid #1e293b;
  border-radius: 10px;
  padding: 12px 14px;
}

.mcard__label {
  font-size: 10px;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.mcard__value {
  font-size: 24px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.mcard__sub {
  font-size: 11px;
  color: #475569;
  margin-top: 2px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 0 24px 16px;
  align-items: start;
}

.panel {
  background: #161923;
  border: 1px solid #1e293b;
  border-radius: 14px;
  padding: 14px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel--chart {
  height: 300px;
}

.panel--wide {
  grid-column: span 1;
}

.panel h3 {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  margin-bottom: 8px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cur-val {
  font-size: 18px;
  font-weight: 800;
  color: #e2e8f0;
  margin-left: auto;
}

.cur-val.ok {
  color: #22c55e;
}

.cur-val.warn {
  color: #f59e0b;
}

.cur-val.bad {
  color: #ef4444;
}

.panel canvas {
  flex: 1;
  min-height: 0;
}

.panel--chart canvas {
  height: 236px !important;
}

.log-box {
  background: #161923;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 10px 14px;
  max-height: 180px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.7;
}

.log-entry {
  color: #64748b;
}

.log-ts {
  color: #475569;
}

.log-warn {
  color: #f59e0b;
  font-weight: 600;
}

.log-bad {
  color: #ef4444;
  font-weight: 600;
}

.log-ok {
  color: #22c55e;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }

  .panel--wide {
    grid-column: span 1;
  }
}
</style>
