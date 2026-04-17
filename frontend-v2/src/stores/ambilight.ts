/**
 * Ambilight store — smoothly lerps the TV ambilight color to CSS variables
 * --ambi-r / --ambi-g / --ambi-b consumed by the Ambient page overlays.
 *
 * Lerp runs at 30 fps. Cost is negligible and keeping it always-on avoids
 * the "CSS vars stuck at init values when the effect never ran" class of
 * bug we hit before.
 */

import { createEffect } from "solid-js";
import { wsSignals } from "~/stores/ws";

const LERP_HZ = 30;
const LERP_DT = 1000 / LERP_HZ;
// 0.35 → ~5.3 frames to 90% (log(0.1)/log(0.65)) = ~180ms smoothing at 30 Hz.
// Enough to smooth visible stepping on the CSS blends without adding
// perceptible lag vs. Hue/Govee.
const LERP_SPEED = 0.35;

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

  // Keep the signal "hot" so any target change is reactive.
  createEffect(() => {
    wsSignals.ambilight.value();
  });
}
