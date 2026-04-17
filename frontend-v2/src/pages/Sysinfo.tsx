import { createSignal, createMemo, For, Show, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { Sparkline } from "~/components/Sparkline";
import { usePageActivity } from "~/components/PageTrack";

const fmt = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? "—" : n.toFixed(digits);

function uptimeStr(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const Sysinfo: Component = () => {
  const { active } = usePageActivity();
  const system = wsSignals.system.value;
  const disk   = wsSignals.disk.value;
  const cpu    = wsSignals.cpu.value;
  const gpu    = wsSignals.gpu.value;
  const memory = wsSignals.memory.value;
  const ollama = wsSignals.ollama.value;

  const [cpuTempHist, setCpuTempHist] = createSignal<number[]>([]);
  const [gpuTempHist, setGpuTempHist] = createSignal<number[]>([]);
  const [diskTempHist, setDiskTempHist] = createSignal<number[]>([]);
  const [ioReadHist, setIoReadHist]   = createSignal<number[]>([]);
  const [ioWriteHist, setIoWriteHist] = createSignal<number[]>([]);

  let lastCpuTs: number | null = null;
  let lastGpuTs: number | null = null;
  let lastDiskTs: number | null = null;

  const track = createMemo(() => {
    if (!active()) return;
    const c = wsSignals.cpu.lastTs();
    const g = wsSignals.gpu.lastTs();
    const d = wsSignals.disk.lastTs();
    if (c && c !== lastCpuTs)  { lastCpuTs  = c; setCpuTempHist(h  => [...h.slice(-59), cpu()?.temp_c ?? 0]); }
    if (g && g !== lastGpuTs)  { lastGpuTs  = g; setGpuTempHist(h  => [...h.slice(-59), gpu()?.temp_c ?? 0]); }
    if (d && d !== lastDiskTs) {
      lastDiskTs = d;
      setDiskTempHist(h => [...h.slice(-59), disk()?.nvme_temp_c ?? 0]);
      setIoReadHist(h  => [...h.slice(-59), (disk()?.io_read_bps  ?? 0) / 1e6]);
      setIoWriteHist(h => [...h.slice(-59), (disk()?.io_write_bps ?? 0) / 1e6]);
    }
  });
  void track;

  const card = {
    background: "var(--card-surface)",
    border: "1px solid var(--border)",
    "border-radius": "32px",
    "box-shadow": "var(--card-shadow)",
    padding: "28px",
  } as const;

  const Hw = (props: { label: string; model: string; value: string; detail: string; color: string }) => (
    <div style={{ ...card, display: "flex", "flex-direction": "column", "justify-content": "space-between", gap: "10px" }}>
      <div>
        <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>{props.label}</div>
        <div style={{ "font-size": "26px", "font-weight": "600", "margin-top": "4px", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>{props.model}</div>
      </div>
      <div style={{ "font-size": "72px", "font-weight": "700", "line-height": "1", color: props.color, "text-align": "center" }}>
        {props.value}
      </div>
      <div class="ui-muted" style={{ "font-size": "22px", "text-align": "center" }}>{props.detail}</div>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", "flex-direction": "column", padding: "36px", gap: "18px", "box-sizing": "border-box" }}>
      {/* HEADER */}
      <header style={{ "flex-shrink": 0 }}>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>System</h1>
        <div style={{ display: "grid", "grid-template-columns": "repeat(4, 1fr)", gap: "20px", "margin-top": "14px", "font-size": "22px" }}>
          <div>
            <div class="ui-dim" style={{ "text-transform": "uppercase", "letter-spacing": "2px" }}>Host</div>
            <div style={{ "font-family": "var(--font-mono)", "font-weight": "600" }}>{system()?.hostname ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim" style={{ "text-transform": "uppercase", "letter-spacing": "2px" }}>Uptime</div>
            <div style={{ "font-family": "var(--font-mono)", "font-weight": "600" }}>
              {system()?.uptime_s != null ? uptimeStr(system()!.uptime_s) : "—"}
            </div>
          </div>
          <div>
            <div class="ui-dim" style={{ "text-transform": "uppercase", "letter-spacing": "2px" }}>OS</div>
            <div style={{ "font-family": "var(--font-mono)", "font-weight": "600", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
              {system()?.os ?? "—"}
            </div>
          </div>
          <div>
            <div class="ui-dim" style={{ "text-transform": "uppercase", "letter-spacing": "2px" }}>Kernel</div>
            <div style={{ "font-family": "var(--font-mono)", "font-weight": "600", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
              {system()?.kernel ?? "—"}
            </div>
          </div>
        </div>
      </header>

      {/* HARDWARE GRID 2x2 */}
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "18px", flex: "1 1 0", "min-height": 0 }}>
        <Hw
          label="CPU"
          model={system()?.cpu_model ?? "—"}
          value={`${fmt(cpu()?.temp_c)}°`}
          detail={`${cpu()?.per_core?.length ?? "—"} cores · ${fmt(cpu()?.frequency_ghz, 2)} GHz`}
          color="var(--accent)"
        />
        <Hw
          label="GPU"
          model={system()?.gpu_model ?? "—"}
          value={`${fmt(gpu()?.temp_c)}°`}
          detail={`${fmt(gpu()?.power_w)}W · ${fmt((gpu()?.vram_used_mb ?? 0) / 1024, 1)}/${fmt((gpu()?.vram_total_mb ?? 0) / 1024, 1)} GB`}
          color="var(--warn)"
        />
        <Hw
          label="RAM"
          model={system()?.ram_model ?? "—"}
          value={`${fmt(memory()?.percent)}%`}
          detail={`${fmt(memory()?.used_gb, 1)} / ${fmt(memory()?.total_gb, 1)} GB`}
          color="var(--success)"
        />
        <Hw
          label="NVMe"
          model={system()?.disk_model ?? "—"}
          value={`${fmt(disk()?.nvme_temp_c)}°`}
          detail={`${fmt(disk()?.used_gb, 0)} / ${fmt(disk()?.total_gb, 0)} GB`}
          color="var(--accent)"
        />
      </div>

      {/* THERMAL HISTORY */}
      <div style={{ ...card, flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div class="ui-title" style={{ "font-size": "36px", "flex-shrink": 0 }}>Thermal</div>
        <div style={{ flex: "1 1 0", "min-height": 0, display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "18px" }}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>CPU</div>
            <div style={{ "font-size": "38px", "font-weight": "700" }}>{fmt(cpu()?.temp_c)}°C</div>
            <div style={{ flex: "1 1 0", "min-height": 0 }}>
              <Sparkline values={cpuTempHist()} max={100} height={160} active={active()} />
            </div>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>GPU</div>
            <div style={{ "font-size": "38px", "font-weight": "700" }}>{fmt(gpu()?.temp_c)}°C</div>
            <div style={{ flex: "1 1 0", "min-height": 0 }}>
              <Sparkline values={gpuTempHist()} max={100} height={160} active={active()} />
            </div>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>NVMe</div>
            <div style={{ "font-size": "38px", "font-weight": "700" }}>{fmt(disk()?.nvme_temp_c)}°C</div>
            <div style={{ flex: "1 1 0", "min-height": 0 }}>
              <Sparkline values={diskTempHist()} max={100} height={160} active={active()} />
            </div>
          </div>
        </div>
      </div>

      {/* DISK I/O */}
      <div style={{ ...card, flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div class="ui-title" style={{ "font-size": "36px", "flex-shrink": 0 }}>Disk I/O</div>
        <div style={{ flex: "1 1 0", "min-height": 0, display: "grid", "grid-template-columns": "1fr 1fr", gap: "18px" }}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Read</div>
            <div style={{ "font-size": "38px", "font-weight": "700", color: "var(--success)" }}>{fmt((disk()?.io_read_bps ?? 0) / 1e6, 1)} MB/s</div>
            <div style={{ flex: "1 1 0", "min-height": 0 }}>
              <Sparkline values={ioReadHist()} height={160} active={active()} />
            </div>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Write</div>
            <div style={{ "font-size": "38px", "font-weight": "700", color: "var(--warn)" }}>{fmt((disk()?.io_write_bps ?? 0) / 1e6, 1)} MB/s</div>
            <div style={{ flex: "1 1 0", "min-height": 0 }}>
              <Sparkline values={ioWriteHist()} height={160} active={active()} />
            </div>
          </div>
        </div>
      </div>

      {/* SERVICES + DOCKER */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-title" style={{ "font-size": "36px" }}>Services</div>
          <div class="ui-muted" style={{ "font-size": "22px" }}>Docker: {system()?.docker_containers?.length ?? 0}</div>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "16px", padding: "16px 22px", background: "var(--bg-elev-2)", "border-radius": "18px" }}>
          <span style={{ width: "18px", height: "18px", "border-radius": "50%", background: ollama()?.running ? "var(--success)" : "var(--text-dim)" }} />
          <span style={{ "font-size": "26px", "font-weight": "700" }}>Ollama</span>
          <span class="ui-muted" style={{ "font-size": "22px", "margin-left": "auto" }}>
            {ollama()?.running ? "Running" : "Stopped"}{ollama()?.model ? ` · ${ollama()?.model}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          <For each={system()?.docker_containers ?? []} fallback={<p class="ui-muted" style={{ "font-size": "22px" }}>No containers</p>}>
            {(c) => (
              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", padding: "14px 22px", background: "var(--bg-elev-2)", "border-radius": "16px" }}>
                <div>
                  <div style={{ "font-size": "24px", "font-weight": "700", "font-family": "var(--font-mono)" }}>{c.name}</div>
                  <Show when={c.image}>
                    <div class="ui-dim" style={{ "font-size": "18px", "font-family": "var(--font-mono)", "margin-top": "2px" }}>{c.image}</div>
                  </Show>
                </div>
                <span class="ui-muted" style={{ "font-size": "22px" }}>{c.status}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};
