import { For, type Component } from "solid-js";
import { apiPost } from "~/lib/api";

type NativeApp = { name: string; icon: string; color: string; key: string };
type WebApp    = { name: string; icon: string; color: string; url: string };

const NATIVE: NativeApp[] = [
  { name: "Terminal",   icon: "⬛", color: "#3FB950", key: "terminal" },
  { name: "Files",      icon: "📁", color: "#58A6FF", key: "files"    },
  { name: "Settings",   icon: "⚙️", color: "#8B949E", key: "settings" },
  { name: "Firefox",    icon: "🌐", color: "#F78166", key: "firefox"  },
  { name: "VS Code",    icon: "🔷", color: "#56D4DD", key: "code"     },
  { name: "Spotify",    icon: "🎵", color: "#1DB954", key: "spotify"  },
];

const WEB: WebApp[] = [
  { name: "Google",   icon: "🔍", color: "#4285F4", url: "https://www.google.com"   },
  { name: "YouTube",  icon: "▶️", color: "#FF0000", url: "https://www.youtube.com"  },
  { name: "ChatGPT",  icon: "🤖", color: "#10A37F", url: "https://chat.openai.com"  },
  { name: "Claude",   icon: "🧠", color: "#D97706", url: "https://claude.ai"         },
  { name: "GitHub",   icon: "🐙", color: "#8B5CF6", url: "https://github.com"        },
  { name: "Spotify",  icon: "🎵", color: "#1DB954", url: "https://open.spotify.com" },
  { name: "Reddit",   icon: "📰", color: "#FF4500", url: "https://www.reddit.com"    },
  { name: "Twitter",  icon: "🐦", color: "#1DA1F2", url: "https://x.com"             },
  { name: "Grafana",  icon: "📊", color: "#F46800", url: "http://localhost:3000"     },
];

type WebKitBridge = { messageHandlers?: { dashboard?: { postMessage: (m: string) => void } } };

const loadUrlInWebview = (url: string): void => {
  const wk = (window as unknown as { webkit?: WebKitBridge }).webkit;
  if (wk?.messageHandlers?.dashboard) {
    wk.messageHandlers.dashboard.postMessage(url);
  } else {
    window.location.href = url;
  }
};

function Tile(props: { icon: string; color: string; name: string; onClick: () => void }) {
  return (
    <div
      onClick={props.onClick}
      style={{
        display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", gap: "14px",
        padding: "22px 12px",
        background: "var(--bg-elev-2)",
        "border-radius": "24px",
        cursor: "pointer",
        transition: "transform 0.15s ease",
        "min-height": 0,
      }}
    >
      <div style={{
        "font-size": "80px",
        width: "140px",
        height: "140px",
        "border-radius": "28px",
        background: `${props.color}22`,
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
      }}>
        {props.icon}
      </div>
      <div style={{ "font-size": "28px", "font-weight": "700" }}>{props.name}</div>
    </div>
  );
}

export const Launcher: Component = () => {
  const launchNative = async (key: string): Promise<void> => {
    try { await apiPost("/api/launch", { app: key }); } catch { /* ignore */ }
  };

  const card = {
    background: "var(--card-surface)",
    border: "1px solid var(--border)",
    "border-radius": "32px",
    "box-shadow": "var(--card-shadow)",
    padding: "28px",
  } as const;

  return (
    <div style={{ height: "100vh", display: "flex", "flex-direction": "column", padding: "36px", gap: "20px", "box-sizing": "border-box" }}>
      {/* HEADER */}
      <header style={{ "flex-shrink": 0 }}>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>Launcher</h1>
      </header>

      {/* NATIVE APPS */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "16px" }}>
        <div class="ui-title" style={{ "font-size": "40px", color: "var(--accent)" }}>Apps</div>
        <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "14px" }}>
          <For each={NATIVE}>
            {(a) => <Tile icon={a.icon} color={a.color} name={a.name} onClick={() => void launchNative(a.key)} />}
          </For>
        </div>
      </div>

      {/* WEB APPS */}
      <div style={{ ...card, flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "16px" }}>
        <div class="ui-title" style={{ "font-size": "40px", color: "var(--accent-2, var(--accent))" }}>Web</div>
        <div style={{
          flex: "1 1 0", "min-height": 0,
          display: "grid",
          "grid-template-columns": "repeat(3, 1fr)",
          "grid-auto-rows": "1fr",
          gap: "14px",
          "overflow-y": "auto",
        }}>
          <For each={WEB}>
            {(a) => <Tile icon={a.icon} color={a.color} name={a.name} onClick={() => loadUrlInWebview(a.url)} />}
          </For>
        </div>
      </div>
    </div>
  );
};
