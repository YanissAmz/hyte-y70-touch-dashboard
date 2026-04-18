import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";
import { theme, setTheme, type Theme } from "~/stores/theme";
import {
  ambilightProfile,
  setAmbilightProfile,
  type AmbilightProfile,
} from "~/stores/ambilightProfile";
import { wsSignals } from "~/stores/ws";
import { Button } from "~/components/Button";

type Volume = { level: number; muted: boolean };
type BtDevice = { address: string; name: string; connected: boolean };

const THEMES: { id: Theme; label: string; desc: string }[] = [
  { id: "a", label: "A · Minimalist", desc: "Sky blue on near-black" },
  { id: "b", label: "B · Anime",      desc: "Warm explosion orange" },
  { id: "c", label: "C · Cyberpunk",  desc: "Neon magenta + cyan" },
];

const AMBILIGHT_PROFILES: {
  id: AmbilightProfile;
  label: string;
  desc: string;
}[] = [
  { id: "soft", label: "Soft", desc: "Glow discret, ambiance légère" },
  { id: "normal", label: "Normal", desc: "Profil équilibré pour le quotidien" },
  { id: "punchy", label: "Punchy", desc: "Halo fort pour HYTE bien visible" },
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

  const card = {
    background: "var(--card-surface)",
    border: "1px solid var(--border)",
    "border-radius": "32px",
    "box-shadow": "var(--card-shadow)",
    padding: "28px",
  } as const;

  return (
    <div style={{ height: "100vh", display: "flex", "flex-direction": "column", padding: "36px", gap: "18px", "box-sizing": "border-box", "overflow-y": "auto" }}>
      {/* HEADER */}
      <header style={{ "flex-shrink": 0 }}>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>Settings</h1>
      </header>

      {/* THEME */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div class="ui-title" style={{ "font-size": "40px" }}>Theme</div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "10px" }}>
          <For each={THEMES}>
            {(t) => (
              <div
                onClick={() => setTheme(t.id)}
                style={{
                  display: "flex", "align-items": "center", "justify-content": "space-between",
                  padding: "18px 24px",
                  background: "var(--bg-elev-2)",
                  "border-radius": "18px",
                  border: theme() === t.id ? "3px solid var(--accent)" : "1px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ "font-size": "28px", "font-weight": "700" }}>{t.label}</div>
                  <div class="ui-muted" style={{ "font-size": "20px", "margin-top": "4px" }}>{t.desc}</div>
                </div>
                <Show when={theme() === t.id}>
                  <span style={{ "font-size": "32px", color: "var(--accent)" }}>●</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* AMBILIGHT PROFILE */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div class="ui-title" style={{ "font-size": "40px" }}>Ambilight intensity</div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "10px" }}>
          <For each={AMBILIGHT_PROFILES}>
            {(profile) => (
              <div
                onClick={() => setAmbilightProfile(profile.id)}
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "space-between",
                  padding: "18px 24px",
                  background: "var(--bg-elev-2)",
                  "border-radius": "18px",
                  border:
                    ambilightProfile() === profile.id
                      ? "3px solid var(--accent)"
                      : "1px solid transparent",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ "font-size": "28px", "font-weight": "700" }}>
                    {profile.label}
                  </div>
                  <div class="ui-muted" style={{ "font-size": "20px", "margin-top": "4px" }}>
                    {profile.desc}
                  </div>
                </div>
                <Show when={ambilightProfile() === profile.id}>
                  <span style={{ "font-size": "32px", color: "var(--accent)" }}>●</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* VOLUME + BRIGHTNESS (fused) */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "24px" }}>
        <div>
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline", "margin-bottom": "12px" }}>
            <div class="ui-title" style={{ "font-size": "40px", color: "var(--accent)" }}>Volume</div>
            <div style={{ display: "flex", "align-items": "baseline", gap: "14px" }}>
              <div style={{ "font-size": "72px", "font-weight": "700", "line-height": "1" }}>
                {muted() ? "—" : volume()}<span style={{ "font-size": "32px", color: "var(--text-muted)" }}>%</span>
              </div>
              <Button onClick={toggleMute} size="lg">{muted() ? "🔇" : "🔊"}</Button>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={volume()}
            onInput={onVolume}
            style={{ width: "100%", height: "64px", "accent-color": "var(--accent)" }}
          />
        </div>
        <div>
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline", "margin-bottom": "12px" }}>
            <div class="ui-title" style={{ "font-size": "40px", color: "var(--warn)" }}>Brightness</div>
            <div style={{ "font-size": "72px", "font-weight": "700", "line-height": "1" }}>
              {brightness()}<span style={{ "font-size": "32px", color: "var(--text-muted)" }}>%</span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={brightness()}
            onInput={onBrightness}
            style={{ width: "100%", height: "64px", "accent-color": "var(--accent)" }}
          />
        </div>
      </div>

      {/* BLUETOOTH */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-title" style={{ "font-size": "40px" }}>Bluetooth</div>
          <Button onClick={() => void scanBt()} disabled={scanning()} size="lg">
            {scanning() ? "Scanning…" : "Scan"}
          </Button>
        </div>
        <div style={{ display: "flex", "flex-direction": "column", gap: "10px" }}>
          <For each={btDevs()} fallback={<p class="ui-muted" style={{ "font-size": "24px", "text-align": "center", padding: "24px" }}>No devices paired</p>}>
            {(d) => (
              <div
                style={{
                  display: "flex", "align-items": "center", "justify-content": "space-between",
                  padding: "18px 24px",
                  background: "var(--bg-elev-2)",
                  "border-radius": "18px",
                }}
              >
                <div>
                  <div style={{ "font-size": "28px", "font-weight": "700" }}>{d.name}</div>
                  <div class="ui-muted" style={{ "font-size": "20px", "margin-top": "4px" }}>
                    {d.connected ? "● Connected" : "○ Paired"}
                  </div>
                </div>
                <Button onClick={() => void toggleBt(d)} size="lg">
                  {d.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* SYSTEM ACTIONS */}
      <div style={{ ...card, "flex-shrink": 0 }}>
        <div class="ui-title" style={{ "font-size": "40px", "margin-bottom": "14px" }}>System</div>
        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "14px" }}>
          <Button size="lg" onClick={() => void apiPost("/api/screen", { action: "off" })}>Screen OFF</Button>
          <Button size="lg" onClick={() => void apiPost("/api/screen", { action: "on" })}>Screen ON</Button>
          <Button size="lg" onClick={() => window.location.reload()}>Reload dashboard</Button>
          <Button size="lg" onClick={() => {
            const wk = (window as unknown as { webkit?: { messageHandlers?: { dashboard?: { postMessage: (m: string) => void } } } }).webkit;
            if (wk?.messageHandlers?.dashboard) wk.messageHandlers.dashboard.postMessage("desktop-mode");
          }}>Desktop mode</Button>
        </div>
      </div>

      {/* ABOUT */}
      <div style={{ ...card, "flex-shrink": 0 }}>
        <div class="ui-title" style={{ "font-size": "36px", "margin-bottom": "14px" }}>About</div>
        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "20px 28px" }}>
          <div>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Host</div>
            <div style={{ "font-family": "var(--font-mono)", "font-size": "26px", "font-weight": "700", "margin-top": "4px" }}>{system()?.hostname ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>OS</div>
            <div style={{ "font-family": "var(--font-mono)", "font-size": "26px", "font-weight": "700", "margin-top": "4px" }}>{system()?.os ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Display</div>
            <div style={{ "font-family": "var(--font-mono)", "font-size": "26px", "font-weight": "700", "margin-top": "4px" }}>1100 × 3840</div>
          </div>
          <div>
            <div class="ui-dim" style={{ "font-size": "20px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Version</div>
            <div style={{ "font-family": "var(--font-mono)", "font-size": "26px", "font-weight": "700", "margin-top": "4px" }}>dashboard v2</div>
          </div>
        </div>
      </div>
    </div>
  );
};
