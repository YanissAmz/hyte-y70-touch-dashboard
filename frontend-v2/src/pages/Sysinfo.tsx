import { For, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { Card } from "~/components/Card";

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
  const ollama = wsSignals.ollama.value;

  return (
    <div class="p-5 pb-24">
      <h1 class="ui-title text-2xl mb-4">System</h1>

      <Card>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="ui-muted text-xs uppercase">Host</div>
            <div class="font-mono">{system()?.hostname ?? "—"}</div>
          </div>
          <div>
            <div class="ui-muted text-xs uppercase">Uptime</div>
            <div class="font-mono">{system()?.uptime_s != null ? uptimeStr(system()!.uptime_s) : "—"}</div>
          </div>
          <div>
            <div class="ui-muted text-xs uppercase">OS</div>
            <div class="font-mono">{system()?.os ?? "—"}</div>
          </div>
          <div>
            <div class="ui-muted text-xs uppercase">Kernel</div>
            <div class="font-mono text-sm">{system()?.kernel ?? "—"}</div>
          </div>
        </div>
      </Card>

      <div class="grid grid-cols-2 gap-4 mt-4">
        <Card>
          <div class="ui-muted text-xs uppercase">CPU</div>
          <div class="font-semibold text-sm mt-1">{system()?.cpu_model ?? "—"}</div>
          <div class="ui-muted text-xs mt-1">{fmt(cpu()?.temp_c)}°C · {fmt(cpu()?.frequency_ghz, 2)} GHz</div>
        </Card>
        <Card>
          <div class="ui-muted text-xs uppercase">GPU</div>
          <div class="font-semibold text-sm mt-1">{system()?.gpu_model ?? "—"}</div>
          <div class="ui-muted text-xs mt-1">{fmt(gpu()?.temp_c)}°C · {fmt((gpu()?.vram_used_mb ?? 0) / 1024, 1)} GB VRAM</div>
        </Card>
        <Card>
          <div class="ui-muted text-xs uppercase">RAM</div>
          <div class="font-semibold text-sm mt-1">{system()?.ram_model ?? "—"}</div>
        </Card>
        <Card>
          <div class="ui-muted text-xs uppercase">Disk</div>
          <div class="font-semibold text-sm mt-1">{system()?.disk_model ?? "—"}</div>
          <div class="ui-muted text-xs mt-1">
            {fmt(disk()?.used_gb, 0)} / {fmt(disk()?.total_gb, 0)} GB · {fmt(disk()?.nvme_temp_c)}°C
          </div>
        </Card>
      </div>

      <Card class="mt-4">
        <h2 class="ui-title text-lg mb-3">Ollama service</h2>
        <div class="flex items-center gap-3">
          <span
            style={{
              width: "10px",
              height: "10px",
              "border-radius": "50%",
              background: ollama()?.running ? "var(--success)" : "var(--text-dim)",
            }}
          />
          <span class="text-sm">
            {ollama()?.running ? "Running" : "Stopped"}
            {ollama()?.model ? ` · ${ollama()?.model}` : ""}
          </span>
        </div>
      </Card>

      <Card class="mt-4">
        <h2 class="ui-title text-lg mb-3">
          Docker <span class="ui-muted text-sm font-normal">({system()?.docker_containers?.length ?? 0})</span>
        </h2>
        <div class="flex flex-col gap-2">
          <For each={system()?.docker_containers ?? []} fallback={<p class="ui-muted text-sm">None</p>}>
            {(c) => (
              <div class="flex items-center justify-between py-1">
                <span class="text-sm font-mono">{c.name}</span>
                <span class="ui-muted text-xs">{c.status}</span>
              </div>
            )}
          </For>
        </div>
      </Card>
    </div>
  );
};
