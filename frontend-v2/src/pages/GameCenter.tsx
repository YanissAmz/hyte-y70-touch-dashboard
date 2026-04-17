import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { apiGet, apiPost } from "~/lib/api";

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
    <div style={{ height: "100vh", display: "flex", "flex-direction": "column", padding: "36px", gap: "20px", "box-sizing": "border-box" }}>
      {/* HEADER */}
      <header style={{ "flex-shrink": 0, display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>Games</h1>
        <div class="ui-dim" style={{ "font-size": "26px", "font-family": "var(--font-mono)" }}>{games().length} installed</div>
      </header>

      <Show when={games().length === 0}>
        <div style={{
          flex: "1 1 0", "min-height": 0,
          display: "flex", "align-items": "center", "justify-content": "center",
          padding: "40px", "text-align": "center",
          background: "var(--bg-elev-1)", "border-radius": "32px", border: "1px solid var(--border)",
        }}>
          <div>
            <div style={{ "font-size": "48px", "font-weight": "700", color: "var(--text-muted)" }}>No games found</div>
            <div class="ui-dim" style={{ "font-size": "22px", "margin-top": "16px" }}>
              Add .desktop launchers with icons under<br/>~/.local/share/icons/game-launchers/
            </div>
          </div>
        </div>
      </Show>

      {/* GRID */}
      <Show when={games().length > 0}>
        <div style={{
          flex: "1 1 0", "min-height": 0, "overflow-y": "auto",
          display: "grid",
          "grid-template-columns": "repeat(2, 1fr)",
          gap: "20px",
        }}>
          <For each={games()}>
            {(g) => {
              const active = () => launchingId() === g.id;
              return (
                <div
                  onClick={() => void launch(g)}
                  style={{
                    "aspect-ratio": "3 / 4",
                    "border-radius": "28px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-elev-1)",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    transform: active() ? "scale(0.96)" : "scale(1)",
                    "box-shadow": active()
                      ? "0 0 0 4px var(--accent-glow), var(--shadow-soft)"
                      : "var(--shadow-soft)",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  <img
                    src={g.icon_url}
                    alt={g.name}
                    style={{
                      width: "100%", height: "100%",
                      "object-fit": "contain",
                      display: "block",
                      background: "var(--bg-elev-2)",
                    }}
                  />
                  <div style={{
                    position: "absolute",
                    left: 0, right: 0, bottom: 0,
                    padding: "22px 24px",
                    background: "linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.55) 60%, transparent)",
                    color: "#fff",
                    "font-weight": "700",
                    "font-family": "var(--font-display)",
                    "font-size": "36px",
                    "line-height": "1.1",
                  }}>
                    {g.name}
                  </div>
                  <Show when={active()}>
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", "align-items": "center", "justify-content": "center",
                      "background-color": "rgba(0, 0, 0, 0.55)",
                    }}>
                      <div style={{
                        color: "var(--accent-strong)",
                        "font-size": "36px", "font-weight": "700",
                        padding: "16px 28px",
                        background: "rgba(0, 0, 0, 0.72)",
                        "border-radius": "20px",
                      }}>
                        Launching…
                      </div>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={toast()}>
        {(t) => (
          <div style={{
            position: "fixed",
            bottom: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-elev-2)",
            border: "1px solid var(--border-strong)",
            padding: "18px 32px",
            "font-size": "24px",
            "font-weight": "600",
            "border-radius": "20px",
            "z-index": 200,
            "box-shadow": "var(--shadow-soft)",
          }}>
            {t()}
          </div>
        )}
      </Show>
    </div>
  );
};
