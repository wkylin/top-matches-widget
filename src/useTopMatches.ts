import { onBeforeUnmount, onMounted, reactive, ref, shallowRef, triggerRef } from "vue";
import { fetchTopMatches } from "./api";
import { onWsMessage, startWs, stopWs } from "./wsClient";
import type {
  MatchRow,
  TopMatchesBatchStats,
  TopMatchesMeta,
  TopMatchesResponse,
  WsMessage,
  WsSportradarOddsChange,
  WsOddsOutcome,
} from "./types";

// ---- Adapter (same logic as homeTopMatchesAdapter.ts) ----

function text(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function getHeapMb(): string {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  };
  const bytes = perf.memory?.usedJSHeapSize;
  if (!bytes || !Number.isFinite(bytes)) return "n/a";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---- WebSocket patching (same logic as feedRealtimeStore.ts) ----

function patchOutcome(
  row: MatchRow,
  change: WsSportradarOddsChange,
  outcome: WsOddsOutcome,
): string | null {
  const code = text(outcome.code);
  const outcomeId = text(outcome.outcomeId);
  const lookupKey = outcomeId || code;
  if (!lookupKey && !code) return null;
  const market = row.markets.find((m) => {
    const mk = String(m.marketKey ?? "");
    const oid = String(m.outcomeId ?? "");
    const key = String(m.key);
    return (
      mk === change.marketKey &&
      (
        (outcomeId && oid === outcomeId) ||
        (code && key === code) ||
        (code && oid === code) ||
        (lookupKey && key === lookupKey)
      )
    );
  });
  if (!market) return null;

  const nextValue = Number(outcome.odds ?? outcome.oddsDecimal ?? 0);
  if (Number.isFinite(nextValue) && nextValue > 0) {
    market.value = nextValue;
  }

  const locked =
    text(change.status).toLowerCase() === "suspended" ||
    outcome.active === false ||
    outcome.locked === true;
  market.locked = locked;

  const trend = text(outcome.oddsTrend).toUpperCase();
  if (trend === "UP") market.trend = "up";
  else if (trend === "DOWN") market.trend = "down";
  else if (trend === "FLAT") market.trend = "stable";

  if (trend === "UP" || trend === "DOWN") {
    const flashOutcomeKey = outcomeId || code || market.outcomeId || market.key;
    return `${row.eventId ?? row.id}::${change.marketKey}::${flashOutcomeKey}`;
  }

  return null;
}

// ---- Composable ----

export const flashChanges = reactive<Record<string, "up" | "down">>({});
const FLASH_LIMIT = 2000;
const FLASH_DURATION_MS = 550;

export function useTopMatches(siteCode = "default") {
  const rows = shallowRef<MatchRow[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const batchStats = ref<TopMatchesBatchStats>({
    total: 0,
    live: 0,
    prematch: 0,
    pushedAt: "",
  });
  const meta = ref<TopMatchesMeta>({
    total: 0,
    latestEventUpdatedAt: "",
    latestOddsUpdatedAt: "",
  });

  // A reactive map of eventId → MatchRow for fast WS patching
  const rowMap = new Map<string, MatchRow>();
  const pendingBatches: WsSportradarOddsChange[][] = [];
  const visibleEventIds = new Set<string>();
  const flashTimeouts = new Map<string, number>();
  let flushFrame = 0;

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const fetchStartedAt = performance.now();
      console.log(`[top-matches] refresh start heap=${getHeapMb()}`);
      const res: TopMatchesResponse = await fetchTopMatches(siteCode);
      console.log(
        `[top-matches] fetch done heap=${getHeapMb()} total=${res.total ?? 0} list=${res.list?.length ?? 0} elapsed=${(performance.now() - fetchStartedAt).toFixed(1)}ms`,
      );
      meta.value = {
        total: res.total ?? 0,
        latestEventUpdatedAt: text(res.latestEventUpdatedAt),
        latestOddsUpdatedAt: text(res.latestOddsUpdatedAt),
      };
      const list = res.list ?? [];
      if (list.length > 0) {
        const first = list[0] as Partial<MatchRow> & Record<string, unknown>;
        const looksLikeMatchRow =
          typeof first.id === "string" &&
          Array.isArray(first.markets) &&
          typeof first.homeTeam === "string" &&
          typeof first.awayTeam === "string";
        if (!looksLikeMatchRow) {
          throw new Error("Top matches API returned legacy data shape. Please restart the backend server to use the new MatchRow JSON format.");
        }
      }
      const rowsStartedAt = performance.now();
      const nextRows: MatchRow[] = [];
      for (const row of list) {
        if (!row?.id) continue;
        // If we already have this row from a previous fetch, patch it in-place
        // so the Vue refs stay stable.
        const rowId = row.eventId ?? row.id;
        const existing = rowMap.get(rowId);
        if (existing) {
          Object.assign(existing, row);
          nextRows.push(existing);
        } else {
          rowMap.set(rowId, row);
          nextRows.push(row);
        }
      }
      // Remove rows not in the new response
      const newIds = new Set(nextRows.map((r) => r.eventId ?? r.id));
      for (const key of rowMap.keys()) {
        if (!newIds.has(key)) rowMap.delete(key);
      }
      console.log(
        `[top-matches] rows ready heap=${getHeapMb()} rows=${nextRows.length} rowMap=${rowMap.size} elapsed=${(performance.now() - rowsStartedAt).toFixed(1)}ms`,
      );
      rows.value = nextRows;
      console.log(`[top-matches] rows assigned heap=${getHeapMb()} visibleRows=${rows.value.length}`);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Failed to load";
    } finally {
      loading.value = false;
    }
  }

  // ---- WS handler ----
  function clearFlash(key: string) {
    delete flashChanges[key];
    const timeoutId = flashTimeouts.get(key);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      flashTimeouts.delete(key);
    }
  }

  function scheduleFlash(key: string, direction: "up" | "down") {
    if (flashTimeouts.has(key)) return;
    flashChanges[key] = direction;
    const timeoutId = window.setTimeout(() => {
      clearFlash(key);
    }, FLASH_DURATION_MS);
    flashTimeouts.set(key, timeoutId);
  }

  function flushPendingChanges() {
    flushFrame = 0;
    if (!pendingBatches.length) return;

    const flashAssignments = new Map<string, "up" | "down">();
    const batches = pendingBatches.splice(0, pendingBatches.length);
    let didPatch = false;
    let liveUpdates = 0;
    let prematchUpdates = 0;

    for (const changes of batches) {
      for (const change of changes) {
        const row = rowMap.get(change.eventId);
        if (!row) continue;
        if (row.isLive) liveUpdates += 1;
        else prematchUpdates += 1;
        for (const outcome of change.outcomes ?? []) {
          didPatch = true;
          const flashKey = patchOutcome(row, change, outcome);
          if (!flashKey) continue;
          const rowId = row.eventId ?? row.id;
          const shouldFlash = visibleEventIds.size === 0 || visibleEventIds.has(rowId);
          if (shouldFlash && flashAssignments.size < FLASH_LIMIT) {
            const trend = text(outcome.oddsTrend).toUpperCase();
            flashAssignments.set(flashKey, trend === "UP" ? "up" : "down");
          }
        }
      }
    }

    for (const [flashKey, direction] of flashAssignments) {
      scheduleFlash(flashKey, direction);
    }

    if (didPatch) {
      batchStats.value = {
        total: liveUpdates + prematchUpdates,
        live: liveUpdates,
        prematch: prematchUpdates,
        pushedAt: new Date().toISOString(),
      };
      triggerRef(rows);
    }

  }

  const unsub = onWsMessage((msg: WsMessage) => {
    if (msg.type !== "sportradar_odds_change_batch") return;
    const batch = msg as unknown as { changes?: WsSportradarOddsChange[]; type: string };
    pendingBatches.push(batch.changes ?? []);
    if (!flushFrame) {
      flushFrame = window.requestAnimationFrame(flushPendingChanges);
    }
  });

  onMounted(() => {
    refresh();
    startWs({ siteCode, parentCode: "sports" });
  });

  onBeforeUnmount(() => {
    if (flushFrame) window.cancelAnimationFrame(flushFrame);
    for (const timeoutId of flashTimeouts.values()) {
      window.clearTimeout(timeoutId);
    }
    flashTimeouts.clear();
    unsub();
    stopWs();
  });

  function setVisibleEventIds(ids: string[]) {
    visibleEventIds.clear();
    for (const id of ids) {
      visibleEventIds.add(id);
    }
  }

  return { rows, loading, error, refresh, meta, batchStats, setVisibleEventIds };
}
