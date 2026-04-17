import { createSignal } from "solid-js";

// Incremented every time the user picks a new wallpaper in Controls.
// The Ambient page observes this to refresh its <img src> — WebKit is
// aggressive about caching, so just busting ?t=... on page navigate is
// not enough when the user stays on the Ambient page.
const [wallpaperVersion, setWallpaperVersion] = createSignal(0);

export { wallpaperVersion };
export function bumpWallpaperVersion(): void {
  setWallpaperVersion(v => v + 1);
}
