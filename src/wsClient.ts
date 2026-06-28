import type { WsMessage } from "./types";

const WS_URL = import.meta.env.VITE_FEED_WS_URL?.trim() || "";
const WS_QUERY = import.meta.env.VITE_FEED_WS_QUERY?.trim() || "";
const PING_ENABLED = import.meta.env.VITE_FEED_WS_PING_ENABLED !== "false";
const CONTEXT_QUERY_ENABLED =
  import.meta.env.VITE_FEED_WS_CONTEXT_QUERY_ENABLED !== "false";
const PING_MS = 30_000;

type Listener = (msg: WsMessage) => void;
type ParseWorkerResponse =
  | {
      kind: "message";
      message: WsMessage;
    }
  | {
      kind: "error";
      reason: string;
    };

let ws: WebSocket | null = null;
let listeners: Listener[] = [];
let pingTimer: number | null = null;
let stopped = false;
let currentContext: { siteCode?: string; parentCode?: string } = {};
let parseWorker: Worker | null = null;

export function onWsMessage(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function send(msg: Record<string, unknown>): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function buildUrl(): string {
  const url = new URL(WS_URL, window.location.href);
  if (WS_QUERY) {
    const params = new URLSearchParams(WS_QUERY.replace(/^\?/, ""));
    for (const [key, value] of params) {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }
  }
  if (CONTEXT_QUERY_ENABLED) {
    if (currentContext.siteCode && !url.searchParams.has("siteCode")) {
      url.searchParams.set("siteCode", currentContext.siteCode);
    }
    if (currentContext.parentCode && !url.searchParams.has("parentCode")) {
      url.searchParams.set("parentCode", currentContext.parentCode);
    }
  }
  return url.toString();
}

function parse(raw: string): WsMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const type = (obj.type ?? obj.eventType ?? "").toString().trim();
    if (!type) return null;
    return { ...obj, type } as WsMessage;
  } catch {
    return null;
  }
}

function dispatchMessage(msg: WsMessage | null): void {
  if (!msg) return;
  for (const fn of listeners) fn(msg);
}

function ensureParseWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (parseWorker) return parseWorker;

  parseWorker = new Worker(new URL("./workers/wsParseWorker.ts", import.meta.url), {
    type: "module",
  });

  parseWorker.onmessage = (event: MessageEvent<ParseWorkerResponse>) => {
    if (event.data.kind !== "message") return;
    dispatchMessage(event.data.message);
  };

  parseWorker.onerror = () => {
    console.warn("[ws] parse worker failed, falling back to main thread parsing");
    parseWorker?.terminate();
    parseWorker = null;
  };

  return parseWorker;
}

function connect(): void {
  if (!WS_URL || stopped) return;
  const url = buildUrl();
  console.log("[ws] connecting to", url);
  ws = new WebSocket(url);
  const worker = ensureParseWorker();
  ws.onopen = () => {
    console.log("[ws] connected");
    if (PING_ENABLED) {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = window.setInterval(() => {
        send({ type: "ping", clientTime: Date.now() });
      }, PING_MS);
    }
  };
  ws.onmessage = (e) => {
    const raw = typeof e.data === "string" ? e.data : "";
    if (!raw) return;
    if (worker) {
      worker.postMessage({ kind: "parse", raw });
      return;
    }
    dispatchMessage(parse(raw));
  };
  ws.onclose = () => {
    console.log("[ws] disconnected, reconnecting in 3s...");
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
    if (!stopped) {
      setTimeout(() => connect(), 3000);
    }
  };
  ws.onerror = () => {
    /* reconnect handled by onclose */
  };
}

export function startWs(context: { siteCode?: string; parentCode?: string }): void {
  if (!WS_URL) {
    console.warn("[ws] VITE_FEED_WS_URL not configured, skipping");
    return;
  }
  currentContext = context;
  stopped = false;
  connect();
}

export function stopWs(): void {
  stopped = true;
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  ws?.close();
  ws = null;
  parseWorker?.terminate();
  parseWorker = null;
  listeners = [];
}
