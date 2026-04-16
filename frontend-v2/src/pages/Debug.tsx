import { For, createMemo, type Component } from "solid-js";
import { wsSignals, wsStatus } from "~/stores/ws";
import type { WsMessageType } from "~/types/ws";

const TYPES: WsMessageType[] = [
  "cpu", "memory", "gpu", "disk", "network", "wifi_scan",
  "weather", "processes", "system", "ollama", "notifications", "ambilight",
];

export const Debug: Component = () => {
  const rows = createMemo(() =>
    TYPES.map((t) => ({
      type: t,
      value: wsSignals[t].value(),
      ts: wsSignals[t].lastTs(),
    })),
  );

  return (
    <div class="p-6 min-h-screen">
      <header class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight">v2 Debug</h1>
        <p class="text-sm text-neutral-400">
          WS status: <span class="font-mono">{wsStatus()}</span>
        </p>
      </header>

      <div class="space-y-4">
        <For each={rows()}>
          {(row) => (
            <section class="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
              <div class="flex justify-between items-baseline">
                <h2 class="text-lg font-semibold">{row.type}</h2>
                <span class="text-xs text-neutral-500 font-mono">
                  {row.ts ? new Date(row.ts).toLocaleTimeString() : "—"}
                </span>
              </div>
              <pre class="mt-2 text-xs font-mono text-neutral-300 whitespace-pre-wrap break-all">
                {row.value === null ? "(no data yet)" : JSON.stringify(row.value, null, 2)}
              </pre>
            </section>
          )}
        </For>
      </div>
    </div>
  );
};
