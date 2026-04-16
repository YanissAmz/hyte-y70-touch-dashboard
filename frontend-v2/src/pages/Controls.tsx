import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";
import { Card } from "~/components/Card";
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
      style={{ "touch-action": "none", "border-radius": "50%", width: "500px", height: "500px" }}
    />
  );
}

export const Controls: Component = () => {
  const [effect, setEffect]       = createSignal<string>("static");
  const [ledStatus, setLedStatus] = createSignal<LedStatus | null>(null);
  const [brightness, setBrightness] = createSignal<number>(80);
  const [power, setPower]         = createSignal<string>("balanced");
  const [wallpapers, setWallpapers] = createSignal<Wallpaper[]>([]);

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

  const applyWallpaper = (name: string): void => {
    void apiPost("/api/wallpaper", { name });
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

  return (
    <div class="p-8 pb-32">
      <h1 class="ui-title text-4xl mb-8">Controls</h1>

      {/* LED effects */}
      <Card>
        <div class="flex items-center justify-between mb-3">
          <h2 class="ui-title text-lg">LEDs</h2>
          <Show when={ledStatus()}>
            {(s) => (
              <span
                class="text-xs font-mono"
                style={{ color: s().available ? "var(--success)" : "var(--danger)" }}
              >
                {s().available ? `OpenRGB · ${s().devices.length} dev` : "Offline"}
              </span>
            )}
          </Show>
        </div>
        <TileGrid columns={3} gap={8}>
          <For each={EFFECTS}>
            {(name) => (
              <Button
                variant={effect() === name ? "primary" : "default"}
                onClick={() => applyEffect(name)}
              >
                {name}
              </Button>
            )}
          </For>
        </TileGrid>

        <h3 class="ui-muted text-xs mt-4 mb-2 uppercase tracking-wider">Presets</h3>
        <TileGrid columns={4} gap={8}>
          <For each={PRESETS}>
            {(p) => (
              <button
                class="ui-btn"
                onClick={() => applyPreset(p)}
                style={{
                  "background-color": `rgb(${p.r}, ${p.g}, ${p.b})`,
                  color: (p.r + p.g + p.b) > 380 ? "#000" : "#fff",
                  "min-height": "var(--tap-min)",
                }}
              >
                {p.name}
              </button>
            )}
          </For>
        </TileGrid>

        <h3 class="ui-muted text-xs mt-4 mb-2 uppercase tracking-wider">Color wheel</h3>
        <div class="flex justify-center">
          <ColorWheel onPick={applyColor} />
        </div>
      </Card>

      {/* Brightness */}
      <Card class="mt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="ui-title text-lg">Screen</h2>
          <span class="ui-muted text-sm">{brightness()}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={brightness()}
          onInput={onBrightness}
          style={{ width: "100%", height: "44px", "accent-color": "var(--accent)" }}
        />
        <div class="flex gap-3 mt-3">
          <Button onClick={() => void apiPost("/api/screen", { action: "on" })}>Screen ON</Button>
          <Button variant="danger" onClick={() => void apiPost("/api/screen", { action: "off" })}>Screen OFF</Button>
          <Button onClick={enterDesktopMode}>Desktop mode</Button>
        </div>
      </Card>

      {/* Power profile */}
      <Card class="mt-4">
        <h2 class="ui-title text-lg mb-3">Power profile</h2>
        <TileGrid columns={3} gap={8}>
          <For each={PROFILES}>
            {(p) => (
              <Button
                variant={power() === p ? "primary" : "default"}
                onClick={() => applyPower(p)}
              >
                {p}
              </Button>
            )}
          </For>
        </TileGrid>
      </Card>

      {/* Wallpapers */}
      <Card class="mt-4">
        <h2 class="ui-title text-lg mb-3">Wallpaper</h2>
        <div
          style={{
            display: "grid",
            "grid-template-columns": "repeat(3, 1fr)",
            gap: "8px",
          }}
        >
          <For each={wallpapers()}>
            {(name) => (
              <div
                onClick={() => applyWallpaper(name)}
                style={{
                  "aspect-ratio": "9 / 16",
                  "background-image": `url(/wallpapers/${name})`,
                  "background-size": "cover",
                  "background-position": "center",
                  "border-radius": "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              />
            )}
          </For>
        </div>
      </Card>
    </div>
  );
};
