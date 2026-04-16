import { createSignal, onMount, onCleanup, type Component } from "solid-js";
import { apiGet } from "~/lib/api";

const ROTATE_MS = 5 * 60 * 1000;  // 5 minutes

export const Ambient: Component = () => {
  const [wallpapers, setWallpapers] = createSignal<string[]>([]);
  const [index, setIndex] = createSignal(0);

  let rotateTimer: number | undefined;

  onMount(async () => {
    let list: string[] = [];
    try {
      list = await apiGet<string[]>("/api/wallpapers");
      // Prefer Bakugo as default first — seed of the ambient feature
      const bakugoIdx = list.findIndex((n) => /bakugo/i.test(n));
      if (bakugoIdx > 0) {
        list = [list[bakugoIdx]!, ...list.filter((_, i) => i !== bakugoIdx)];
      }
    } catch { /* keep empty */ }
    setWallpapers(list);

    rotateTimer = window.setInterval(() => {
      const n = wallpapers().length;
      if (n > 1) setIndex((i) => (i + 1) % n);
    }, ROTATE_MS);
  });

  onCleanup(() => {
    if (rotateTimer) window.clearInterval(rotateTimer);
  });

  const current = (): string | null => wallpapers()[index()] ?? null;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Wallpaper — GPU-composited by WebKit, decoded once per change */}
      {current() && (
        <img
          src={`/wallpapers/${current()}`}
          alt="wallpaper"
          style={{
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            "object-fit": "cover",
            display: "block",
          }}
        />
      )}

      {/* Top gradient — TV light from above, SCREEN blend */}
      <div
        style={{
          position: "absolute",
          inset: "0 0 55% 0",
          background: `linear-gradient(to bottom,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), 0.85),
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), 0.22) 55%,
            rgba(0, 0, 0, 0) 100%)`,
          "mix-blend-mode": "screen",
          "pointer-events": "none",
        }}
      />

      {/* Bottom gradient — floor bounce, SCREEN blend */}
      <div
        style={{
          position: "absolute",
          inset: "55% 0 0 0",
          background: `linear-gradient(to top,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), 0.50),
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), 0.12) 45%,
            rgba(0, 0, 0, 0) 100%)`,
          "mix-blend-mode": "screen",
          "pointer-events": "none",
        }}
      />

      {/* Inverted radial — colors edges, protects the centered subject */}
      <div
        style={{
          position: "absolute",
          inset: "0",
          background: `radial-gradient(
            ellipse 70% 55% at 50% 48%,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0) 30%,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), 0.35) 70%,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), 0.75) 100%)`,
          "mix-blend-mode": "screen",
          "pointer-events": "none",
        }}
      />
    </div>
  );
};
