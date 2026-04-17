import { For, createSignal, type Component } from "solid-js";
import { theme, setTheme, type Theme } from "~/stores/theme";
import { Card } from "~/components/Card";
import { Button } from "~/components/Button";
import { TileGrid } from "~/components/TileGrid";
import { Modal } from "~/components/Modal";
import { Gauge } from "~/components/Gauge";
import { Sparkline } from "~/components/Sparkline";

const THEMES: { id: Theme; label: string }[] = [
  { id: "a", label: "A · Minimalist" },
  { id: "b", label: "B · Anime" },
  { id: "c", label: "C · Cyberpunk" },
];

export const Design: Component = () => {
  const [modalOpen, setModalOpen] = createSignal(false);
  const sampleValues = Array.from({ length: 40 }, (_, i) =>
    50 + Math.sin(i / 4) * 20 + Math.random() * 10,
  );

  return (
    <div class="p-6 min-h-screen">
      <header class="mb-8">
        <h1 class="ui-title text-3xl mb-1">Design system</h1>
        <p class="ui-muted text-sm">v2 component showcase — switch theme below</p>
      </header>

      {/* Theme switcher */}
      <div class="flex gap-3 mb-8 flex-wrap">
        <For each={THEMES}>
          {(t) => (
            <Button
              variant={theme() === t.id ? "primary" : "default"}
              onClick={() => setTheme(t.id)}
            >
              {t.label}
            </Button>
          )}
        </For>
      </div>

      <h2 class="ui-title text-xl mt-8 mb-3">Cards</h2>
      <TileGrid columns={2}>
        <Card>
          <h3 class="ui-title text-lg mb-1">Standard card</h3>
          <p class="ui-muted text-sm">Base surface, subtle border, soft shadow.</p>
        </Card>
        <Card size="lg">
          <h3 class="ui-title text-lg mb-1">Larger card</h3>
          <p class="ui-muted text-sm">More padding, larger radius.</p>
        </Card>
      </TileGrid>

      <h2 class="ui-title text-xl mt-8 mb-3">Buttons</h2>
      <div class="flex flex-wrap gap-3">
        <Button>Default</Button>
        <Button variant="primary">Primary</Button>
        <Button variant="danger">Danger</Button>
        <Button size="lg" variant="primary">Large primary</Button>
        <Button disabled>Disabled</Button>
      </div>

      <h2 class="ui-title text-xl mt-8 mb-3">Gauges</h2>
      <TileGrid columns={3}>
        <Card class="flex flex-col items-center">
          <Gauge value={42} label="CPU" unit="%" />
        </Card>
        <Card class="flex flex-col items-center">
          <Gauge value={78} label="GPU" unit="%" />
        </Card>
        <Card class="flex flex-col items-center">
          <Gauge value={91} label="RAM" unit="%" />
        </Card>
      </TileGrid>

      <h2 class="ui-title text-xl mt-8 mb-3">Sparkline</h2>
      <Card>
        <Sparkline values={sampleValues} max={100} height={120} />
      </Card>

      <h2 class="ui-title text-xl mt-8 mb-3">Modal</h2>
      <Button onClick={() => setModalOpen(true)}>Open modal</Button>
      <Modal open={modalOpen()} onClose={() => setModalOpen(false)} title="Confirmation">
        <p class="ui-muted mb-4">Modal content with any children. Tap outside to close.</p>
        <div class="flex gap-3 justify-end">
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => setModalOpen(false)}>OK</Button>
        </div>
      </Modal>

      <h2 class="ui-title text-xl mt-8 mb-3">Typography</h2>
      <Card>
        <p class="ui-title text-3xl mb-2">Display · Space Grotesk</p>
        <p class="text-xl mb-2">Body · Inter regular</p>
        <p class="ui-muted mb-2">Muted text · state text</p>
        <p class="ui-dim">Dim · meta text</p>
      </Card>
    </div>
  );
};
