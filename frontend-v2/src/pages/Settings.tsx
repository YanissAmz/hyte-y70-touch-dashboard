import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";
import { theme, setTheme, type Theme } from "~/stores/theme";
import { wsSignals } from "~/stores/ws";
import { Card } from "~/components/Card";
import { Button } from "~/components/Button";

type Volume = { level: number; muted: boolean };
type BtDevice = { address: string; name: string; connected: boolean };

const THEMES: { id: Theme; label: string; desc: string }[] = [
  { id: "a", label: "A · Minimalist", desc: "Sky blue on near-black" },
  { id: "b", label: "B · Anime",      desc: "Warm explosion orange" },
  { id: "c", label: "C · Cyberpunk",  desc: "Neon magenta + cyan" },
];

export const Settings: Component = () => {
  const system = wsSignals.system.value;

  const [volume, setVolume]  = createSignal<number>(50);
  const [muted, setMuted]    = createSignal<boolean>(false);
  const [btDevs, setBtDevs]  = createSignal<BtDevice[]>([]);
  const [scanning, setScanning] = createSignal<boolean>(false);
  const [brightness, setBrightness] = createSignal<number>(80);

  let volumeTimer: number | undefined;
  let brightnessTimer: number | undefined;

  const loadVolume = async (): Promise<void> => {
    try {
      const v = await apiGet<Volume>("/api/volume");
      setVolume(v.level);
      setMuted(v.muted);
    } catch { /* ignore */ }
  };

  const loadBt = async (): Promise<void> => {
    try { setBtDevs(await apiGet<BtDevice[]>("/api/bluetooth")); } catch { /* ignore */ }
  };

  onMount(() => {
    void loadVolume();
    void loadBt();
  });

  const onVolume = (e: InputEvent): void => {
    const level = parseInt((e.currentTarget as HTMLInputElement).value);
    setVolume(level);
    if (volumeTimer) window.clearTimeout(volumeTimer);
    volumeTimer = window.setTimeout(() => void apiPost("/api/volume", { level }), 250);
  };

  const toggleMute = (): void => {
    const next = !muted();
    setMuted(next);
    void apiPost("/api/volume", { mute: next });
  };

  const onBrightness = (e: InputEvent): void => {
    const level = parseInt((e.currentTarget as HTMLInputElement).value);
    setBrightness(level);
    if (brightnessTimer) window.clearTimeout(brightnessTimer);
    brightnessTimer = window.setTimeout(() => void apiPost("/api/screen/brightness", { level }), 300);
  };

  const toggleBt = async (dev: BtDevice): Promise<void> => {
    await apiPost("/api/bluetooth/connect", {
      address: dev.address,
      action: dev.connected ? "disconnect" : "connect",
    });
    void loadBt();
  };

  const scanBt = async (): Promise<void> => {
    setScanning(true);
    try { setBtDevs(await apiPost<BtDevice[]>("/api/bluetooth/scan")); }
    finally { setScanning(false); }
  };

  return (
    <div class="p-8 pb-32">
      <h1 class="ui-title text-4xl mb-8">Settings</h1>

      {/* Theme */}
      <Card>
        <h2 class="ui-title text-2xl mb-4">Theme</h2>
        <div class="flex flex-col gap-3">
          <For each={THEMES}>
            {(t) => (
              <div
                onClick={() => setTheme(t.id)}
                class="flex items-center justify-between py-4 px-5"
                style={{
                  background: "var(--bg-elev-2)",
                  "border-radius": "var(--radius)",
                  border: theme() === t.id ? "2px solid var(--accent)" : "1px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div class="text-lg font-semibold">{t.label}</div>
                  <div class="ui-muted text-sm mt-1">{t.desc}</div>
                </div>
                <Show when={theme() === t.id}>
                  <span class="ui-accent font-semibold text-lg">●</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Card>

      {/* Volume */}
      <Card class="mt-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="ui-title text-2xl">Volume</h2>
          <Button onClick={toggleMute} size="lg">
            {muted() ? "🔇 Muted" : `🔊 ${volume()}%`}
          </Button>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={volume()}
          onInput={onVolume}
          style={{ width: "100%", height: "56px", "accent-color": "var(--accent)" }}
        />
      </Card>

      {/* Brightness */}
      <Card class="mt-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="ui-title text-2xl">Brightness</h2>
          <span class="ui-muted text-lg">{brightness()}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={brightness()}
          onInput={onBrightness}
          style={{ width: "100%", height: "56px", "accent-color": "var(--accent)" }}
        />
      </Card>

      {/* Bluetooth */}
      <Card class="mt-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="ui-title text-2xl">Bluetooth</h2>
          <Button onClick={() => void scanBt()} disabled={scanning()} size="lg">
            {scanning() ? "Scanning…" : "Scan"}
          </Button>
        </div>
        <div class="flex flex-col gap-3">
          <For each={btDevs()} fallback={<p class="ui-muted text-base">No devices</p>}>
            {(d) => (
              <div
                class="flex items-center justify-between py-4 px-5"
                style={{ background: "var(--bg-elev-2)", "border-radius": "var(--radius)" }}
              >
                <div>
                  <div class="text-lg font-semibold">{d.name}</div>
                  <div class="ui-muted text-sm mt-1">
                    {d.connected ? "● Connected" : "○ Paired"}
                  </div>
                </div>
                <Button onClick={() => void toggleBt(d)}>
                  {d.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            )}
          </For>
        </div>
      </Card>

      {/* System actions */}
      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">System</h2>
        <div class="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => void apiPost("/api/screen", { action: "off" })}>
            Screen OFF
          </Button>
          <Button size="lg" onClick={() => void apiPost("/api/screen", { action: "on" })}>
            Screen ON
          </Button>
          <Button size="lg" onClick={() => window.location.reload()}>
            Reload dashboard
          </Button>
          <Button size="lg" onClick={() => {
            const wk = (window as unknown as { webkit?: { messageHandlers?: { dashboard?: { postMessage: (m: string) => void } } } }).webkit;
            if (wk?.messageHandlers?.dashboard) wk.messageHandlers.dashboard.postMessage("desktop-mode");
          }}>
            Desktop mode
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">About</h2>
        <div class="grid grid-cols-2 gap-4 text-base">
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider">Host</div>
            <div class="font-mono mt-1">{system()?.hostname ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider">OS</div>
            <div class="font-mono mt-1">{system()?.os ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider">Display</div>
            <div class="font-mono mt-1">1100 × 3840 portrait</div>
          </div>
          <div>
            <div class="ui-dim text-xs uppercase tracking-wider">Version</div>
            <div class="font-mono mt-1">dashboard v2</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
