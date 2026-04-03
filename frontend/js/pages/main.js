function updateMainPage(type, data) {
  if (type === 'cpu') {
    updateGauge('cpu-gauge', 'cpu-value', data.usage_percent);
    setText('cpu-freq', data.frequency_ghz + ' GHz');
    const tempBadge = document.getElementById('cpu-temp-badge');
    if (tempBadge && data.temp_c !== null) {
      tempBadge.textContent = data.temp_c + '\u00B0C';
      tempBadge.className = 'badge ' + tempClass(data.temp_c);
    }
    pushHistory('cpu', data.usage_percent);
  }

  if (type === 'memory') {
    updateGauge('mem-gauge', 'mem-value', data.percent);
    setText('mem-detail', data.used_gb + ' GB / ' + data.total_gb + ' GB');
    pushHistory('memory', data.percent);
  }

  if (type === 'gpu') {
    updateGauge('gpu-gauge', 'gpu-value', data.utilization_percent);
    setText('gpu-temp', data.temp_c + '\u00B0C');
    setText('gpu-power', data.power_w + 'W');

    const tempBadge = document.getElementById('gpu-temp-badge');
    if (tempBadge) tempBadge.className = 'badge ' + (data.temp_c < 70 ? 'badge-orange' : data.temp_c < 85 ? 'badge-temp-warn' : 'badge-temp-hot');

    const vramBar = document.getElementById('gpu-vram-bar');
    if (vramBar) vramBar.style.width = data.vram_percent + '%';
    setText('gpu-vram-text', Math.round(data.vram_used_mb / 1024 * 10) / 10 + ' GB / ' + Math.round(data.vram_total_mb / 1024 * 10) / 10 + ' GB');

    // GPU process status
    const statusEl = document.getElementById('gpu-process-status');
    if (statusEl && data.top_processes) {
      const dot = statusEl.querySelector('.status-dot');
      const text = statusEl.querySelector('.status-text');
      if (data.top_processes.length > 0) {
        dot.classList.add('active');
        text.textContent = data.top_processes[0].name;
      } else {
        dot.classList.remove('active');
        text.textContent = 'Idle';
      }
    }

    pushHistory('gpu', data.utilization_percent);
  }

  if (type === 'disk') {
    updateGauge('disk-gauge', 'disk-value', data.usage_percent);
    setText('disk-detail', data.used_gb + ' GB / ' + data.total_gb + ' GB');
  }

  if (type === 'network') {
    setText('net-ssid', data.ssid);
    const pingEl = document.getElementById('net-ping');
    if (pingEl && data.ping_ms !== null) {
      pingEl.textContent = Math.round(data.ping_ms);
      pingEl.className = 'net-value ' + pingClass(data.ping_ms);
    }
    setText('net-dl', formatSpeed(data.download_bps));
    setText('net-ul', formatSpeed(data.upload_bps));

    pushHistory('ping', data.ping_ms || 0);
    pushHistory('download', data.download_bps || 0);
    pushHistory('upload', data.upload_bps || 0);
  }

  if (type === 'weather') {
    setText('weather-icon', data.icon);
    setText('weather-temp', data.temp);
  }

  if (type === 'system') {
    setText('hostname', data.hostname);
    setText('uptime', 'uptime ' + formatUptime(data.uptime_s));
  }
}

// Update time/date locally every second
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  setText('time', time);
  setText('date', date.charAt(0).toUpperCase() + date.slice(1));
}

setInterval(updateClock, 1000);
document.addEventListener('DOMContentLoaded', updateClock);
