import { createSignal, createEffect, Show, type Component } from "solid-js";
import { wallpaperVersion } from "~/stores/wallpaper";
import { usePageActivity } from "~/components/PageTrack";

/**
 * Ambient wallpaper page. Single wallpaper (always /wallpapers/current.png
 * — user picks it from Controls), no rotation. Three overlay layers:
 * a dark vignette (multiply) + an ambilight-coloured halo (screen) + two
 * subtle edge gradients. The halo and vignette are centred on the subject
 * so the figure reads clean while the background is darkened and glowing.
 */
export const Ambient: Component = () => {
  const { active } = usePageActivity();
  // Bust the wallpaper cache when the user changes it from Controls.
  // WebKit otherwise keeps the previous image in its in-memory cache even
  // though the server sets no-store on /wallpapers/current.png.
  const [bust, setBust] = createSignal(Date.now());
  createEffect(() => {
    wallpaperVersion();
    setBust(Date.now());
  });

  return (
    <Show
      when={active()}
      fallback={
        <div
          style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            background: "#000",
          }}
        />
      }
    >
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "#000",
        }}
      >
        <img
          src={`/wallpapers/current.png?t=${bust()}`}
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

        {/* 1. Vignette sombre — `multiply` fonce les bords, laisse le centre
            (où se trouve le sujet, ici Bakugo) à sa luminosité naturelle.
            Les couleurs du sujet ne changent pas. */}
        <div
          style={{
            position: "absolute",
            inset: "0",
            background: `radial-gradient(
            ellipse 60% 48% at 50% 42%,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0) 40%,
            rgba(0, 0, 0, 0.82) 85%,
            rgba(0, 0, 0, 0.96) 100%)`,
            "mix-blend-mode": "multiply",
            "pointer-events": "none",
          }}
        />

        {/* 2. Glow ambilight — `screen` allume les bords sombres avec la
            couleur de l'ambilight TV. Le centre reste transparent donc
            le sujet n'est pas teinté. L'anneau entre 45% et 90% fait le halo. */}
        <div
          style={{
            position: "absolute",
            inset: "0",
            background: `radial-gradient(
            ellipse 76% 60% at 50% 42%,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 0) 36%,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), var(--ambient-ring-mid-alpha, 0.42)) 58%,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), var(--ambient-ring-outer-alpha, 0.78)) 78%,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), var(--ambient-ring-edge-alpha, 0.98)) 100%)`,
            "mix-blend-mode": "screen",
            "pointer-events": "none",
          }}
        />

        {/* 3. Bandeau haut + bas — teinte subtile sur les extrémités pour
            que l'ambilight ne s'arrête pas pile à la vignette. */}
        <div
          style={{
            position: "absolute",
            inset: "0 0 80% 0",
            background: `linear-gradient(to bottom,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), var(--ambient-strip-top-alpha, 0.52)),
            rgba(0, 0, 0, 0) 100%)`,
            "mix-blend-mode": "screen",
            "pointer-events": "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "80% 0 0 0",
            background: `linear-gradient(to top,
            rgba(var(--ambi-r), var(--ambi-g), var(--ambi-b), var(--ambient-strip-bottom-alpha, 0.46)),
            rgba(0, 0, 0, 0) 100%)`,
            "mix-blend-mode": "screen",
            "pointer-events": "none",
          }}
        />
      </div>
    </Show>
  );
};
