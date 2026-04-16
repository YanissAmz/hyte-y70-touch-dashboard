import { createMemo, createSignal, onCleanup, Show, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { Card } from "~/components/Card";
import { TileGrid } from "~/components/TileGrid";
import { Gauge } from "~/components/Gauge";

const fmt = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? "—" : n.toFixed(digits);

export const Main: Component = () => {
  const cpu      = wsSignals.cpu.value;
  const memory   = wsSignals.memory.value;
  const gpu      = wsSignals.gpu.value;
  const disk     = wsSignals.disk.value;
  const network  = wsSignals.network.value;
  const weather  = wsSignals.weather.value;

  // Tick every minute (clock) — any signal read inside clock()/date() memos
  // re-runs when tick changes.
  const [tick, setTick] = createSignal(0);
  const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
  onCleanup(() => window.clearInterval(timer));

  const clock = createMemo(() => {
    tick();
    const d = new Date();
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  });

  const date = createMemo(() => {
    tick();
    const d = new Date();
    return d.toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  });

  return (
    <div class="p-5 pb-24">
      {/* Header: clock + weather */}
      <header class="mb-6 flex items-center justify-between">
        <div>
          <div class="ui-title text-6xl tracking-tighter">{clock()}</div>
          <div class="ui-muted text-sm mt-1 uppercase tracking-wider">{date()}</div>
        </div>
        <Show when={weather()}>
          {(w) => (
            <div class="text-right">
              <div class="ui-title text-3xl">{fmt(w().temp)}°</div>
              <div class="ui-muted text-xs">{w().icon}</div>
            </div>
          )}
        </Show>
      </header>

      {/* Gauges */}
      <TileGrid columns={2} gap={12}>
        <Card class="flex flex-col items-center py-4">
          <Gauge value={cpu()?.usage_percent ?? 0} label="CPU" unit="%" size={200} />
          <div class="ui-muted text-xs mt-2">
            {fmt(cpu()?.temp_c)}°C · {fmt(cpu()?.frequency_ghz, 2)} GHz
          </div>
        </Card>

        <Card class="flex flex-col items-center py-4">
          <Gauge value={memory()?.percent ?? 0} label="RAM" unit="%" size={200} />
          <div class="ui-muted text-xs mt-2">
            {fmt(memory()?.used_gb, 1)} / {fmt(memory()?.total_gb, 1)} GB
          </div>
        </Card>

        <Card class="flex flex-col items-center py-4">
          <Gauge value={gpu()?.utilization_percent ?? 0} label="GPU" unit="%" size={200} />
          <div class="ui-muted text-xs mt-2">
            {fmt(gpu()?.temp_c)}°C · {fmt(gpu()?.power_w)}W · {fmt(gpu()?.vram_percent)}% VRAM
          </div>
        </Card>

        <Card class="flex flex-col items-center py-4">
          <Gauge value={disk()?.usage_percent ?? 0} label="DISK" unit="%" size={200} />
          <div class="ui-muted text-xs mt-2">
            {fmt(disk()?.used_gb, 0)} / {fmt(disk()?.total_gb, 0)} GB · {fmt(disk()?.nvme_temp_c)}°C
          </div>
        </Card>
      </TileGrid>

      {/* Network summary */}
      <Card class="mt-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="ui-title text-lg">{network()?.ssid ?? "—"}</div>
            <div class="ui-muted text-xs mt-1">
              {network()?.ip_local ?? "—"} · {fmt(network()?.signal_dbm)} dBm
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm">
              ↓ {fmt((network()?.download_bps ?? 0) / 1_000_000, 1)} Mb/s
            </div>
            <div class="text-sm">
              ↑ {fmt((network()?.upload_bps ?? 0) / 1_000_000, 1)} Mb/s
            </div>
            <div class="ui-muted text-xs mt-1">
              ping {fmt(network()?.ping_ms)} ms
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
