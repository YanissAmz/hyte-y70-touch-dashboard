import { createMemo, createSignal, onCleanup, For, Show, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { Card } from "~/components/Card";
import { Gauge } from "~/components/Gauge";
import { Sparkline } from "~/components/Sparkline";

const fmt = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? "—" : n.toFixed(digits);

function uptimeStr(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const Main: Component = () => {
  const cpu      = wsSignals.cpu.value;
  const memory   = wsSignals.memory.value;
  const gpu      = wsSignals.gpu.value;
  const disk     = wsSignals.disk.value;
  const network  = wsSignals.network.value;
  const weather  = wsSignals.weather.value;
  const system   = wsSignals.system.value;
  const procs    = wsSignals.processes.value;
  const notifs   = wsSignals.notifications.value;

  // Clock ticker (every 30s)
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
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  });

  // Rolling history for sparklines (60 samples each, ~3-5 min depending on poll)
  const [cpuHist, setCpuHist] = createSignal<number[]>([]);
  const [gpuHist, setGpuHist] = createSignal<number[]>([]);
  const [memHist, setMemHist] = createSignal<number[]>([]);
  let lastCpuTs: number | null = null;
  let lastGpuTs: number | null = null;
  let lastMemTs: number | null = null;

  const track = createMemo(() => {
    const t1 = wsSignals.cpu.lastTs();
    const t2 = wsSignals.gpu.lastTs();
    const t3 = wsSignals.memory.lastTs();
    if (t1 && t1 !== lastCpuTs) { lastCpuTs = t1; setCpuHist(h => [...h.slice(-59), cpu()?.usage_percent ?? 0]); }
    if (t2 && t2 !== lastGpuTs) { lastGpuTs = t2; setGpuHist(h => [...h.slice(-59), gpu()?.utilization_percent ?? 0]); }
    if (t3 && t3 !== lastMemTs) { lastMemTs = t3; setMemHist(h => [...h.slice(-59), memory()?.percent ?? 0]); }
  });
  void track;

  return (
    <div class="p-8 pb-32">
      {/* ─── HEADER ───────────────────────────────────────── */}
      <header class="mb-8 flex items-start justify-between">
        <div>
          <div class="ui-title tracking-tighter leading-none" style={{ "font-size": "7.5rem" }}>
            {clock()}
          </div>
          <div class="ui-muted text-xl mt-4 uppercase tracking-widest">{date()}</div>
          <Show when={system()?.uptime_s != null}>
            <div class="ui-dim text-base mt-3 font-mono">
              {system()?.hostname} · up {uptimeStr(system()!.uptime_s)}
            </div>
          </Show>
        </div>
        <Show when={weather()}>
          {(w) => (
            <div class="text-right">
              <div class="ui-title text-7xl leading-none">{fmt(w().temp)}°</div>
              <div class="ui-muted text-sm mt-2">{w().icon}</div>
            </div>
          )}
        </Show>
      </header>

      {/* ─── GAUGES (3 columns) ───────────────────────────── */}
      <div class="grid grid-cols-3 gap-5 mb-6">
        <Card class="flex flex-col items-center py-4">
          <Gauge value={cpu()?.usage_percent ?? 0} label="CPU" unit="%" size={320} thickness={22} />
          <div class="ui-muted text-sm mt-3 text-center">
            {fmt(cpu()?.temp_c)}°C · {fmt(cpu()?.frequency_ghz, 2)} GHz
          </div>
        </Card>
        <Card class="flex flex-col items-center py-4">
          <Gauge value={gpu()?.utilization_percent ?? 0} label="GPU" unit="%" size={320} thickness={22} />
          <div class="ui-muted text-sm mt-3 text-center">
            {fmt(gpu()?.temp_c)}°C · {fmt(gpu()?.power_w)}W
          </div>
        </Card>
        <Card class="flex flex-col items-center py-4">
          <Gauge value={memory()?.percent ?? 0} label="RAM" unit="%" size={320} thickness={22} />
          <div class="ui-muted text-sm mt-3 text-center">
            {fmt(memory()?.used_gb, 1)} / {fmt(memory()?.total_gb, 1)} GB
          </div>
        </Card>
      </div>

      {/* ─── SPARKLINES (history) ─────────────────────────── */}
      <Card class="mb-6">
        <div class="flex items-baseline justify-between mb-4">
          <h2 class="ui-title text-2xl">Activity</h2>
          <span class="ui-muted text-sm">last 60 samples</span>
        </div>
        <div class="grid grid-cols-3 gap-5">
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">CPU</div>
            <Sparkline values={cpuHist()} max={100} width={320} height={140} />
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">GPU</div>
            <Sparkline values={gpuHist()} max={100} width={320} height={140} />
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">RAM</div>
            <Sparkline values={memHist()} max={100} width={320} height={140} />
          </div>
        </div>
      </Card>

      {/* ─── THERMAL + DISK (4 tiny tiles) ────────────────── */}
      <div class="grid grid-cols-4 gap-4 mb-6">
        <Card class="text-center py-6">
          <div class="ui-dim text-xs uppercase tracking-wider">CPU TEMP</div>
          <div class="ui-title text-4xl mt-2">{fmt(cpu()?.temp_c)}°</div>
        </Card>
        <Card class="text-center py-6">
          <div class="ui-dim text-xs uppercase tracking-wider">GPU TEMP</div>
          <div class="ui-title text-4xl mt-2">{fmt(gpu()?.temp_c)}°</div>
        </Card>
        <Card class="text-center py-6">
          <div class="ui-dim text-xs uppercase tracking-wider">NVME</div>
          <div class="ui-title text-4xl mt-2">{fmt(disk()?.nvme_temp_c)}°</div>
        </Card>
        <Card class="text-center py-6">
          <div class="ui-dim text-xs uppercase tracking-wider">DISK</div>
          <div class="ui-title text-4xl mt-2">{fmt(disk()?.usage_percent)}%</div>
        </Card>
      </div>

      {/* ─── NETWORK ──────────────────────────────────────── */}
      <Card class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="ui-title text-2xl">{network()?.ssid ?? "—"}</h2>
            <div class="ui-muted text-sm mt-1 font-mono">
              {network()?.ip_local ?? "—"} · {fmt(network()?.signal_dbm)} dBm
            </div>
          </div>
          <div class="text-right">
            <div class="text-xl">↓ {fmt((network()?.download_bps ?? 0) / 1e6, 1)} <span class="ui-muted text-sm">Mb/s</span></div>
            <div class="text-xl">↑ {fmt((network()?.upload_bps ?? 0) / 1e6, 1)} <span class="ui-muted text-sm">Mb/s</span></div>
            <div class="ui-muted text-sm mt-1">ping {fmt(network()?.ping_ms)} ms</div>
          </div>
        </div>
      </Card>

      {/* ─── TOP PROCESSES ────────────────────────────────── */}
      <Card class="mb-6">
        <h2 class="ui-title text-2xl mb-4">Top processes</h2>
        <div class="flex flex-col gap-3">
          <For each={procs()?.top_cpu?.slice(0, 6) ?? []} fallback={<p class="ui-muted text-base">—</p>}>
            {(p) => (
              <div class="flex items-center gap-4">
                <div class="text-base font-mono" style={{ width: "240px", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                  {p.name}
                </div>
                <div style={{ flex: "1", height: "10px", background: "var(--bg-elev-2)", "border-radius": "var(--radius-sm)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, p.cpu_percent)}%`, background: "var(--accent)" }} />
                </div>
                <div class="text-sm font-mono" style={{ width: "72px", "text-align": "right" }}>{fmt(p.cpu_percent, 1)}%</div>
              </div>
            )}
          </For>
        </div>
      </Card>

      {/* ─── NOTIFICATIONS ────────────────────────────────── */}
      <Card>
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="ui-title text-2xl">Notifications</h2>
          <span class="ui-muted text-sm">{notifs()?.list?.length ?? 0} recent</span>
        </div>
        <div class="flex flex-col gap-3">
          <For each={(notifs()?.list ?? []).slice(0, 4)} fallback={<p class="ui-muted text-base">No notifications</p>}>
            {(n) => (
              <div
                class="py-3 px-4"
                style={{ background: "var(--bg-elev-2)", "border-radius": "var(--radius-sm)", "border-left": "3px solid var(--accent)" }}
              >
                <div class="flex items-baseline justify-between">
                  <span class="text-sm font-semibold">{n.app}</span>
                  <span class="ui-dim text-xs font-mono">
                    {new Date(n.ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div class="text-base mt-1">{n.summary}</div>
                <Show when={n.body}>
                  <div class="ui-muted text-sm mt-1" style={{ "white-space": "pre-wrap" }}>{n.body}</div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Card>
    </div>
  );
};
