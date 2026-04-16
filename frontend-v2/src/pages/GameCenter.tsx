import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";
import { Card } from "~/components/Card";

type Game = {
  id: string;
  name: string;
  icon_url: string;
  exec: string;
};

type LaunchResp = { status: "ok" | "error"; launched?: string; message?: string };

export const GameCenter: Component = () => {
  const [games, setGames]       = createSignal<Game[]>([]);
  const [launchingId, setLaunchingId] = createSignal<string | null>(null);
  const [toast, setToast]       = createSignal<string | null>(null);

  onMount(async () => {
    try { setGames(await apiGet<Game[]>("/api/games")); } catch { /* ignore */ }
  });

  const launch = async (g: Game): Promise<void> => {
    setLaunchingId(g.id);
    setToast(`Launching ${g.name}…`);
    try {
      const res = await apiPost<LaunchResp>("/api/games/launch", { id: g.id });
      if (res.status === "error") setToast(res.message ?? "Launch failed");
    } catch {
      setToast("Launch failed");
    }
    window.setTimeout(() => {
      setLaunchingId(null);
      setToast(null);
    }, 1500);
  };

  return (
    <div class="p-5 pb-24">
      <h1 class="ui-title text-2xl mb-4">Games</h1>

      <Show when={games().length === 0}>
        <Card>
          <p class="ui-muted">No games found. Add .desktop launchers with icons under ~/.local/share/icons/game-launchers/.</p>
        </Card>
      </Show>

      <div
        style={{
          display: "grid",
          "grid-template-columns": "repeat(2, 1fr)",
          gap: "16px",
        }}
      >
        <For each={games()}>
          {(g) => {
            const active = () => launchingId() === g.id;
            return (
              <div
                onClick={() => void launch(g)}
                class="relative overflow-hidden"
                style={{
                  "aspect-ratio": "3 / 4",
                  "border-radius": "var(--radius-lg)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-elev-1)",
                  cursor: "pointer",
                  transform: active() ? "scale(0.96)" : "scale(1)",
                  "box-shadow": active()
                    ? "0 0 0 4px var(--accent-glow), var(--shadow-soft)"
                    : "var(--shadow-soft)",
                  transition: "transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
                }}
              >
                <img
                  src={g.icon_url}
                  alt={g.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    "object-fit": "cover",
                    display: "block",
                  }}
                />
                {/* name overlay */}
                <div
                  style={{
                    position: "absolute",
                    left: "0",
                    right: "0",
                    bottom: "0",
                    padding: "12px",
                    background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
                    color: "#fff",
                    "font-weight": "700",
                    "font-family": "var(--font-display)",
                    "font-size": "16px",
                    "line-height": "1.2",
                  }}
                >
                  {g.name}
                </div>
                <Show when={active()}>
                  <div
                    style={{
                      position: "absolute",
                      inset: "0",
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "center",
                      "background-color": "rgba(0, 0, 0, 0.35)",
                    }}
                  >
                    <div
                      class="ui-title text-lg"
                      style={{
                        color: "var(--accent-strong)",
                        padding: "10px 18px",
                        background: "rgba(0, 0, 0, 0.7)",
                        "border-radius": "var(--radius)",
                      }}
                    >
                      Launching…
                    </div>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={toast()}>
        {(t) => (
          <div
            style={{
              position: "fixed",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-elev-2)",
              border: "1px solid var(--border-strong)",
              padding: "10px 20px",
              "border-radius": "var(--radius-lg)",
              "z-index": "200",
              "box-shadow": "var(--shadow-soft)",
            }}
          >
            {t()}
          </div>
        )}
      </Show>
    </div>
  );
};
