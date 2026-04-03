let ws;
let reconnectDelay = 1000;

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectDelay = 1000;
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      dispatch(msg.type, msg.data);
    } catch (e) {
      console.error('Parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed, reconnecting in', reconnectDelay, 'ms');
    setTimeout(connectWebSocket, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10000);
  };

  ws.onerror = () => {
    ws.close();
  };
}

function dispatch(type, data) {
  updateMainPage(type, data);
  updateNetworkPage(type, data);
  updateProcessesPage(type, data);
  updateSysinfoPage(type, data);
}

document.addEventListener('DOMContentLoaded', connectWebSocket);
