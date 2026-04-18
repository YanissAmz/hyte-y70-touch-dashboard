import { createEffect, createSignal } from "solid-js";

export type AmbilightProfile = "soft" | "normal" | "punchy";

const STORAGE_KEY = "hyte-v2-ambilight-profile";

function loadInitial(): AmbilightProfile {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "soft" || stored === "normal" || stored === "punchy"
    ? stored
    : "normal";
}

const [ambilightProfile, setAmbilightProfileInternal] =
  createSignal<AmbilightProfile>(loadInitial());

export { ambilightProfile };

export function setAmbilightProfile(next: AmbilightProfile): void {
  setAmbilightProfileInternal(next);
  localStorage.setItem(STORAGE_KEY, next);
}

createEffect(() => {
  document.documentElement.setAttribute(
    "data-ambilight-profile",
    ambilightProfile(),
  );
});
