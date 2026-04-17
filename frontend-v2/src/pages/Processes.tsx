import { createSignal, createMemo, For, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { Sparkline } from "~/components/Sparkline";
import { usePageActivity } from "~/components/PageTrack";

const fmt = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? "—" : n.toFixed(digits);

export const Processes: Component = () => {
  const { active } = usePageActivity();
  const cpu  = wsSignals.cpu.value;
  const gpu  = wsSignals.gpu.value;
  const mem  = wsSignals.memory.value;
  const procs = wsSignals.processes.value;

  const [cpuHist, setCpuHist] = createSignal<number[]>([]);
  const [gpuHist, setGpuHist] = createSignal<number[]>([]);
  const [memHist, setMemHist] = createSignal<number[]>([]);

  let lastCpuTs: number | null = null;
  let lastGpuTs: number | null = null;
  let lastMemTs: number | null = null;

  const track = createMemo(() => {
    if (!active()) return;
    const t1 = wsSignals.cpu.lastTs();
    const t2 = wsSignals.gpu.lastTs();
    const t3 = wsSignals.memory.lastTs();
    if (t1 && t1 !== lastCpuTs) { lastCpuTs = t1; setCpuHist((h) => [...h.slice(-59), cpu()?.usage_percent ?? 0]); }
    if (t2 && t2 !== lastGpuTs) { lastGpuTs = t2; setGpuHist((h) => [...h.slice(-59), gpu()?.utilization_percent ?? 0]); }
    if (t3 && t3 !== lastMemTs) { lastMemTs = t3; setMemHist((h) => [...h.slice(-59), mem()?.percent ?? 0]); }
  });
  void track;

  const card = {
    background: "var(--bg-elev-1)",
    border: "1px solid var(--border)",
    "border-radius": "32px",
    "box-shadow": "var(--shadow-soft)",
    padding: "32px",
  } as const;

  return (
    <div style={{ height: "100vh", display: "flex", "flex-direction": "column", padding: "36px", gap: "20px", "box-sizing": "border-box" }}>
      {/* HEADER */}
      <header style={{ "flex-shrink": 0, display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>Processes</h1>
        <div class="ui-dim" style={{ "font-size": "26px", "font-family": "var(--font-mono)" }}>
          {procs()?.top_cpu?.length ?? 0} tracked
        </div>
      </header>

      {/* TOP CPU */}
      <div style={{ ...card, flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "16px" }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-title" style={{ "font-size": "40px", color: "var(--accent)" }}>Top CPU</div>
          <div style={{ "font-size": "36px", "font-weight": "700" }}>{fmt(cpu()?.usage_percent)}%</div>
        </div>
        <div style={{ flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "12px", "overflow-y": "auto" }}>
          <For each={procs()?.top_cpu?.slice(0, 8) ?? []} fallback={<p class="ui-muted" style={{ "font-size": "24px" }}>—</p>}>
            {(p) => (
              <div style={{ display: "flex", "align-items": "center", gap: "16px" }}>
                <div style={{ width: "320px", "font-size": "24px", "font-family": "var(--font-mono)", "font-weight": "600", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                  {p.name}
                </div>
                <div style={{ flex: "1", height: "32px", background: "var(--bg-elev-2)", "border-radius": "16px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, p.cpu_percent)}%`, background: "var(--accent)" }} />
                </div>
                <div style={{ width: "110px", "text-align": "right", "font-size": "26px", "font-weight": "700", "font-family": "var(--font-mono)" }}>
                  {fmt(p.cpu_percent, 1)}%
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* GPU VRAM TOP */}
      <div style={{ ...card, "flex-shrink": 0 }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline", "margin-bottom": "14px" }}>
          <div class="ui-title" style={{ "font-size": "40px", color: "var(--warn)" }}>GPU VRAM</div>
          <div style={{ "font-size": "32px", "font-weight": "700" }}>
            {fmt((gpu()?.vram_used_mb ?? 0) / 1024, 1)} / {fmt((gpu()?.vram_total_mb ?? 0) / 1024, 1)} GB
          </div>
        </div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "10px" }}>
          <For each={gpu()?.top_processes?.slice(0, 5) ?? []} fallback={<p class="ui-muted" style={{ "font-size": "24px" }}>—</p>}>
            {(p) => (
              <div style={{ display: "flex", "align-items": "center", gap: "16px" }}>
                <div style={{ flex: "1", "font-size": "24px", "font-family": "var(--font-mono)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                  {p.name}
                </div>
                <div class="ui-dim" style={{ "font-size": "20px", "font-family": "var(--font-mono)" }}>PID {p.pid}</div>
                <div style={{ width: "140px", "text-align": "right", "font-size": "26px", "font-weight": "700", "font-family": "var(--font-mono)" }}>
                  {fmt(p.vram_mb, 0)} MB
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* PER-CORE CPU */}
      <div style={{ ...card, flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div class="ui-title" style={{ "font-size": "36px", "flex-shrink": 0 }}>Per-core</div>
        <div style={{ flex: "1 1 0", "min-height": 0, display: "grid", "grid-template-columns": "repeat(8, 1fr)", gap: "10px" }}>
          <For each={cpu()?.per_core ?? []}>
            {(v, i) => (
              <div style={{ display: "flex", "flex-direction": "column", "align-items": "center", gap: "6px" }}>
                <div style={{ width: "100%", flex: "1 1 0", "min-height": 0, background: "var(--bg-elev-2)", "border-radius": "12px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${v}%`, background: "var(--accent)" }} />
                </div>
                <div class="ui-muted" style={{ "font-size": "18px", "font-family": "var(--font-mono)" }}>{i()}</div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* HISTORY SPARKLINES */}
      <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "20px", flex: "1 1 0", "min-height": 0 }}>
        <div style={{ ...card, display: "flex", "flex-direction": "column", gap: "6px" }}>
          <div class="ui-title" style={{ "font-size": "32px", color: "var(--accent)" }}>CPU</div>
          <div style={{ "font-size": "44px", "font-weight": "700" }}>{fmt(cpu()?.usage_percent)}%</div>
          <div style={{ flex: "1 1 0", "min-height": 0 }}>
            <Sparkline values={cpuHist()} max={100} height={180} active={active()} />
          </div>
        </div>
        <div style={{ ...card, display: "flex", "flex-direction": "column", gap: "6px" }}>
          <div class="ui-title" style={{ "font-size": "32px", color: "var(--warn)" }}>GPU</div>
          <div style={{ "font-size": "44px", "font-weight": "700" }}>{fmt(gpu()?.utilization_percent)}%</div>
          <div style={{ flex: "1 1 0", "min-height": 0 }}>
            <Sparkline values={gpuHist()} max={100} height={180} active={active()} />
          </div>
        </div>
        <div style={{ ...card, display: "flex", "flex-direction": "column", gap: "6px" }}>
          <div class="ui-title" style={{ "font-size": "32px", color: "var(--success)" }}>RAM</div>
          <div style={{ "font-size": "44px", "font-weight": "700" }}>{fmt(mem()?.percent)}%</div>
          <div style={{ flex: "1 1 0", "min-height": 0 }}>
            <Sparkline values={memHist()} max={100} height={180} active={active()} />
          </div>
        </div>
      </div>
    </div>
  );
};
