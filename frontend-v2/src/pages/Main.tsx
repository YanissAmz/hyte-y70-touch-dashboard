import { createEffect, createMemo, createSignal, onCleanup, Show, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { setPageIndex } from "~/stores/nav";
import { Gauge } from "~/components/Gauge";
import { usePageActivity } from "~/components/PageTrack";

// Page indices — kept in sync with App.tsx Dashboard route order.
const PAGE = { main: 0, games: 1, network: 2, processes: 3, disk: 4, sysinfo: 5 };

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
  const { active } = usePageActivity();
  const cpu     = wsSignals.cpu.value;
  const memory  = wsSignals.memory.value;
  const gpu     = wsSignals.gpu.value;
  const disk    = wsSignals.disk.value;
  const network = wsSignals.network.value;
  const weather = wsSignals.weather.value;
  const system  = wsSignals.system.value;

  const [tick, setTick] = createSignal(0);
  createEffect(() => {
    if (!active()) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    onCleanup(() => window.clearInterval(timer));
  });

  const clock = createMemo(() => {
    tick();
    return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  });
  const date = createMemo(() => {
    tick();
    return new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  });


  const card = {
    background: "var(--card-surface)",
    border: "1px solid var(--border)",
    "border-radius": "32px",
    "box-shadow": "var(--card-shadow)",
  } as const;

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", "flex-direction": "column", padding: "36px", gap: "24px", "box-sizing": "border-box" }}>
      {/* HEADER — clock + date + weather */}
      <header style={{ "flex-shrink": "0", display: "flex", "flex-direction": "column", "justify-content": "center", "text-align": "center", padding: "20px 0" }}>
        <div class="ui-title" style={{ "font-size": "220px", "font-weight": "700", "line-height": "1", "letter-spacing": "-8px", color: "var(--ambi-hero)", "text-shadow": "0 0 100px var(--ambi-glow)" }}>
          {clock()}
        </div>
        <div class="ui-muted" style={{ "font-size": "54px", "font-weight": "300", "margin-top": "24px", "text-transform": "capitalize" }}>
          {date()}
        </div>
        <Show when={weather()}>
          {(w) => (
            <div style={{ "font-size": "48px", "margin-top": "20px", display: "flex", "align-items": "center", "justify-content": "center", gap: "20px" }}>
              <span>{w().icon}</span>
              <span class="ui-title">{fmt(w().temp)}°</span>
            </div>
          )}
        </Show>
        <Show when={system()?.uptime_s != null}>
          <div class="ui-dim" style={{ "font-size": "28px", "margin-top": "18px", "font-family": "var(--font-mono)" }}>
            {system()?.hostname} · up {uptimeStr(system()!.uptime_s)}
          </div>
        </Show>
      </header>

      {/* CPU + RAM row */}
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "24px", flex: "1 1 0", "min-height": "0" }}>
        <div onClick={() => setPageIndex(PAGE.processes)} style={{ ...card, padding: "40px", display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "space-between", cursor: "pointer" }}>
          <div style={{ "align-self": "stretch", display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
            <div class="ui-title" style={{ "font-size": "52px", color: "var(--accent)" }}>CPU</div>
            <div class="ui-dim" style={{ "font-size": "24px" }}>{system()?.cpu_model?.split(" ").slice(0, 3).join(" ") ?? ""}</div>
          </div>
          <Gauge value={cpu()?.usage_percent ?? 0} unit="%" size={460} thickness={30} active={active()} />
          <div style={{ "align-self": "stretch", display: "flex", "justify-content": "space-around", "font-size": "40px", "font-weight": "700" }}>
            <span>{fmt(cpu()?.temp_c)}°C</span>
            <span>{fmt(cpu()?.frequency_ghz, 2)} GHz</span>
          </div>
        </div>
        <div onClick={() => setPageIndex(PAGE.processes)} style={{ ...card, padding: "40px", display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "space-between", cursor: "pointer" }}>
          <div style={{ "align-self": "stretch", display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
            <div class="ui-title" style={{ "font-size": "52px", color: "var(--success)" }}>RAM</div>
            <div class="ui-dim" style={{ "font-size": "24px" }}>{system()?.ram_model ?? ""}</div>
          </div>
          <Gauge value={memory()?.percent ?? 0} unit="%" size={460} thickness={30} active={active()} />
          <div style={{ "font-size": "40px", "font-weight": "700" }}>
            {fmt(memory()?.used_gb, 1)} / {fmt(memory()?.total_gb, 1)} GB
          </div>
        </div>
      </div>

      {/* GPU */}
      <div onClick={() => setPageIndex(PAGE.processes)} style={{ ...card, padding: "40px", flex: "1 1 0", "min-height": "0", display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "space-between", cursor: "pointer" }}>
        <div style={{ "align-self": "stretch", display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-title" style={{ "font-size": "52px", color: "var(--warn)" }}>GPU</div>
          <div class="ui-dim" style={{ "font-size": "24px" }}>{system()?.gpu_model ?? ""}</div>
        </div>
        <Gauge value={gpu()?.utilization_percent ?? 0} unit="%" size={720} thickness={44} active={active()} />
        <div style={{ "align-self": "stretch", display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "20px", "text-align": "center" }}>
          <div>
            <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>TEMP</div>
            <div style={{ "font-size": "40px", "font-weight": "700", "margin-top": "6px" }}>{fmt(gpu()?.temp_c)}°C</div>
          </div>
          <div>
            <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>POWER</div>
            <div style={{ "font-size": "40px", "font-weight": "700", "margin-top": "6px" }}>{fmt(gpu()?.power_w)}W</div>
          </div>
          <div>
            <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>VRAM</div>
            <div style={{ "font-size": "40px", "font-weight": "700", "margin-top": "6px" }}>{fmt((gpu()?.vram_used_mb ?? 0) / 1024, 1)}G</div>
          </div>
        </div>
      </div>

      {/* DISK + NETWORK row */}
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "24px", flex: "1 1 0", "min-height": "0" }}>
        <div onClick={() => setPageIndex(PAGE.disk)} style={{ ...card, padding: "36px", display: "flex", "flex-direction": "column", "justify-content": "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
            <div class="ui-title" style={{ "font-size": "48px", color: "var(--accent)" }}>DISK</div>
            <div class="ui-dim" style={{ "font-size": "24px" }}>{fmt(disk()?.nvme_temp_c)}°C</div>
          </div>
          <div style={{ "text-align": "center" }}>
            <div style={{ "font-size": "140px", "font-weight": "700", "line-height": "1", color: "var(--ambi-hero)", "text-shadow": "0 0 60px var(--ambi-glow)" }}>{fmt(disk()?.usage_percent)}<span style={{ "font-size": "56px" }}>%</span></div>
          </div>
          <div>
            <div style={{ height: "18px", background: "var(--bg-elev-2)", "border-radius": "9px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, disk()?.usage_percent ?? 0)}%`, background: "var(--ambi-accent)" }} />
            </div>
            <div class="ui-muted" style={{ "font-size": "28px", "margin-top": "12px", "text-align": "center" }}>
              {fmt(disk()?.used_gb)} / {fmt(disk()?.total_gb)} GB
            </div>
          </div>
        </div>

        <div onClick={() => setPageIndex(PAGE.network)} style={{ ...card, padding: "36px", display: "flex", "flex-direction": "column", "justify-content": "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
            <div class="ui-title" style={{ "font-size": "48px", color: "var(--success)" }}>NET</div>
            <div class="ui-dim" style={{ "font-size": "24px" }}>{fmt(network()?.ping_ms)} ms</div>
          </div>
          <div style={{ "text-align": "center" }}>
            <div style={{ "font-size": "100px", "font-weight": "700", "line-height": "1", color: "var(--ambi-hero)", "text-shadow": "0 0 50px var(--ambi-glow)" }}>
              {network()?.link_speed_mbps
                ? (network()!.link_speed_mbps! >= 1000 ? `${(network()!.link_speed_mbps! / 1000).toFixed(0)}` : `${network()!.link_speed_mbps}`)
                : "—"}
              <span style={{ "font-size": "40px" }}>
                {network()?.link_speed_mbps && network()!.link_speed_mbps! >= 1000 ? " Gb/s" : " Mb/s"}
              </span>
            </div>
            <div style={{ display: "flex", "justify-content": "center", gap: "28px", "margin-top": "10px", "font-size": "26px", "font-weight": "700" }}>
              <span style={{ color: "var(--success)" }}>↓ {fmt((network()?.download_bps ?? 0) / 1e6, 1)} Mb/s</span>
              <span style={{ color: "var(--warn)" }}>↑ {fmt((network()?.upload_bps ?? 0) / 1e6, 1)} Mb/s</span>
            </div>
          </div>
          <div>
            <div style={{ height: "18px", background: "var(--bg-elev-2)", "border-radius": "9px", overflow: "hidden", position: "relative" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, ((network()?.download_bps ?? 0) / 1e6) / Math.max(1, network()?.link_speed_mbps ?? 1000) * 100)}%`,
                background: "var(--success)",
              }} />
            </div>
            <div class="ui-muted" style={{ "font-size": "28px", "margin-top": "12px", "text-align": "center" }}>
              {network()?.iface_type === "ethernet" ? "Ethernet" : (network()?.ssid ?? "—")} · {network()?.ip_local ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
