import { createSignal, createMemo, For, Show, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { Card } from "~/components/Card";
import { Sparkline } from "~/components/Sparkline";

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
  const system = wsSignals.system.value;
  const disk   = wsSignals.disk.value;
  const cpu    = wsSignals.cpu.value;
  const gpu    = wsSignals.gpu.value;
  const memory = wsSignals.memory.value;
  const ollama = wsSignals.ollama.value;

  // Temperature + I/O histories
  const [cpuTempHist, setCpuTempHist] = createSignal<number[]>([]);
  const [gpuTempHist, setGpuTempHist] = createSignal<number[]>([]);
  const [diskTempHist, setDiskTempHist] = createSignal<number[]>([]);
  const [ioReadHist, setIoReadHist]   = createSignal<number[]>([]);
  const [ioWriteHist, setIoWriteHist] = createSignal<number[]>([]);

  let lastCpuTs: number | null = null;
  let lastGpuTs: number | null = null;
  let lastDiskTs: number | null = null;

  const track = createMemo(() => {
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

  return (
    <div class="p-8 pb-32">
      <h1 class="ui-title text-4xl mb-8">System</h1>

      {/* Host info */}
      <Card>
        <div class="grid grid-cols-2 gap-6">
          <div>
            <div class="ui-dim text-sm uppercase tracking-wider">Host</div>
            <div class="font-mono text-xl mt-1">{system()?.hostname ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim text-sm uppercase tracking-wider">Uptime</div>
            <div class="font-mono text-xl mt-1">{system()?.uptime_s != null ? uptimeStr(system()!.uptime_s) : "—"}</div>
          </div>
          <div>
            <div class="ui-dim text-sm uppercase tracking-wider">OS</div>
            <div class="font-mono text-base mt-1">{system()?.os ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim text-sm uppercase tracking-wider">Kernel</div>
            <div class="font-mono text-base mt-1">{system()?.kernel ?? "—"}</div>
          </div>
        </div>
      </Card>

      {/* Hardware grid */}
      <div class="grid grid-cols-2 gap-5 mt-6">
        <Card>
          <div class="ui-dim text-sm uppercase tracking-wider">CPU</div>
          <div class="font-semibold text-lg mt-1">{system()?.cpu_model ?? "—"}</div>
          <div class="ui-muted text-sm mt-2">
            {cpu()?.per_core?.length ?? "—"} cores · {fmt(cpu()?.temp_c)}°C · {fmt(cpu()?.frequency_ghz, 2)} GHz
          </div>
        </Card>
        <Card>
          <div class="ui-dim text-sm uppercase tracking-wider">GPU</div>
          <div class="font-semibold text-lg mt-1">{system()?.gpu_model ?? "—"}</div>
          <div class="ui-muted text-sm mt-2">
            {fmt(gpu()?.temp_c)}°C · {fmt(gpu()?.power_w)}W · {fmt((gpu()?.vram_used_mb ?? 0) / 1024, 1)} / {fmt((gpu()?.vram_total_mb ?? 0) / 1024, 1)} GB VRAM
          </div>
        </Card>
        <Card>
          <div class="ui-dim text-sm uppercase tracking-wider">RAM</div>
          <div class="font-semibold text-lg mt-1">{system()?.ram_model ?? "—"}</div>
          <div class="ui-muted text-sm mt-2">
            {fmt(memory()?.used_gb, 1)} / {fmt(memory()?.total_gb, 1)} GB · {fmt(memory()?.percent)}%
          </div>
        </Card>
        <Card>
          <div class="ui-dim text-sm uppercase tracking-wider">Disk</div>
          <div class="font-semibold text-lg mt-1">{system()?.disk_model ?? "—"}</div>
          <div class="ui-muted text-sm mt-2">
            {fmt(disk()?.used_gb, 0)} / {fmt(disk()?.total_gb, 0)} GB · {fmt(disk()?.nvme_temp_c)}°C
          </div>
        </Card>
      </div>

      {/* Thermal history */}
      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">Thermal history</h2>
        <div class="grid grid-cols-3 gap-5">
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">CPU</div>
            <Sparkline values={cpuTempHist()} max={100} height={160} />
            <div class="ui-muted text-sm mt-1">{fmt(cpu()?.temp_c)}°C</div>
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">GPU</div>
            <Sparkline values={gpuTempHist()} max={100} height={160} />
            <div class="ui-muted text-sm mt-1">{fmt(gpu()?.temp_c)}°C</div>
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">NVMe</div>
            <Sparkline values={diskTempHist()} max={100} height={160} />
            <div class="ui-muted text-sm mt-1">{fmt(disk()?.nvme_temp_c)}°C</div>
          </div>
        </div>
      </Card>

      {/* Disk I/O */}
      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">Disk I/O <span class="ui-muted text-base font-normal">(Mb/s)</span></h2>
        <div class="grid grid-cols-2 gap-5">
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">Read</div>
            <Sparkline values={ioReadHist()} height={160} />
            <div class="ui-muted text-sm mt-1">{fmt((disk()?.io_read_bps ?? 0) / 1e6, 1)} MB/s</div>
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider mb-1">Write</div>
            <Sparkline values={ioWriteHist()} height={160} />
            <div class="ui-muted text-sm mt-1">{fmt((disk()?.io_write_bps ?? 0) / 1e6, 1)} MB/s</div>
          </div>
        </div>
      </Card>

      {/* Services */}
      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">Services</h2>
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-4 py-2 px-4" style={{ background: "var(--bg-elev-2)", "border-radius": "var(--radius-sm)" }}>
            <span style={{
              width: "14px", height: "14px", "border-radius": "50%",
              background: ollama()?.running ? "var(--success)" : "var(--text-dim)",
            }} />
            <span class="text-lg font-semibold">Ollama</span>
            <span class="ui-muted text-sm ml-auto">
              {ollama()?.running ? "Running" : "Stopped"}{ollama()?.model ? ` · ${ollama()?.model}` : ""}
            </span>
          </div>
        </div>
      </Card>

      {/* Docker */}
      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">
          Docker <span class="ui-muted text-base font-normal">({system()?.docker_containers?.length ?? 0})</span>
        </h2>
        <div class="flex flex-col gap-3">
          <For each={system()?.docker_containers ?? []} fallback={<p class="ui-muted text-base">No containers</p>}>
            {(c) => (
              <div class="flex items-center justify-between py-3 px-4" style={{ background: "var(--bg-elev-2)", "border-radius": "var(--radius-sm)" }}>
                <div>
                  <div class="text-base font-mono font-semibold">{c.name}</div>
                  <Show when={c.image}><div class="ui-dim text-xs font-mono mt-1">{c.image}</div></Show>
                </div>
                <span class="ui-muted text-sm">{c.status}</span>
              </div>
            )}
          </For>
        </div>
      </Card>
    </div>
  );
};
