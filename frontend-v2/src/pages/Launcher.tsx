import { For, type Component } from "solid-js";
import { apiPost } from "~/lib/api";
import { Card } from "~/components/Card";

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
    // Fallback: open in same tab (unlikely on HYTE)
    window.location.href = url;
  }
};

function Tile(props: { icon: string; color: string; name: string; onClick: () => void }) {
  return (
    <div
      onClick={props.onClick}
      class="flex flex-col items-center gap-2 py-4"
      style={{
        background: "var(--bg-elev-2)",
        "border-radius": "var(--radius)",
        cursor: "pointer",
        transition: "transform var(--dur-fast) var(--ease)",
      }}
    >
      <div
        style={{
          "font-size": "64px",
          width: "120px",
          height: "120px",
          "border-radius": "var(--radius-lg)",
          background: `${props.color}22`,
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
        }}
      >
        {props.icon}
      </div>
      <div class="text-lg font-semibold mt-2">{props.name}</div>
    </div>
  );
}

export const Launcher: Component = () => {
  const launchNative = async (key: string): Promise<void> => {
    try {
      await apiPost("/api/launch", { app: key });
    } catch { /* ignore */ }
  };

  return (
    <div class="p-8 pb-32">
      <h1 class="ui-title text-4xl mb-8">Launcher</h1>

      <Card>
        <h2 class="ui-title text-lg mb-3">Apps</h2>
        <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "12px" }}>
          <For each={NATIVE}>
            {(a) => <Tile icon={a.icon} color={a.color} name={a.name} onClick={() => void launchNative(a.key)} />}
          </For>
        </div>
      </Card>

      <Card class="mt-4">
        <h2 class="ui-title text-lg mb-3">Web</h2>
        <div style={{ display: "grid", "grid-template-columns": "repeat(3, 1fr)", gap: "12px" }}>
          <For each={WEB}>
            {(a) => <Tile icon={a.icon} color={a.color} name={a.name} onClick={() => loadUrlInWebview(a.url)} />}
          </For>
        </div>
      </Card>
    </div>
  );
};
