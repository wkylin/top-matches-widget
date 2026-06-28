import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { generateOddsChanges, UPDATE_BATCH_SIZE } from "./data";
import type { PerfSessionStore } from "./perfSessionStore";

const PING_INTERVAL_MS = 30_000;

export function createWsManager(httpServer: Server, perfSessionStore: PerfSessionStore) {
  const wss = new WebSocketServer({ server: httpServer, path: "/gateway/ws/stream" });

  const clients = new Set<WebSocket>();
  const startedAt = Date.now();
  let oddsTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  wss.on("connection", (ws, req) => {
    console.log("[ws] client connected, url:", req.url);
    clients.add(ws);

    // Send welcome
    ws.send(
      JSON.stringify({
        type: "welcome",
        serverTime: Date.now(),
        dataRev: 1,
      })
    );

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", clientTime: msg.clientTime }));
        }
      } catch {
        // ignore bad json
      }
    });

    ws.on("close", () => {
      console.log("[ws] client disconnected");
      clients.delete(ws);
    });

    ws.on("error", (err) => {
      console.error("[ws] error:", err.message);
      clients.delete(ws);
    });
  });

  // Heartbeat to all clients
  const heartbeatTimer = setInterval(() => {
    const heartbeat = JSON.stringify({
      type: "heartbeat",
      serverTime: Date.now(),
    });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(heartbeat);
      }
    }
  }, PING_INTERVAL_MS);

  // Broadcast odds changes to all clients every 3-5 seconds
  function broadcastOdds() {
    const changes = generateOddsChanges(UPDATE_BATCH_SIZE);
    if (!changes.length) return;
    let liveCount = 0;
    let prematchCount = 0;
    for (const change of changes) {
      if (change.eventId.startsWith("evt-live-")) liveCount += 1;
      else if (change.eventId.startsWith("evt-prem-")) prematchCount += 1;
    }
    console.log(`[ws] pushing odds batch total=${changes.length} live=${liveCount} prematch=${prematchCount}`);

    const stringifyStartedAt = performance.now();
    const batch = JSON.stringify({
      type: "sportradar_odds_change_batch",
      eventType: "sportradar_odds_change_batch",
      batchSize: changes.length,
      pushedAt: new Date().toISOString(),
      changes: changes.map((c) => ({
        eventType: "sportradar_odds_change",
        eventId: c.eventId,
        marketId: c.marketId,
        marketKey: c.marketKey,
        marketName: c.marketName,
        status: c.status,
        oddsUpdatedAt: new Date().toISOString(),
        outcomes: c.outcomes.map((o) => ({
          code: o.code,
          label: o.label,
          outcomeId: o.outcomeId,
          outcomeName: o.outcomeName,
          oddsDecimal: o.odds,
          odds: o.odds,
          active: o.active,
          locked: o.locked,
          oddsTrend: o.oddsTrend,
        })),
      })),
    });
    const stringifyMs = performance.now() - stringifyStartedAt;
    const payloadBytes = Buffer.byteLength(batch);
    perfSessionStore.recordServerBatch({
      elapsedSec: Math.floor((Date.now() - startedAt) / 1000),
      batchSize: changes.length,
      live: liveCount,
      prematch: prematchCount,
      payloadBytes,
      stringifyMs,
      clientCount: clients.size,
    });

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(batch);
      }
    }
  }

  // Random interval 3-5s
  function scheduleOdds() {
    if (stopped) return;
    const delay = 3000 + Math.random() * 2000;
    oddsTimer = setTimeout(() => {
      if (stopped) return;
      broadcastOdds();
      scheduleOdds();
    }, delay);
  }
  scheduleOdds();

  return {
    wss,
    stop() {
      stopped = true;
      clearInterval(heartbeatTimer);
      if (oddsTimer) clearTimeout(oddsTimer);
      wss.close();
    },
  };
}
