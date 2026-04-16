import { createSignal, Match, Switch, onMount, type Component } from "solid-js";
import { startWs } from "~/stores/ws";
import { Debug } from "~/pages/Debug";
import { Design } from "~/pages/Design";

type Route = "design" | "debug";

function readHash(): Route {
  const h = window.location.hash.replace(/^#/, "");
  return h === "debug" ? "debug" : "design";
}

export const App: Component = () => {
  const [route, setRoute] = createSignal<Route>(readHash());

  onMount(() => {
    startWs();
    window.addEventListener("hashchange", () => setRoute(readHash()));
  });

  return (
    <Switch fallback={<Design />}>
      <Match when={route() === "debug"}><Debug /></Match>
      <Match when={route() === "design"}><Design /></Match>
    </Switch>
  );
};
