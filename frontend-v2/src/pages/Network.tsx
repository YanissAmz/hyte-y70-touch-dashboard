import { createSignal, createMemo, onMount, For, Show, type Component } from "solid-js";
import { wsSignals } from "~/stores/ws";
import { apiPost } from "~/lib/api";
import { Card } from "~/components/Card";
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

  // Append to history when WS network message arrives
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
  onMount(() => { track(); }); // eager

  const connect = (): void => {
    if (!modalSsid()) return;
    void apiPost("/api/wifi/connect", { ssid: modalSsid(), password: password() });
    setModalSsid(null);
    setPassword("");
  };

  return (
    <div class="p-8 pb-32">
      <h1 class="ui-title text-4xl mb-8">Network</h1>

      <Card>
        <div class="flex items-start justify-between">
          <div>
            <div class="ui-title text-3xl">{net()?.ssid ?? "—"}</div>
            <div class="ui-muted text-base mt-2">
              {net()?.signal_dbm ?? "—"} dBm ({net()?.signal_percent ?? "—"}%)
              · {net()?.frequency_mhz ?? "—"} MHz
            </div>
          </div>
          <Show when={net()?.tailscale}>
            {(ts) => (
              <div class="text-right">
                <div class="text-base" style={{ color: ts().connected ? "var(--success)" : "var(--text-muted)" }}>
                  Tailscale {ts().connected ? "●" : "○"}
                </div>
                <div class="ui-muted text-sm font-mono">{ts().ip ?? "—"}</div>
              </div>
            )}
          </Show>
        </div>
        <div class="grid grid-cols-2 gap-6 mt-6">
          <div>
            <div class="ui-muted text-sm uppercase tracking-wider">Local IP</div>
            <div class="font-mono text-lg mt-1">{net()?.ip_local ?? "—"}</div>
          </div>
          <div>
            <div class="ui-muted text-sm uppercase tracking-wider">Public IP</div>
            <div class="font-mono text-lg mt-1">{net()?.ip_public ?? "—"}</div>
          </div>
        </div>
      </Card>

      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">Ping <span class="ui-muted text-lg font-normal">{fmt(net()?.ping_ms)} ms</span></h2>
        <Sparkline values={pingHist()} max={100} width={980} height={180} />
      </Card>

      <div class="grid grid-cols-2 gap-6 mt-6">
        <Card>
          <h2 class="ui-title text-xl mb-4">↓ Download <span class="ui-muted text-base font-normal">{fmt((net()?.download_bps ?? 0) / 1e6, 1)} Mb/s</span></h2>
          <Sparkline values={dlHist()} width={460} height={160} />
        </Card>
        <Card>
          <h2 class="ui-title text-xl mb-4">↑ Upload <span class="ui-muted text-base font-normal">{fmt((net()?.upload_bps ?? 0) / 1e6, 1)} Mb/s</span></h2>
          <Sparkline values={ulHist()} width={460} height={160} />
        </Card>
      </div>

      <Card class="mt-6">
        <h2 class="ui-title text-2xl mb-4">WiFi networks</h2>
        <div class="flex flex-col gap-3">
          <For each={scan()?.networks ?? []} fallback={<p class="ui-muted text-base">Scanning…</p>}>
            {(w) => (
              <div
                class="flex items-center justify-between py-4 px-5"
                style={{
                  background: "var(--bg-elev-2)",
                  "border-radius": "var(--radius)",
                  border: w.connected ? "2px solid var(--accent)" : "1px solid transparent",
                }}
              >
                <div>
                  <div class="text-lg font-semibold">{w.ssid}</div>
                  <div class="ui-muted text-sm mt-1">
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
      </Card>

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
            width: "100%",
            padding: "12px",
            "border-radius": "var(--radius-sm)",
            background: "var(--bg-elev-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            "font-size": "16px",
            "margin-bottom": "16px",
          }}
        />
        <div class="flex gap-3 justify-end">
          <Button onClick={() => setModalSsid(null)}>Cancel</Button>
          <Button variant="primary" onClick={connect}>Connect</Button>
        </div>
      </Modal>
    </div>
  );
};
