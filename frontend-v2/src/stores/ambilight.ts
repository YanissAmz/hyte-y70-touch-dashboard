/**
 * Ambilight store — smoothly lerps the TV ambilight color to CSS variables
 * --ambi-r / --ambi-g / --ambi-b consumed by the Ambient page overlays.
 *
 * Lerp runs at 30 fps (requestAnimationFrame throttled). WS target updates
 * at whatever frequency the backend broadcasts (0.5s poll, delta-gated).
 */

import { createEffect } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { pageIndex } from "~/stores/nav";

const LERP_HZ = 30;
const LERP_DT = 1000 / LERP_HZ;
const LERP_SPEED = 0.18;

let running = false;
let timer: number | null = null;

function isAmbientVisible(): boolean {
  const track = document.querySelector(".page-track");
  if (!track) return false;
  return pageIndex() === track.children.length - 1;
}

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

  createEffect(() => {
    const visible = isAmbientVisible();
    if (visible && timer == null) {
      timer = window.setInterval(update, LERP_DT);
    } else if (!visible && timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  });

  createEffect(() => {
    wsSignals.ambilight.value();
  });
}
