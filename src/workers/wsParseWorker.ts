import type { WsMessage } from "../types";

type WorkerRequest =
  | {
      kind: "parse";
      raw: string;
    }
  | {
      kind: "reset";
    };

type WorkerResponse =
  | {
      kind: "message";
      message: WsMessage;
    }
  | {
      kind: "error";
      reason: string;
    };

function toWsMessage(raw: string): WsMessage | null {
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

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.kind === "reset") {
    return;
  }

  const message = toWsMessage(event.data.raw);
  if (!message) {
    const response: WorkerResponse = {
      kind: "error",
      reason: "invalid_ws_message",
    };
    self.postMessage(response);
    return;
  }

  const response: WorkerResponse = {
    kind: "message",
    message,
  };
  self.postMessage(response);
};
