<template>
  <section class="board">
    <div class="board__head">
      <div>
        <h2 class="board__title">Top Matches</h2>
        <p class="board__sub">精简卡片模式，支持 100000 条赛事连续滚动浏览</p>
      </div>

      <div v-if="!loading && !error" class="board__stats">
        <span class="stat-chip">Total {{ meta.total }}</span>
        <span class="stat-chip">Live {{ liveCount }}</span>
        <span class="stat-chip">Prematch {{ prematchCount }}</span>
        <span class="stat-chip stat-chip--accent">Last Batch P {{ batchStats.prematch }}</span>
      </div>
    </div>

    <div class="board__toolbar">
      <div class="seg">
        <button
          v-for="f in filters"
          :key="f.id"
          type="button"
          class="seg__btn"
          :class="{ 'is-active': filter === f.id }"
          @click="changeFilter(f.id)"
        >
          {{ f.label }}
        </button>
      </div>

      <div v-if="!loading && !error" class="board__meta">
        <span>Batch {{ batchStats.total }} = L {{ batchStats.live }} / P {{ batchStats.prematch }}</span>
        <span>{{ batchStats.pushedAt || meta.latestOddsUpdatedAt || "--" }}</span>
      </div>
    </div>

    <div v-if="loading" class="board__state">
      Loading {{ meta.total || 100000 }} matches...
    </div>

    <div v-else-if="error" class="board__state board__state--error">
      <p>{{ error }}</p>
      <button type="button" class="board__retry" @click="refresh()">Retry</button>
    </div>

    <div
      v-else-if="filtered.length"
      ref="scroller"
      class="board__viewport"
      @scroll="onScroll"
    >
      <div class="board__spacer" :style="{ height: `${totalHeight}px` }">
        <div
          class="board__grid"
          :style="{
            transform: `translateY(${offsetY}px)`,
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          }"
        >
          <MatchCard
            v-for="m in visibleRows"
            :key="m.id"
            :row="m"
            :selected="selectedKeys"
            :flash="flash"
            @select="onSelect"
            @toggle-odds="onToggleOdds"
          />
        </div>
      </div>
    </div>

    <p v-else class="board__state">No matches for this filter.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import MatchCard from "./MatchCard.vue";
import type { MatchMarket, MatchRow } from "../types";
import { flashChanges, useTopMatches } from "../useTopMatches";

type Filter = "live" | "prematch" | "all";

const CARD_MIN_WIDTH = 240;
const CARD_GAP = 12;
const CARD_HEIGHT = 188;
const OVERSCAN_ROWS = 2;

const filters: { id: Filter; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "prematch", label: "Prematch" },
  { id: "all", label: "All" },
];

const filter = ref<Filter>("all");
const selectedKeys = ref(new Set<string>());
const scroller = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(900);
const viewportWidth = ref(1200);

const { rows, loading, error, refresh, meta, batchStats, setVisibleEventIds } = useTopMatches("default");

const filtered = computed(() => {
  const list = rows.value;
  if (filter.value === "live") return list.filter((r) => r.isLive);
  if (filter.value === "prematch") return list.filter((r) => !r.isLive);
  return list;
});

const liveCount = computed(() => rows.value.filter((r) => r.isLive).length);
const prematchCount = computed(() => rows.value.filter((r) => !r.isLive).length);
const flash = flashChanges;

const columnCount = computed(() => {
  const usableWidth = Math.max(320, viewportWidth.value - 24);
  return Math.max(1, Math.floor((usableWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)));
});

const totalRows = computed(() => Math.ceil(filtered.value.length / columnCount.value));
const startRow = computed(() => Math.max(0, Math.floor(scrollTop.value / CARD_HEIGHT) - OVERSCAN_ROWS));
const visibleRowCount = computed(() => {
  return Math.ceil(viewportHeight.value / CARD_HEIGHT) + OVERSCAN_ROWS * 2;
});
const endRow = computed(() => Math.min(totalRows.value, startRow.value + visibleRowCount.value));
const startIndex = computed(() => startRow.value * columnCount.value);
const endIndex = computed(() => Math.min(filtered.value.length, endRow.value * columnCount.value));
const visibleRows = computed(() => filtered.value.slice(startIndex.value, endIndex.value));
const totalHeight = computed(() => totalRows.value * CARD_HEIGHT);
const offsetY = computed(() => startRow.value * CARD_HEIGHT);

watch(visibleRows, (nextRows) => {
  setVisibleEventIds(nextRows.map((row) => row.eventId ?? row.id));
}, { immediate: true });

function updateViewportMetrics() {
  const el = scroller.value;
  if (!el) return;
  viewportHeight.value = el.clientHeight;
  viewportWidth.value = el.clientWidth;
}

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  scrollTop.value = el.scrollTop;
}

function changeFilter(next: Filter) {
  filter.value = next;
  nextTick(() => {
    if (scroller.value) {
      scroller.value.scrollTop = 0;
    }
    scrollTop.value = 0;
    updateViewportMetrics();
  });
}

function onSelect(row: MatchRow): void {
  console.log("[TopMatches] selected match:", row.id, row.homeTeam, "vs", row.awayTeam);
}

function onToggleOdds(row: MatchRow, market: MatchMarket): void {
  const key = `${row.id}|${market.key}`;
  const next = new Set(selectedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selectedKeys.value = next;
}

onMounted(() => {
  nextTick(updateViewportMetrics);
  window.addEventListener("resize", updateViewportMetrics);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateViewportMetrics);
});
</script>

<style scoped>
.board {
  max-width: 1440px;
  margin: 20px auto;
  font-family: system-ui, -apple-system, sans-serif;
}

.board__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px;
  margin-bottom: 12px;
}

.board__title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
}

.board__sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: #6b7280;
}

.board__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.stat-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 12px;
  color: #334155;
}

.stat-chip--accent {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

.board__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  margin-bottom: 14px;
}

.seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 20px;
  background: #f3f4f6;
}

.seg__btn {
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 12px;
  color: #6b7280;
  transition: all .15s;
}

.seg__btn.is-active {
  background: #fff;
  color: #e8112d;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .1);
}

.board__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}

.board__viewport {
  height: 78vh;
  min-height: 720px;
  overflow-y: auto;
  padding: 0 12px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background:
    radial-gradient(circle at top left, rgba(253, 242, 248, .9), transparent 28%),
    linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
}

.board__spacer {
  position: relative;
}

.board__grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  gap: 12px;
  padding-top: 12px;
  will-change: transform;
}

.board__state {
  padding: 48px 16px;
  text-align: center;
  color: #64748b;
}

.board__state--error {
  color: #dc2626;
}

.board__retry {
  margin-top: 12px;
  padding: 8px 20px;
  border-radius: 999px;
  background: #e8112d;
  color: #fff;
  font-weight: 700;
}

@media (max-width: 768px) {
  .board__head,
  .board__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .board__stats {
    justify-content: flex-start;
  }

  .board__viewport {
    min-height: 560px;
    height: 72vh;
  }
}
</style>
