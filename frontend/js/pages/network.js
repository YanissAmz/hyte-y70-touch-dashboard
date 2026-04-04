function wifiConnectModal(ssid) {
  const overlay = document.getElementById('wifi-modal');
  const title   = document.getElementById('wifi-modal-title');
  const input   = document.getElementById('wifi-modal-input');
  const btnOk   = document.getElementById('wifi-modal-connect');
  const btnCancel = document.getElementById('wifi-modal-cancel');
  if (!overlay) return;

  title.textContent = 'Connexion : ' + ssid;
  input.value = '';
  overlay.classList.add('active');
  // Focus l'input → keyboard.js affichera le clavier virtuel
  setTimeout(() => input.focus(), 100);

  function doConnect() {
    const password = input.value;
    overlay.classList.remove('active');
    fetch('/api/wifi/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid, password })
    });
  }

  function doCancel() {
    overlay.classList.remove('active');
  }

  // Remplacer les listeners (éviter les doublons)
  btnOk.onclick = doConnect;
  btnCancel.onclick = doCancel;
  input.onkeydown = e => { if (e.key === 'Enter') doConnect(); };
}

function updateNetworkPage(type, data, skipRender) {
  if (type === 'network') {
    setText('net2-ssid', data.ssid);
    setText('net2-signal', (data.signal_dbm || '--') + ' dBm (' + (data.signal_percent || '--') + '%)');
    setText('net2-freq', data.frequency_mhz ? (data.frequency_mhz + ' MHz') : '--');
    setText('net2-ip-local', data.ip_local || '--');
    setText('net2-ip-public', data.ip_public || '--');

    if (data.tailscale) {
      const ts = data.tailscale;
      setText('net2-tailscale', ts.status + (ts.ip ? ' (' + ts.ip + ')' : ''));
    }

    setText('ping-value', data.ping_ms !== null ? Math.round(data.ping_ms) + ' ms' : '-- ms');

    if (!skipRender) {
      drawSparkline('ping-chart', [{
        data: history.ping,
        color: '#58A6FF',
        fill: true,
        fillColor: 'rgba(88, 166, 255, 0.1)',
        max: Math.max(100, ...history.ping),
      }]);

      drawSparkline('throughput-chart', [
        { data: history.download, color: '#3FB950', fill: true, fillColor: 'rgba(63, 185, 80, 0.08)' },
        { data: history.upload, color: '#F85149', fill: true, fillColor: 'rgba(248, 81, 73, 0.08)' },
      ]);
    }
  }

  if (type === 'wifi_scan') {
    const list = document.getElementById('wifi-list');
    if (!list || !data.networks) return;

    if (data.networks.length === 0) {
      list.innerHTML = '<div class="wifi-empty">No networks found</div>';
      return;
    }

    list.innerHTML = data.networks.map(n => `
      <div class="wifi-item ${n.connected ? 'connected' : ''}" data-ssid="${n.ssid}">
        <span class="wifi-ssid">${n.ssid}</span>
        <span class="wifi-signal">${n.signal_percent}%</span>
        <span class="wifi-freq">${n.frequency}</span>
        <span class="wifi-security">${n.security}</span>
      </div>
    `).join('');

    // Click to connect — modal custom (window.prompt ne fonctionne pas dans WebKit GTK)
    list.querySelectorAll('.wifi-item:not(.connected)').forEach(item => {
      item.addEventListener('click', () => {
        wifiConnectModal(item.dataset.ssid);
      });
    });
  }
}
