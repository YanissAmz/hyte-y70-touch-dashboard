import { createSignal, createResource, For, Show, type Component } from "solid-js";
import { apiGet } from "~/lib/api";
import { Card } from "~/components/Card";

type Entry = {
  name: string;
  path: string;
  size_bytes: number;
  is_dir: boolean;
};

type TreeResponse = {
  path: string;
  total: number;
  entries: Entry[];
  error?: string;
};

function humanBytes(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)} TB`;
  if (abs >= 1e9)  return `${(n / 1e9).toFixed(2)} GB`;
  if (abs >= 1e6)  return `${(n / 1e6).toFixed(1)} MB`;
  if (abs >= 1e3)  return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
}

function crumbs(p: string): { label: string; path: string }[] {
  const clean = p.replace(/\/+$/, "") || "/";
  if (clean === "/") return [{ label: "/", path: "/" }];
  const parts = clean.split("/").filter(Boolean);
  const out: { label: string; path: string }[] = [{ label: "/", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    out.push({ label: part, path: acc });
  }
  return out;
}

export const Disk: Component = () => {
  // Empty initial path → backend resolves to the user's home directory.
  const [path, setPath] = createSignal("");
  const [data] = createResource(path, (p) => apiGet<TreeResponse>(`/api/disk/tree${p ? `?path=${encodeURIComponent(p)}` : ""}`));

  const navigate = (entry: Entry): void => {
    if (entry.is_dir) setPath(entry.path);
  };

  return (
    <div style={{ padding: "36px", height: "100vh", "box-sizing": "border-box", display: "flex", "flex-direction": "column", gap: "24px" }}>
      <div>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>Storage</h1>
        <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px", "margin-top": "14px", "font-size": "24px", "font-family": "var(--font-mono)" }}>
          <For each={crumbs(path())}>
            {(c, i) => (
              <>
                <Show when={i() > 0}><span class="ui-dim">/</span></Show>
                <span
                  onClick={() => setPath(c.path)}
                  style={{
                    cursor: "pointer",
                    color: c.path === path() ? "var(--accent)" : "var(--text-muted)",
                    "font-weight": c.path === path() ? "700" : "500",
                  }}
                >
                  {c.label}
                </span>
              </>
            )}
          </For>
        </div>
      </div>

      <Card>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-muted" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Total</div>
          <div class="ui-title" style={{ "font-size": "48px", "font-weight": "700" }}>
            {data.loading ? "…" : humanBytes(data()?.total ?? 0)}
          </div>
        </div>
      </Card>

      <div style={{ flex: "1 1 0", "min-height": "0", "overflow-y": "auto", display: "flex", "flex-direction": "column", gap: "10px" }}>
        <Show when={data.loading}>
          <div class="ui-muted" style={{ "text-align": "center", padding: "40px", "font-size": "24px" }}>Scanning…</div>
        </Show>
        <Show when={data()?.error}>
          <div style={{ color: "var(--danger)", padding: "20px", "font-size": "22px" }}>{data()?.error}</div>
        </Show>
        <For each={data()?.entries ?? []} fallback={
          <Show when={!data.loading}>
            <div class="ui-muted" style={{ "text-align": "center", padding: "40px", "font-size": "22px" }}>Empty</div>
          </Show>
        }>
          {(e) => {
            const total = () => data()?.total ?? 1;
            const pct = () => Math.max(0.5, (e.size_bytes / Math.max(total(), 1)) * 100);
            return (
              <div
                onClick={() => navigate(e)}
                style={{
                  padding: "18px 22px",
                  background: "var(--card-surface)",
                  border: "1px solid var(--border)",
                  "border-radius": "16px",
                  cursor: e.is_dir ? "pointer" : "default",
                  position: "relative",
                  overflow: "hidden",
                  "box-shadow": "var(--card-shadow)",
                }}
              >
                <div style={{
                  position: "absolute", top: "0", left: "0", bottom: "0",
                  width: `${pct()}%`,
                  background: e.is_dir ? "var(--accent-glow)" : "var(--bg-elev-2)",
                  "z-index": "0",
                }} />
                <div style={{ position: "relative", "z-index": "1", display: "flex", "align-items": "center", gap: "16px" }}>
                  <span style={{ "font-size": "22px", color: e.is_dir ? "var(--accent)" : "var(--text-muted)", width: "24px", "text-align": "center" }}>
                    {e.is_dir ? "▸" : "•"}
                  </span>
                  <span style={{ flex: "1", "font-size": "26px", "font-weight": e.is_dir ? "600" : "400", "font-family": e.is_dir ? "inherit" : "var(--font-mono)", "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}>
                    {e.name}
                  </span>
                  <span style={{ "font-size": "24px", "font-weight": "700", "font-family": "var(--font-mono)" }}>
                    {humanBytes(e.size_bytes)}
                  </span>
                  <span class="ui-dim" style={{ "font-size": "20px", width: "72px", "text-align": "right", "font-family": "var(--font-mono)" }}>
                    {pct().toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
