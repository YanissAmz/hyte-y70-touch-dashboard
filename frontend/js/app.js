let ws;
let reconnectDelay = 1000;

// ── Gestion idle ──────────────────────────────────────────────────────────────
// Après IDLE_PAUSE_MS sans interaction, on arrête de redessiner les charts
// (les données continuent d'arriver en cache mais rien n'est rendu).
const IDLE_PAUSE_MS = 2 * 60 * 1000; // 2 minutes
let isIdle = false;
let idleTimer = null;

function wakeUp() {
  if (isIdle) {
    isIdle = false;
    // Forcer un redraw immédiat des charts au réveil
    dispatch('_wake', {});
  }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { isIdle = true; }, IDLE_PAUSE_MS);
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    reconnectDelay = 1000;
    wakeUp();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      // On met toujours les données en cache (pushHistory)
      // mais on ne redessine les charts que si pas idle
      dispatch(msg.type, msg.data, isIdle);
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10000);
  };

  ws.onerror = () => { ws.close(); };
}

function dispatch(type, data, skipRender) {
  updateMainPage(type, data, skipRender);
  updateNetworkPage(type, data, skipRender);
  updateProcessesPage(type, data, skipRender);
  updateSysinfoPage(type, data, skipRender);
  if (type === 'notifications') updateNotifications(data.list);
}

document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();
  // Réveil sur tout touch
  document.addEventListener('touchstart', wakeUp, { passive: true });
  wakeUp();
});
