import { createSignal, type Component } from "solid-js";
import { Card } from "~/components/Card";
import { Button } from "~/components/Button";

type WebKitBridge = { messageHandlers?: { dashboard?: { postMessage: (m: string) => void } } };

const sendToWebview = (url: string): void => {
  const wk = (window as unknown as { webkit?: WebKitBridge }).webkit;
  if (wk?.messageHandlers?.dashboard) {
    wk.messageHandlers.dashboard.postMessage(url);
  }
};

export const Browser: Component = () => {
  const [input, setInput] = createSignal("");

  const go = (): void => {
    const v = input().trim();
    if (!v) return;
    const isUrl = /^https?:\/\//i.test(v) || v.includes(".");
    const url = isUrl
      ? (v.startsWith("http") ? v : `https://${v}`)
      : `https://www.google.com/search?q=${encodeURIComponent(v)}`;
    sendToWebview(url);
  };

  return (
    <div class="p-5 pb-24">
      <h1 class="ui-title text-2xl mb-4">Browser</h1>

      <Card>
        <p class="ui-muted text-sm mb-4">
          Enter a URL or a search term. The webview switches to browser mode and loads it.
        </p>
        <div class="flex gap-3">
          <input
            type="url"
            placeholder="URL or Google search…"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(); }}
            style={{
              flex: "1",
              padding: "14px",
              "border-radius": "var(--radius-sm)",
              background: "var(--bg-elev-2)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              "font-size": "16px",
            }}
          />
          <Button variant="primary" onClick={go}>Go</Button>
        </div>
      </Card>
    </div>
  );
};
