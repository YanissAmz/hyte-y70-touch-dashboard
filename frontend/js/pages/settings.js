// Page 8 — Settings : Volume, Bluetooth, raccourcis
(function() {

  // ── Volume ────────────────────────────────────────────────────────────────
  let _volDebounce = null;

  function initVolume() {
    const slider  = document.getElementById('volume-slider');
    const label   = document.getElementById('volume-value');
    const muteBtn = document.getElementById('volume-mute-btn');
    if (!slider) return;

    // Charger l'état actuel
    fetch('/api/volume').then(r => r.json()).then(d => {
      if (d.level != null) { slider.value = d.level; label.textContent = d.level + '%'; }
      muteBtn.textContent = d.muted ? '🔇' : '🔊';
    }).catch(() => {});

    slider.addEventListener('input', () => {
      label.textContent = slider.value + '%';
      clearTimeout(_volDebounce);
      _volDebounce = setTimeout(() => {
        fetch('/api/volume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: parseInt(slider.value) }),
        });
      }, 250);
    });

    muteBtn.addEventListener('click', () => {
      const nowMuted = muteBtn.textContent === '🔇';
      muteBtn.textContent = nowMuted ? '🔊' : '🔇';
      fetch('/api/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mute: !nowMuted }),
      });
    });
  }

  // ── Bluetooth ─────────────────────────────────────────────────────────────
  function renderBtDevices(devices) {
    const list = document.getElementById('bt-list');
    if (!list) return;
    if (!devices.length) {
      list.innerHTML = '<div class="bt-empty">Aucun appareil jumelé</div>';
      return;
    }
    list.innerHTML = '';
    devices.forEach(dev => {
      const row = document.createElement('div');
      row.className = 'bt-device-row';
      row.innerHTML =
        '<span class="bt-name">' + dev.name + '</span>' +
        '<span class="bt-status ' + (dev.connected ? 'connected' : '') + '">' +
          (dev.connected ? '● Connecté' : '○ Jumelé') +
        '</span>' +
        '<button class="control-btn small bt-toggle" data-addr="' + dev.address + '" data-conn="' + dev.connected + '">' +
          (dev.connected ? 'Déconnecter' : 'Connecter') +
        '</button>';
      list.appendChild(row);
    });

    list.querySelectorAll('.bt-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const addr    = btn.dataset.addr;
        const isConn  = btn.dataset.conn === 'true';
        btn.textContent = '…';
        btn.disabled = true;
        await fetch('/api/bluetooth/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: addr, action: isConn ? 'disconnect' : 'connect' }),
        });
        loadBtDevices();
      });
    });
  }

  async function loadBtDevices() {
    try {
      const res = await fetch('/api/bluetooth');
      const data = await res.json();
      renderBtDevices(data.devices || []);
    } catch (e) {
      const list = document.getElementById('bt-list');
      if (list) list.innerHTML = '<div class="bt-empty">Bluetooth indisponible</div>';
    }
  }

  function initBluetooth() {
    loadBtDevices();
    const scanBtn = document.getElementById('bt-scan-btn');
    if (!scanBtn) return;
    scanBtn.addEventListener('click', async () => {
      scanBtn.textContent = 'Scan…';
      scanBtn.disabled = true;
      try {
        const res = await fetch('/api/bluetooth/scan', { method: 'POST' });
        const data = await res.json();
        renderBtDevices(data.devices || []);
      } catch (e) {}
      scanBtn.textContent = 'Scan';
      scanBtn.disabled = false;
    });
  }

  // ── Raccourcis ────────────────────────────────────────────────────────────
  function initShortcuts() {
    // Luminosité (dupliqué de controls.js)
    const bSlider = document.getElementById('settings-brightness-slider');
    const bLabel  = document.getElementById('settings-brightness-value');
    let _bDebounce = null;
    if (bSlider) {
      bSlider.addEventListener('input', () => {
        bLabel.textContent = bSlider.value + '%';
        clearTimeout(_bDebounce);
        _bDebounce = setTimeout(() => {
          fetch('/api/screen/brightness', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: parseInt(bSlider.value) }),
          });
        }, 300);
      });
    }

    // Écran on/off
    document.getElementById('settings-screen-off')?.addEventListener('click', () => {
      fetch('/api/screen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"off"}' });
    });
    document.getElementById('settings-screen-on')?.addEventListener('click', () => {
      fetch('/api/screen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"on"}' });
    });

    // Redémarrer dashboard (recharge le webview)
    document.getElementById('settings-restart-btn')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initVolume();
    initBluetooth();
    initShortcuts();
  });

})();
