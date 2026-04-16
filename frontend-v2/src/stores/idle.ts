/**
 * Idle detector — fires a callback after N seconds of no touch/pointer input.
 *
 * Used by App.tsx to navigate to the Ambient page after 2 minutes. Any touch
 * or pointer event resets the timer.
 */

import { createSignal } from "solid-js";

const [isIdle, setIdle] = createSignal(false);
export { isIdle };

const DEFAULT_MS = 120_000;

let timer: number | undefined;
let installed = false;

function reset(ms: number, onIdle: () => void): void {
  if (timer) window.clearTimeout(timer);
  if (isIdle()) setIdle(false);
  timer = window.setTimeout(() => {
    setIdle(true);
    onIdle();
  }, ms);
}

export function startIdle(onIdle: () => void, ms: number = DEFAULT_MS): void {
  if (installed) return;
  installed = true;
  const listener = (): void => reset(ms, onIdle);
  // Use passive listeners; we never preventDefault here.
  window.addEventListener("touchstart", listener, { passive: true });
  window.addEventListener("pointerdown", listener, { passive: true });
  window.addEventListener("wheel", listener, { passive: true });
  window.addEventListener("keydown", listener);
  reset(ms, onIdle);
}
