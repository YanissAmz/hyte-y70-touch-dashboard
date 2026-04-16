/**
 * Ambilight store — smoothly lerps the TV ambilight color to CSS variables
 * --ambi-r / --ambi-g / --ambi-b consumed by the Ambient page overlays.
 *
 * Lerp runs at 30 fps (requestAnimationFrame throttled). WS target updates
 * at whatever frequency the backend broadcasts (0.5s poll, delta-gated).
 */

import { createEffect } from "solid-js";
import { wsSignals } from "~/stores/ws";

const LERP_HZ = 30;
const LERP_DT = 1000 / LERP_HZ;
const LERP_SPEED = 0.18;   // fraction of gap closed per frame (~4 frames to 90%)

let running = false;

function update(): void {
  const target = wsSignals.ambilight.value();
  if (!target) return;
  const root = document.documentElement.style;
  const cur = {
    r: parseFloat(root.getPropertyValue("--ambi-r")) || 0,
    g: parseFloat(root.getPropertyValue("--ambi-g")) || 0,
    b: parseFloat(root.getPropertyValue("--ambi-b")) || 0,
  };
  const nr = cur.r + (target.r - cur.r) * LERP_SPEED;
  const ng = cur.g + (target.g - cur.g) * LERP_SPEED;
  const nb = cur.b + (target.b - cur.b) * LERP_SPEED;
  root.setProperty("--ambi-r", nr.toFixed(2));
  root.setProperty("--ambi-g", ng.toFixed(2));
  root.setProperty("--ambi-b", nb.toFixed(2));
}

export function startAmbilight(): void {
  if (running) return;
  running = true;
  document.documentElement.style.setProperty("--ambi-r", "0");
  document.documentElement.style.setProperty("--ambi-g", "0");
  document.documentElement.style.setProperty("--ambi-b", "0");
  window.setInterval(update, LERP_DT);

  // No-op effect to keep the signal "hot"; reactivity naturally picks up
  // every target update so the lerp runs only for non-zero gaps.
  createEffect(() => {
    wsSignals.ambilight.value();
  });
}
