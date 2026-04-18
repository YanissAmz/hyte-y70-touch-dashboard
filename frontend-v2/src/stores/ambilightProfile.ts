import { createEffect, createSignal } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";

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
  void apiPost("/api/ambilight/profile", { profile: next }).catch(() => {});
}

createEffect(() => {
  document.documentElement.setAttribute(
    "data-ambilight-profile",
    ambilightProfile(),
  );
});

async function syncProfileFromApi(): Promise<void> {
  try {
    const data = await apiGet<{ profile: string | null }>("/api/ambilight/profile");
    const next = data.profile;
    if (next === "soft" || next === "normal" || next === "punchy") {
      setAmbilightProfileInternal(next);
      localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // ignore — localStorage remains the fallback source of truth
  }
}

void syncProfileFromApi();
window.setInterval(() => {
  void syncProfileFromApi();
}, 15000);
