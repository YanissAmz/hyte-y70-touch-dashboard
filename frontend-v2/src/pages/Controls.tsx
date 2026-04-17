import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";
import { bumpWallpaperVersion } from "~/stores/wallpaper";
import { Button } from "~/components/Button";
import { TileGrid } from "~/components/TileGrid";

type LedStatus = { available: boolean; devices: { name: string }[] };
type PowerInfo = { current: string };
type Wallpaper = string;

const EFFECTS = ["static", "rainbow", "pulse", "breathing", "wave", "strobe"] as const;
const PRESETS: { name: string; r: number; g: number; b: number }[] = [
  { name: "Off",    r: 0,   g: 0,   b: 0 },
  { name: "White",  r: 255, g: 255, b: 255 },
  { name: "Red",    r: 255, g: 0,   b: 0 },
  { name: "Green",  r: 0,   g: 255, b: 0 },
  { name: "Blue",   r: 0,   g: 0,   b: 255 },
  { name: "Purple", r: 180, g: 60,  b: 255 },
  { name: "Orange", r: 255, g: 120, b: 20 },
  { name: "Cyan",   r: 0,   g: 220, b: 255 },
];
const PROFILES = ["powersave", "balanced", "performance"] as const;

function ColorWheel(props: { onPick: (r: number, g: number, b: number) => void }) {
  let canvas: HTMLCanvasElement | undefined;

  onMount(() => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = 150, cy = 150, radius = 140;
    for (let angle = 0; angle < 360; angle++) {
      const s = (angle - 1) * Math.PI / 180;
      const e = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, s, e);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }
  });

  const pickAt = (e: MouseEvent | TouchEvent): void => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e instanceof TouchEvent ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const cy = e instanceof TouchEvent ? e.touches[0]?.clientY ?? 0 : e.clientY;
    const x = (cx - rect.left) * canvas.width / rect.width;
    const y = (cy - rect.top) * canvas.height / rect.height;
    const p = ctx.getImageData(x, y, 1, 1).data;
    props.onPick(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
  };

  return (
    <canvas
      ref={canvas}
      width={300}
      height={300}
      onClick={pickAt}
      onTouchStart={pickAt}
      style={{ "touch-action": "none", "border-radius": "50%", width: "480px", height: "480px" }}
    />
  );
}

