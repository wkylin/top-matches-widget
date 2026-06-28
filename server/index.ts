import Koa from "koa";
import Router from "@koa/router";
import { createServer } from "http";
import { getTopMatchesResponse } from "./data";
import { createWsManager } from "./wsManager";
import { PerfSessionStore, type FrontendPerfSampleInput } from "./perfSessionStore";

const PORT = parseInt(process.env.SERVER_PORT || "8080", 10);

const app = new Koa();
const router = new Router();
const perfSessionStore = new PerfSessionStore();

async function readJsonBody<T>(req: Koa.Request["req"]): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as T;
}

// ── REST API ──
router.get("/gateway/api/sportradar/v1/uof/top-matches", async (ctx) => {
  const data = getTopMatchesResponse();
  ctx.body = data;
  ctx.type = "application/json";
  console.log(`[http] GET /gateway/api/sportradar/v1/uof/top-matches → ${data.list?.length ?? 0} matches`);
});

router.post("/gateway/api/perf-session/frontend-sample", async (ctx) => {
  try {
    const payload = await readJsonBody<FrontendPerfSampleInput>(ctx.req);
    perfSessionStore.recordFrontendSample(payload);
    ctx.status = 204;
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      error: error instanceof Error ? error.message : "Invalid perf sample payload",
    };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

// ── HTTP server (shared by Koa + WebSocket) ──
const httpServer = createServer(app.callback());

// ── WebSocket on same server ──
const wsManager = createWsManager(httpServer, perfSessionStore);

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 Received ${signal}, writing perf session report...`);
  const reportPaths = perfSessionStore.saveReport();
  console.log(`📄 Latest perf session report: ${reportPaths.latestPath}`);
  console.log(`🗂️ Archived perf session report: ${reportPaths.archivePath}`);
  console.log(`📚 Perf session index: ${reportPaths.indexPath}`);
  wsManager.stop();
  httpServer.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   REST API:  http://localhost:${PORT}/gateway/api/sportradar/v1/uof/top-matches`);
  console.log(`   WebSocket: ws://localhost:${PORT}/gateway/ws/stream\n`);
});
