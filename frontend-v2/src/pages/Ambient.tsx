import { createSignal, createEffect, createMemo, Show, type Component } from "solid-js";
import { pageIndex } from "~/stores/nav";

/**
 * Ambient wallpaper page. Single wallpaper (always /wallpapers/current.png
 * — user picks it from Controls), no rotation. Color overlays use CSS
 * mix-blend-mode which is expensive to composite; they only mount when the
 * ambient page is actually on-screen.
 */
export const Ambient: Component = () => {
  const isAmbientPage = createMemo(() => {
    const track = document.querySelector(".page-track");
    if (!track) return false;
    return pageIndex() === track.children.length - 1;
  });

  // Bust wallpaper cache every time user navigates to this page, so any
  // Controls-driven change is picked up without a full reload.
  const [bust, setBust] = createSignal(Date.now());
  createEffect(() => {
    if (isAmbientPage()) setBust(Date.now());
  });

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

      <Show when={isAmbientPage()}>
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
      </Show>
    </div>
  );
};
