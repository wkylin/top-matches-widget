import Koa from "koa";
import Router from "@koa/router";
import { createServer } from "http";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getTopMatchesResponse } from "./data";
import { createWsManager } from "./wsManager";
import { PerfSessionStore, type FrontendPerfSampleInput } from "./perfSessionStore";

const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || "8080", 10);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const distDir = join(projectRoot, "dist");
const indexFile = join(distDir, "index.html");
const STATIC_FILE_HEADERS: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

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

app.use(async (ctx, next) => {
  if (ctx.method !== "GET" && ctx.method !== "HEAD") {
    await next();
    return;
  }

  if (ctx.path.startsWith("/gateway/")) {
    await next();
    return;
  }

  const cleanedPath = ctx.path === "/" ? "index.html" : ctx.path.replace(/^\/+/, "");
  const relativePath = normalize(cleanedPath).replace(/^(\.\.[/\\])+/, "");
  const assetPath = join(distDir, relativePath);

  if (existsSync(assetPath)) {
    const mimeType = STATIC_FILE_HEADERS[extname(assetPath)] ?? "application/octet-stream";
    ctx.type = mimeType;
    ctx.body = createReadStream(assetPath);
    return;
  }

  if (!existsSync(indexFile)) {
    await next();
    return;
  }

  ctx.type = "text/html; charset=utf-8";
  ctx.body = createReadStream(indexFile);
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
  console.log(`   Static UI: ${existsSync(indexFile) ? `http://localhost:${PORT}/` : "dist/ not found; run `pnpm build` first"}\n`);
});
