/**
 * WebSocket store — exposes a reactive signal per message type.
 *
 * Each message type has its own SolidJS signal. Subscribers read only the
 * signal they care about (no vDOM, no component re-renders for unrelated
 * updates). Auto-reconnect with exponential backoff on disconnect.
 */

import { createSignal, type Accessor } from "solid-js";
import type {
  DataFor,
  WsMessage,
  WsMessageType,
  Envelope,
} from "~/types/ws";

type Signals = {
  [K in WsMessageType]: {
    value: Accessor<DataFor<K> | null>;
    set: (v: DataFor<K>) => void;
    lastTs: Accessor<number | null>;
  };
};

function buildSignals(): Signals {
  const types: WsMessageType[] = [
    "cpu", "memory", "gpu", "disk", "network", "wifi_scan",
    "weather", "processes", "system", "ollama", "notifications", "ambilight",
  ];
  const out = {} as Signals;
  for (const t of types) {
    const [value, set] = createSignal<DataFor<typeof t> | null>(null);
    const [lastTs, setTs] = createSignal<number | null>(null);
    (out as Record<string, unknown>)[t] = {
      value,
      set: (v: DataFor<typeof t>) => { set(() => v); setTs(Date.now()); },
      lastTs,
    };
  }
  return out;
}

export const wsSignals = buildSignals();

const [wsStatus, setWsStatus] = createSignal<"connecting" | "open" | "closed">("connecting");
export { wsStatus };

let ws: WebSocket | null = null;
let reconnectDelay = 500;

function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function connect(): void {
  setWsStatus("connecting");
  ws = new WebSocket(wsUrl());

  ws.addEventListener("open", () => {
    setWsStatus("open");
    reconnectDelay = 500;
  });

  ws.addEventListener("message", (ev) => {
    let msg: Envelope<WsMessage>;
    try {
      msg = JSON.parse(ev.data) as Envelope<WsMessage>;
    } catch {
      return;
    }
    const entry = wsSignals[msg.type as WsMessageType] as
      | { set: (v: unknown) => void } | undefined;
    if (entry) entry.set(msg.data);
  });

  ws.addEventListener("close", () => {
    setWsStatus("closed");
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10_000);
  });

  ws.addEventListener("error", () => {
    ws?.close();
  });
}

/** Start the WebSocket connection. Call once on app mount. */
export function startWs(): void {
  if (ws) return;
  connect();
}
