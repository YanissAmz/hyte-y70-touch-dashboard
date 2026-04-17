import { createSignal, Match, Switch, onMount, type Component } from "solid-js";
import { startWs } from "~/stores/ws";
import { startAmbilight } from "~/stores/ambilight";
import { setPageIndex } from "~/stores/nav";
import { Debug } from "~/pages/Debug";
import { Design } from "~/pages/Design";
import { Main } from "~/pages/Main";
import { Controls } from "~/pages/Controls";
import { Settings } from "~/pages/Settings";
import { Network } from "~/pages/Network";
import { Processes } from "~/pages/Processes";
import { Disk } from "~/pages/Disk";
import { Sysinfo } from "~/pages/Sysinfo";
import { Launcher } from "~/pages/Launcher";
import { GameCenter } from "~/pages/GameCenter";
import { Ambient } from "~/pages/Ambient";
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
    <Page id="main" index={0}><Main /></Page>
    <Page id="games" index={1}><GameCenter /></Page>
    <Page id="network" index={2}><Network /></Page>
    <Page id="processes" index={3}><Processes /></Page>
    <Page id="disk" index={4}><Disk /></Page>
    <Page id="sysinfo" index={5}><Sysinfo /></Page>
    <Page id="controls" index={6}><Controls /></Page>
    <Page id="settings" index={7}><Settings /></Page>
    <Page id="launcher" index={8}><Launcher /></Page>
    <Page id="ambient" index={9}><Ambient /></Page>
  </PageTrack>
);

export const App: Component = () => {
  const [route, setRoute] = createSignal<Route>(readHash());

  onMount(() => {
    startWs();
    startAmbilight();
    window.addEventListener("hashchange", () => setRoute(readHash()));

    if (route() === "dashboard") {
      // Support #page=N for programmatic navigation (testing / deep-linking)
      const applyPageHash = (): void => {
        const m = window.location.hash.match(/page=(\d+)/);
        if (m) setPageIndex(parseInt(m[1]!, 10));
      };
      applyPageHash();
      window.addEventListener("hashchange", applyPageHash);
    }
  });

  return (
    <Switch fallback={<Dashboard />}>
      <Match when={route() === "debug"}><Debug /></Match>
      <Match when={route() === "design"}><Design /></Match>
      <Match when={route() === "dashboard"}><Dashboard /></Match>
    </Switch>
  );
};
