const MAX_HISTORY = 300;

const history = {
  cpu: [],
  gpu: [],
  memory: [],
  ping: [],
  download: [],
  upload: [],
  disk_read: [],
  disk_write: [],
  temp_cpu: [],
  temp_gpu: [],
  temp_nvme: [],
};

function pushHistory(key, value) {
  if (!(key in history)) return;
  history[key].push(value);
  if (history[key].length > MAX_HISTORY) history[key].shift();
}

function drawSparkline(canvasId, datasets, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // HiDPI scaling
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }
  const w = rect.width;
  const h = rect.height;
  const pad = options.padding || 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const ds of datasets) {
    const data = ds.data;
    if (!data || data.length < 2) continue;

    const max = ds.max || Math.max(...data, 1);
    const min = ds.min || 0;
    const range = max - min || 1;

    const step = (w - pad * 2) / (data.length - 1);

    ctx.beginPath();
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = ds.lineWidth || 2;
    ctx.lineJoin = 'round';

    for (let i = 0; i < data.length; i++) {
      const x = pad + i * step;
      const y = h - pad - ((data[i] - min) / range) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (ds.fill) {
      ctx.lineTo(pad + (data.length - 1) * step, h - pad);
      ctx.lineTo(pad, h - pad);
      ctx.closePath();
      ctx.fillStyle = ds.fillColor || ds.color.replace(')', ', 0.1)').replace('rgb', 'rgba');
      ctx.fill();
    }
  }
}
