import { createSignal, createMemo, onMount, For, Show, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { apiPost } from "~/lib/api";
import { Button } from "~/components/Button";
import { Sparkline } from "~/components/Sparkline";
import { Modal } from "~/components/Modal";

const fmt = (n: number | null | undefined, digits = 0): string =>
  n == null || Number.isNaN(n) ? "—" : n.toFixed(digits);

export const Network: Component = () => {
  const net  = wsSignals.network.value;
  const scan = wsSignals.wifi_scan.value;

  const [pingHist, setPingHist] = createSignal<number[]>([]);
  const [dlHist, setDlHist]     = createSignal<number[]>([]);
  const [ulHist, setUlHist]     = createSignal<number[]>([]);
  const [modalSsid, setModalSsid] = createSignal<string | null>(null);
  const [password, setPassword] = createSignal<string>("");

  let lastTs: number | null = null;
  const track = createMemo(() => {
    const ts = wsSignals.network.lastTs();
    const d = net();
    if (!d || !ts || ts === lastTs) return;
    lastTs = ts;
    setPingHist((h) => [...h.slice(-59), d.ping_ms ?? 0]);
    setDlHist((h) => [...h.slice(-59), (d.download_bps ?? 0) / 1_000_000]);
    setUlHist((h) => [...h.slice(-59), (d.upload_bps ?? 0) / 1_000_000]);
  });
  onMount(() => { track(); });

  const connect = (): void => {
    if (!modalSsid()) return;
    void apiPost("/api/wifi/connect", { ssid: modalSsid(), password: password() });
    setModalSsid(null);
    setPassword("");
  };

  const isEth = () => net()?.iface_type === "ethernet";

  const card = {
    background: "var(--bg-elev-1)",
    border: "1px solid var(--border)",
    "border-radius": "32px",
    "box-shadow": "var(--shadow-soft)",
    padding: "32px",
  } as const;

  return (
    <div style={{ height: "100vh", display: "flex", "flex-direction": "column", padding: "36px", gap: "20px", "box-sizing": "border-box" }}>
      {/* HEADER */}
      <header style={{ "flex-shrink": 0, display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
        <h1 class="ui-title" style={{ "font-size": "68px", "font-weight": "700", "line-height": "1" }}>Network</h1>
        <Show when={net()?.tailscale}>
          {(ts) => (
            <div style={{ display: "flex", "align-items": "center", gap: "14px", "font-size": "24px" }}>
              <span style={{ color: ts().status === "connected" ? "var(--success)" : "var(--text-dim)" }}>●</span>
              <span class="ui-muted">Tailscale</span>
              <span class="ui-dim" style={{ "font-family": "var(--font-mono)" }}>{ts().ip ?? "—"}</span>
            </div>
          )}
        </Show>
      </header>

      {/* CONNECTION INFO */}
      <div style={{ ...card, "flex-shrink": 0, display: "flex", "flex-direction": "column", gap: "18px" }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-title" style={{ "font-size": "56px", color: "var(--success)" }}>
            {isEth() ? "Ethernet" : (net()?.ssid ?? "—")}
          </div>
          <Show when={net()?.link_speed_mbps}>
            {(s) => (
              <div style={{ background: "var(--bg-elev-2)", padding: "10px 20px", "border-radius": "14px", "font-size": "32px", "font-weight": "700", color: "var(--success)" }}>
                {s() >= 1000 ? `${s() / 1000} Gb/s` : `${s()} Mb/s`}
              </div>
            )}
          </Show>
        </div>

        <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "20px" }}>
          <div>
            <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Local IP</div>
            <div style={{ "font-size": "34px", "font-weight": "700", "font-family": "var(--font-mono)", "margin-top": "6px" }}>{net()?.ip_local ?? "—"}</div>
          </div>
          <div>
            <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Public IP</div>
            <div style={{ "font-size": "34px", "font-weight": "700", "font-family": "var(--font-mono)", "margin-top": "6px" }}>{net()?.ip_public ?? "—"}</div>
          </div>
          <Show
            when={!isEth()}
            fallback={
              <div>
                <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Interface</div>
                <div style={{ "font-size": "34px", "font-weight": "700", "font-family": "var(--font-mono)", "margin-top": "6px" }}>{net()?.iface ?? "—"}</div>
              </div>
            }
          >
            <div>
              <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>Signal</div>
              <div style={{ "font-size": "34px", "font-weight": "700", "margin-top": "6px" }}>
                {fmt(net()?.signal_percent)}% <span class="ui-muted" style={{ "font-size": "24px" }}>({fmt(net()?.signal_dbm)} dBm)</span>
              </div>
            </div>
          </Show>
          <div>
            <div class="ui-dim" style={{ "font-size": "22px", "text-transform": "uppercase", "letter-spacing": "2px" }}>
              {isEth() ? "Duplex" : "Frequency"}
            </div>
            <div style={{ "font-size": "34px", "font-weight": "700", "margin-top": "6px" }}>
              {isEth() ? "full" : `${fmt(net()?.frequency_mhz)} MHz`}
            </div>
          </div>
        </div>
      </div>

      {/* PING — big value + sparkline */}
      <div style={{ ...card, flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "10px" }}>
        <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
          <div class="ui-title" style={{ "font-size": "40px" }}>Ping</div>
          <div style={{ "font-size": "88px", "font-weight": "700", "line-height": "1", color: "var(--accent)" }}>
            {fmt(net()?.ping_ms)}<span style={{ "font-size": "36px", "font-weight": "600", "margin-left": "8px", color: "var(--text-muted)" }}>ms</span>
          </div>
        </div>
        <div style={{ flex: "1 1 0", "min-height": 0 }}>
          <Sparkline values={pingHist()} max={100} height={200} />
        </div>
      </div>

      {/* DL + UL — 2 cards en row */}
      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "20px", flex: "1 1 0", "min-height": 0 }}>
        <div style={{ ...card, display: "flex", "flex-direction": "column", gap: "8px" }}>
          <div class="ui-title" style={{ "font-size": "36px", color: "var(--success)" }}>↓ Download</div>
          <div style={{ "font-size": "56px", "font-weight": "700", "line-height": "1" }}>
            {fmt((net()?.download_bps ?? 0) / 1e6, 1)}<span class="ui-muted" style={{ "font-size": "28px", "margin-left": "8px" }}>Mb/s</span>
          </div>
          <div style={{ flex: "1 1 0", "min-height": 0 }}>
            <Sparkline values={dlHist()} height={160} />
          </div>
        </div>
        <div style={{ ...card, display: "flex", "flex-direction": "column", gap: "8px" }}>
          <div class="ui-title" style={{ "font-size": "36px", color: "var(--warn)" }}>↑ Upload</div>
          <div style={{ "font-size": "56px", "font-weight": "700", "line-height": "1" }}>
            {fmt((net()?.upload_bps ?? 0) / 1e6, 1)}<span class="ui-muted" style={{ "font-size": "28px", "margin-left": "8px" }}>Mb/s</span>
          </div>
          <div style={{ flex: "1 1 0", "min-height": 0 }}>
            <Sparkline values={ulHist()} height={160} />
          </div>
        </div>
      </div>

      {/* WIFI LIST — only wifi */}
      <Show when={!isEth()}>
        <div style={{ ...card, flex: "1 1 0", "min-height": 0, display: "flex", "flex-direction": "column", gap: "14px", "overflow-y": "auto" }}>
          <div class="ui-title" style={{ "font-size": "36px", "flex-shrink": 0 }}>WiFi networks</div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "10px" }}>
            <For each={scan()?.networks ?? []} fallback={<p class="ui-muted" style={{ "font-size": "24px" }}>Scanning…</p>}>
              {(w) => (
                <div
                  style={{
                    display: "flex", "align-items": "center", "justify-content": "space-between",
                    padding: "18px 22px",
                    background: "var(--bg-elev-2)",
                    "border-radius": "18px",
                    border: w.connected ? "2px solid var(--accent)" : "1px solid transparent",
                  }}
                >
                  <div>
                    <div style={{ "font-size": "28px", "font-weight": "600" }}>{w.ssid}</div>
                    <div class="ui-muted" style={{ "font-size": "20px", "margin-top": "4px" }}>
                      {w.signal_percent}% · {w.frequency} MHz · {w.security || "open"}
                    </div>
                  </div>
                  <Button onClick={() => setModalSsid(w.ssid)}>
                    {w.connected ? "Reconnect" : "Connect"}
                  </Button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Modal
        open={modalSsid() !== null}
        onClose={() => setModalSsid(null)}
        title={`Connect to ${modalSsid() ?? ""}`}
      >
        <input
          type="password"
          placeholder="Password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          style={{
            width: "100%", padding: "16px",
            "border-radius": "12px",
            background: "var(--bg-elev-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            "font-size": "22px",
            "margin-bottom": "16px",
          }}
        />
        <div style={{ display: "flex", gap: "12px", "justify-content": "flex-end" }}>
          <Button onClick={() => setModalSsid(null)}>Cancel</Button>
          <Button variant="primary" onClick={connect}>Connect</Button>
        </div>
      </Modal>
    </div>
  );
};
