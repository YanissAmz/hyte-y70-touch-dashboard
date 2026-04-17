/**
 * Ambilight store — smoothly lerps the TV ambilight color to CSS variables
 * --ambi-r / --ambi-g / --ambi-b consumed by the current page theme.
 *
 * Important: do not run a permanent 30fps loop. WebKitGTK repaints too much
 * on the HYTE panel when the whole page theme keeps changing every frame.
 * Instead, animate only when the collector delivers a new target colour.
 */

import { createEffect } from "solid-js";
import { wsSignals } from "~/stores/ws";

const LERP_SPEED = 0.32;
const EPSILON = 0.5;
const MAX_UI_FPS = 18;
const FRAME_MS = 1000 / MAX_UI_FPS;

let running = false;
let rafId = 0;
let lastTick = 0;
let current = { r: 0, g: 0, b: 0 };
let target = { r: 0, g: 0, b: 0 };

function writeCurrent(): void {
  const root = document.documentElement.style;
  root.setProperty("--ambi-r", current.r.toFixed(2));
  root.setProperty("--ambi-g", current.g.toFixed(2));
  root.setProperty("--ambi-b", current.b.toFixed(2));
}

function animate(now: number): void {
  if (lastTick === 0) lastTick = now;
  const elapsed = now - lastTick;
  if (elapsed < FRAME_MS) {
    rafId = window.requestAnimationFrame(animate);
    return;
  }

  const frameScale = Math.max(1, elapsed / (1000 / 60));
  const lerpFactor = 1 - Math.pow(1 - LERP_SPEED, frameScale);
  lastTick = now;

  const dr = target.r - current.r;
  const dg = target.g - current.g;
  const db = target.b - current.b;

  if (Math.abs(dr) < EPSILON && Math.abs(dg) < EPSILON && Math.abs(db) < EPSILON) {
    current = { ...target };
    writeCurrent();
    lastTick = 0;
    rafId = 0;
    return;
  }

  current = {
    r: current.r + dr * lerpFactor,
    g: current.g + dg * lerpFactor,
    b: current.b + db * lerpFactor,
  };
  writeCurrent();
  rafId = window.requestAnimationFrame(animate);
}

export function startAmbilight(): void {
  if (running) return;
  running = true;
  writeCurrent();

  createEffect(() => {
    const next = wsSignals.ambilight.value();
    if (!next) return;
    target = next;
    if (rafId === 0) rafId = window.requestAnimationFrame(animate);
  });
}
