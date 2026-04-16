import { createSignal, onMount, For, type Component } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";
import { theme, setTheme, type Theme } from "~/stores/theme";
import { Card } from "~/components/Card";
import { Button } from "~/components/Button";

type Volume = { level: number; muted: boolean };
type BtDevice = { address: string; name: string; connected: boolean };

const THEMES: { id: Theme; label: string }[] = [
  { id: "a", label: "A · Minimalist" },
  { id: "b", label: "B · Anime" },
  { id: "c", label: "C · Cyberpunk" },
];

export const Settings: Component = () => {
  const [volume, setVolume]  = createSignal<number>(50);
  const [muted, setMuted]    = createSignal<boolean>(false);
  const [btDevs, setBtDevs]  = createSignal<BtDevice[]>([]);
  const [scanning, setScanning] = createSignal<boolean>(false);

  let volumeTimer: number | undefined;

  const loadVolume = async (): Promise<void> => {
    try {
      const v = await apiGet<Volume>("/api/volume");
      setVolume(v.level);
      setMuted(v.muted);
    } catch { /* ignore */ }
  };

  const loadBt = async (): Promise<void> => {
    try {
      setBtDevs(await apiGet<BtDevice[]>("/api/bluetooth"));
    } catch { /* ignore */ }
  };

  onMount(() => {
    void loadVolume();
    void loadBt();
  });

  const onVolume = (e: InputEvent): void => {
    const level = parseInt((e.currentTarget as HTMLInputElement).value);
    setVolume(level);
    if (volumeTimer) window.clearTimeout(volumeTimer);
    volumeTimer = window.setTimeout(() => {
      void apiPost("/api/volume", { level });
    }, 250);
  };

  const toggleMute = (): void => {
    const next = !muted();
    setMuted(next);
    void apiPost("/api/volume", { mute: next });
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
    try {
      const found = await apiPost<BtDevice[]>("/api/bluetooth/scan");
      setBtDevs(found);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div class="p-5 pb-24">
      <h1 class="ui-title text-2xl mb-4">Settings</h1>

      {/* Theme selector */}
      <Card>
        <h2 class="ui-title text-lg mb-3">Theme</h2>
        <div class="flex flex-wrap gap-2">
          <For each={THEMES}>
            {(t) => (
              <Button
                variant={theme() === t.id ? "primary" : "default"}
                onClick={() => setTheme(t.id)}
              >
                {t.label}
              </Button>
            )}
          </For>
        </div>
      </Card>

      {/* Volume */}
      <Card class="mt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="ui-title text-lg">Volume</h2>
          <Button onClick={toggleMute}>
            {muted() ? "🔇 Muted" : `🔊 ${volume()}%`}
          </Button>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={volume()}
          onInput={onVolume}
          style={{ width: "100%", height: "44px", "accent-color": "var(--accent)" }}
        />
      </Card>

      {/* Bluetooth */}
      <Card class="mt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="ui-title text-lg">Bluetooth</h2>
          <Button onClick={() => void scanBt()} disabled={scanning()}>
            {scanning() ? "Scanning…" : "Scan"}
          </Button>
        </div>
        <div class="flex flex-col gap-2">
          <For each={btDevs()} fallback={<p class="ui-muted text-sm">No devices</p>}>
            {(d) => (
              <div
                class="flex items-center justify-between py-2 px-3"
                style={{
                  background: "var(--bg-elev-2)",
                  "border-radius": "var(--radius-sm)",
                }}
              >
                <div>
                  <div class="text-sm font-semibold">{d.name}</div>
                  <div class="ui-muted text-xs">
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

      {/* Misc */}
      <Card class="mt-4">
        <h2 class="ui-title text-lg mb-3">Dashboard</h2>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </Card>
    </div>
  );
};