export const Controls: Component = () => {
  const [effect, setEffect]       = createSignal<string>("static");
  const [ledStatus, setLedStatus] = createSignal<LedStatus | null>(null);
  const [brightness, setBrightness] = createSignal<number>(80);
  const [power, setPower]         = createSignal<string>("balanced");
  const [wallpapers, setWallpapers] = createSignal<Wallpaper[]>([]);
  const [activeWallpaper, setActiveWallpaper] = createSignal<string | null>(null);
  const [applyingWallpaper, setApplyingWallpaper] = createSignal<string | null>(null);

  let brightnessTimer: number | undefined;

  onMount(async () => {
    try { setLedStatus(await apiGet<LedStatus>("/api/leds/status")); } catch { /* ignore */ }
    try { setPower((await apiGet<PowerInfo>("/api/power")).current); } catch { /* ignore */ }
    try { setWallpapers(await apiGet<Wallpaper[]>("/api/wallpapers")); } catch { /* ignore */ }
  });

  const applyEffect = (name: string): void => {
    setEffect(name);
    void apiPost("/api/leds", { effect: name });
  };

  const applyPreset = (p: { r: number; g: number; b: number }): void => {
    setEffect("static");
    if (p.r === 0 && p.g === 0 && p.b === 0) {
      void apiPost("/api/leds", { preset: "off" });
    } else {
      void apiPost("/api/leds", p);
    }
  };

  const applyColor = (r: number, g: number, b: number): void => {
    setEffect("static");
    void apiPost("/api/leds", { r, g, b });
  };

  const onBrightness = (e: InputEvent): void => {
    const target = e.currentTarget as HTMLInputElement;
    const level = parseInt(target.value);
    setBrightness(level);
    if (brightnessTimer) window.clearTimeout(brightnessTimer);
    brightnessTimer = window.setTimeout(() => {
      void apiPost("/api/screen/brightness", { level });
    }, 300);
  };

  const applyPower = (profile: string): void => {
    setPower(profile);
    void apiPost("/api/power", { profile });
  };

  const applyWallpaper = async (name: string): Promise<void> => {
    setApplyingWallpaper(name);
    try {
      await apiPost("/api/wallpaper", { name });
      setActiveWallpaper(name);
      bumpWallpaperVersion();
    } finally {
      setApplyingWallpaper(null);
    }
  };

  const enterDesktopMode = (): void => {
    type WebKitBridge = { messageHandlers?: { dashboard?: { postMessage: (m: string) => void } } };
    const wk = (window as unknown as { webkit?: WebKitBridge }).webkit;
    if (wk?.messageHandlers?.dashboard) {
      wk.messageHandlers.dashboard.postMessage("desktop-mode");
    } else {
      void apiPost("/api/desktop-mode", { action: "enter" });
    }
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
      <header style={{ "flex-shrink": 0, display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>Controls</h1>
        <Show when={ledStatus()}>
          {(s) => (
            <span
              style={{ "font-size": "22px", "font-family": "var(--font-mono)", color: s().available ? "var(--success)" : "var(--danger)" }}
            >
              {s().available ? `OpenRGB · ${s().devices.length} dev` : "LEDs offline"}
            </span>
          )}
        </Show>
      </header>

      {/* LEDS */}
      <div style={{ ...card, display: "flex", "flex-direction": "column", gap: "18px", "flex-shrink": 0 }}>
        <div class="ui-title" style={{ "font-size": "40px", color: "var(--accent)" }}>LEDs</div>

        <div>
          <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px", "margin-bottom": "12px" }}>Effects</div>
          <TileGrid columns={3} gap={12}>
            <For each={EFFECTS}>
              {(name) => (
                <Button
                  size="lg"
                  variant={effect() === name ? "primary" : "default"}
                  onClick={() => applyEffect(name)}
                >
                  {name}
                </Button>
              )}
            </For>
          </TileGrid>
        </div>

        <div>
          <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px", "margin-bottom": "12px" }}>Presets</div>
          <TileGrid columns={4} gap={12}>
            <For each={PRESETS}>
              {(p) => (
                <button
                  class="ui-btn ui-btn-lg"
                  onClick={() => applyPreset(p)}
                  style={{
                    "background-color": `rgb(${p.r}, ${p.g}, ${p.b})`,
                    color: (p.r + p.g + p.b) > 380 ? "#000" : "#fff",
                    "font-size": "24px",
                    "font-weight": "700",
                  }}
                >
                  {p.name}
                </button>
              )}
            </For>
          </TileGrid>
        </div>

        <div style={{ display: "flex", "justify-content": "center", "padding-top": "10px" }}>
          <ColorWheel onPick={applyColor} />
        </div>
      </div>

      {/* SCREEN BRIGHTNESS */}
      <div style={{ ...card, "flex-shrink": 0 }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline", "margin-bottom": "14px" }}>
          <div class="ui-title" style={{ "font-size": "40px", color: "var(--warn)" }}>Screen</div>
          <div style={{ "font-size": "72px", "font-weight": "700", "line-height": "1" }}>
            {brightness()}<span style={{ "font-size": "36px", color: "var(--text-muted)" }}>%</span>
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
        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "12px", "margin-top": "14px" }}>
          <Button size="lg" onClick={() => void apiPost("/api/screen", { action: "on" })}>Screen ON</Button>
          <Button size="lg" variant="danger" onClick={() => void apiPost("/api/screen", { action: "off" })}>Screen OFF</Button>
          <Button size="lg" onClick={enterDesktopMode}>Desktop mode</Button>
        </div>
      </div>

      {/* POWER PROFILE */}
      <div style={{ ...card, "flex-shrink": 0 }}>
        <div class="ui-title" style={{ "font-size": "36px", "margin-bottom": "14px" }}>Power profile</div>
        <TileGrid columns={3} gap={12}>
          <For each={PROFILES}>
            {(p) => (
              <Button
                size="lg"
                variant={power() === p ? "primary" : "default"}
                onClick={() => applyPower(p)}
              >
                {p}
              </Button>
            )}
          </For>
        </TileGrid>
      </div>

      {/* WALLPAPERS */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "14px" }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-title" style={{ "font-size": "40px" }}>Wallpaper</div>
          <div class="ui-muted" style={{ "font-size": "22px" }}>{wallpapers().length} available</div>
        </div>
        <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "12px" }}>
          <For each={wallpapers()}>
            {(name) => {
              const isActive = () => activeWallpaper() === name;
              const isApplying = () => applyingWallpaper() === name;
              return (
                <div
                  onClick={() => void applyWallpaper(name)}
                  style={{
                    "aspect-ratio": "9 / 16",
                    "background-image": `url(/wallpapers/${name})`,
                    "background-size": "cover",
                    "background-position": "center",
                    "border-radius": "14px",
                    border: isActive() ? "3px solid var(--accent)" : "1px solid var(--border)",
                    "box-shadow": isActive() ? "0 0 0 6px var(--accent-glow)" : "none",
                    position: "relative",
                    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
                    transform: isApplying() ? "scale(0.96)" : "scale(1)",
                    cursor: "pointer",
                  }}
                >
                  <Show when={isActive()}>
                    <div style={{
                      position: "absolute", top: "10px", right: "10px",
                      width: "40px", height: "40px", "border-radius": "50%",
                      background: "var(--accent)", color: "var(--bg)",
                      display: "flex", "align-items": "center", "justify-content": "center",
                      "font-weight": "700", "font-size": "22px",
                    }}>✓</div>
                  </Show>
                  <Show when={isApplying()}>
                    <div style={{
                      position: "absolute", inset: "0",
                      background: "rgba(0,0,0,0.45)",
                      display: "flex", "align-items": "center", "justify-content": "center",
                      "border-radius": "14px",
                      color: "var(--text)", "font-size": "24px", "font-weight": "700",
                    }}>…</div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
};
