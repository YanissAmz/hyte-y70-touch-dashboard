function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 1) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  return (bytesPerSec / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  let parts = [];
  if (d > 0) parts.push(d + 'd');
  if (h > 0) parts.push(h + 'h');
  parts.push(m + 'm');
  return parts.join(' ');
}

function tempClass(temp) {
  if (temp === null || temp === undefined) return '';
  if (temp < 60) return 'badge-temp-ok';
  if (temp < 80) return 'badge-temp-warn';
  return 'badge-temp-hot';
}

function pingClass(ms) {
  if (ms === null || ms === undefined) return '';
  if (ms < 20) return 'ping-good';
  if (ms < 50) return 'ping-ok';
  return 'ping-bad';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && el.textContent !== String(text)) {
    el.textContent = text;
    el.classList.add('value-changed');
    setTimeout(() => el.classList.remove('value-changed'), 300);
  }
}
