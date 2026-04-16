import { onMount, type Component } from "solid-js";
import { startWs } from "~/stores/ws";
import { Debug } from "~/pages/Debug";

export const App: Component = () => {
  onMount(startWs);
  return <Debug />;
};
