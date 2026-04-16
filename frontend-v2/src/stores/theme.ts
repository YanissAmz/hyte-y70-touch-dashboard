import { createSignal, createEffect } from "solid-js";

export type Theme = "a" | "b" | "c";

const STORAGE_KEY = "hyte-v2-theme";

function loadInitial(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "a" || stored === "b" || stored === "c" ? stored : "a";
}

const [theme, setThemeInternal] = createSignal<Theme>(loadInitial());

export { theme };

export function setTheme(next: Theme): void {
  setThemeInternal(next);
  localStorage.setItem(STORAGE_KEY, next);
}

// Keep <html data-theme> in sync on every change.
createEffect(() => {
  document.documentElement.setAttribute("data-theme", theme());
});
