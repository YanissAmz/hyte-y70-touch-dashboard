import { createSignal, createMemo, For, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { Card } from "~/components/Card";
import { Sparkline } from "~/components/Sparkline";

const fmt = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? "—" : n.toFixed(digits);

export const Processes: Component = () => {
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
    const t1 = wsSignals.cpu.lastTs();
    const t2 = wsSignals.gpu.lastTs();
    const t3 = wsSignals.memory.lastTs();
    if (t1 && t1 !== lastCpuTs) { lastCpuTs = t1; setCpuHist((h) => [...h.slice(-59), cpu()?.usage_percent ?? 0]); }
    if (t2 && t2 !== lastGpuTs) { lastGpuTs = t2; setGpuHist((h) => [...h.slice(-59), gpu()?.utilization_percent ?? 0]); }
    if (t3 && t3 !== lastMemTs) { lastMemTs = t3; setMemHist((h) => [...h.slice(-59), mem()?.percent ?? 0]); }
  });
  void track;

  return (
    <div class="p-8 pb-32">
      <h1 class="ui-title text-4xl mb-8">Processes</h1>

      <Card>
        <h2 class="ui-title text-2xl mb-5">
          Top CPU <span class="ui-muted text-lg font-normal">({fmt(cpu()?.usage_percent)}%)</span>
        </h2>
        <div class="flex flex-col gap-3">
          <For each={procs()?.top_cpu?.slice(0, 8) ?? []} fallback={<p class="ui-muted text-base">—</p>}>
            {(p) => (
              <div class="flex items-center gap-4">
                <div class="text-base font-mono" style={{ width: "260px", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                  {p.name}
                </div>
                <div
                  style={{
                    flex: "1",
                    height: "14px",
                    background: "var(--bg-elev-2)",
                    "border-radius": "var(--radius-sm)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, p.cpu_percent)}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <div class="text-sm font-mono" style={{ width: "80px", "text-align": "right" }}>
                  {fmt(p.cpu_percent, 1)}%
                </div>
              </div>
            )}
          </For>
        </div>
      </Card>

      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-5">GPU VRAM top</h2>
        <div class="flex flex-col gap-3">
          <For each={gpu()?.top_processes?.slice(0, 5) ?? []} fallback={<p class="ui-muted text-base">—</p>}>
            {(p) => (
              <div class="flex items-center gap-4">
                <div class="text-base font-mono" style={{ width: "280px", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                  {p.name}
                </div>
                <div class="ui-muted text-sm">PID {p.pid}</div>
                <div class="text-sm font-mono ml-auto">{fmt(p.vram_mb, 0)} MB</div>
              </div>
            )}
          </For>
        </div>
      </Card>

      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-5">Per-core CPU</h2>
        <div class="grid grid-cols-8 gap-3">
          <For each={cpu()?.per_core ?? []}>
            {(v, i) => (
              <div class="flex flex-col items-center">
                <div
                  style={{
                    width: "100%",
                    height: "90px",
                    background: "var(--bg-elev-2)",
                    "border-radius": "var(--radius-sm)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: "0",
                      left: "0",
                      right: "0",
                      height: `${v}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <div class="ui-muted text-sm mt-2 font-mono">{i()}</div>
              </div>
            )}
          </For>
        </div>
      </Card>

      <div class="grid grid-cols-3 gap-6 mt-6">
        <Card>
          <h3 class="ui-title text-lg mb-3">CPU</h3>
          <Sparkline values={cpuHist()} max={100} height={140} />
        </Card>
        <Card>
          <h3 class="ui-title text-lg mb-3">GPU</h3>
          <Sparkline values={gpuHist()} max={100} height={140} />
        </Card>
        <Card>
          <h3 class="ui-title text-lg mb-3">RAM</h3>
          <Sparkline values={memHist()} max={100} height={140} />
        </Card>
      </div>
    </div>
  );
};
