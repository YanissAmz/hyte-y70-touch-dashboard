import { createSignal, Match, Switch, onMount, type Component } from "solid-js";
import { startWs } from "~/stores/ws";
import { Debug } from "~/pages/Debug";
import { Design } from "~/pages/Design";
import { Main } from "~/pages/Main";
import { Controls } from "~/pages/Controls";
import { Settings } from "~/pages/Settings";
import { Network } from "~/pages/Network";
import { Processes } from "~/pages/Processes";
import { Sysinfo } from "~/pages/Sysinfo";
import { Launcher } from "~/pages/Launcher";
import { Browser } from "~/pages/Browser";
import { PageTrack, Page } from "~/components/PageTrack";

type Route = "dashboard" | "debug" | "design";

function readHash(): Route {
  const h = window.location.hash.replace(/^#/, "");
  if (h === "debug")  return "debug";
  if (h === "design") return "design";
  return "dashboard";
}

const Dashboard: Component = () => (
  <PageTrack>
    <Page id="main"><Main /></Page>
    <Page id="network"><Network /></Page>
    <Page id="processes"><Processes /></Page>
    <Page id="sysinfo"><Sysinfo /></Page>
    <Page id="controls"><Controls /></Page>
    <Page id="settings"><Settings /></Page>
    <Page id="launcher"><Launcher /></Page>
    <Page id="browser"><Browser /></Page>
  </PageTrack>
);

export const App: Component = () => {
  const [route, setRoute] = createSignal<Route>(readHash());

  onMount(() => {
    startWs();
    window.addEventListener("hashchange", () => setRoute(readHash()));
  });

  return (
    <Switch fallback={<Dashboard />}>
      <Match when={route() === "debug"}><Debug /></Match>
      <Match when={route() === "design"}><Design /></Match>
      <Match when={route() === "dashboard"}><Dashboard /></Match>
    </Switch>
  );
};
