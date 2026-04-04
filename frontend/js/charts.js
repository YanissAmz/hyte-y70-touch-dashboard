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

/* Smooth bezier path (Catmull-Rom → cubic bezier control points) */
function buildSmoothPath(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

function drawSparkline(canvasId, datasets, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // HiDPI scaling
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);
  }
  const w   = rect.width;
  const h   = rect.height;
  const pad = options.padding || 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const ds of datasets) {
    const data = ds.data;
    if (!data || data.length < 2) continue;

    const max   = ds.max || Math.max(...data, 1);
    const min   = ds.min || 0;
    const range = max - min || 1;
    const step  = (w - pad * 2) / (data.length - 1);

    const pts = data.map((v, i) => ({
      x: pad + i * step,
      y: h - pad - ((v - min) / range) * (h - pad * 2),
    }));

    // Gradient fill sous la courbe
    if (ds.fill) {
      const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
      const base = ds.color;
      grad.addColorStop(0,   base.replace(')', ', 0.28)').replace('rgb(', 'rgba(').replace('#', 'rgba(').includes('rgba') ? base.replace(')', ', 0.28)').replace('rgb(', 'rgba(') : hexToRgba(base, 0.28));
      grad.addColorStop(1,   hexToRgba(base, 0.0));

      ctx.beginPath();
      buildSmoothPath(ctx, pts);
      ctx.lineTo(pts[pts.length - 1].x, h - pad);
      ctx.lineTo(pts[0].x, h - pad);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Ligne lissée
    ctx.beginPath();
    ctx.strokeStyle = ds.color;
    ctx.lineWidth   = ds.lineWidth || 2.5;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    buildSmoothPath(ctx, pts);
    ctx.stroke();

    // Dot sur la dernière valeur
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = ds.color;
    ctx.fill();
    // Halo autour du dot
    ctx.beginPath();
    ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(ds.color.startsWith('#') ? ds.color : ds.color, 0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function hexToRgba(hex, alpha) {
  // Gère #RRGGBB et rgb(...) et rgba(...)
  if (hex.startsWith('rgba')) return hex.replace(/[\d.]+\)$/, alpha + ')');
  if (hex.startsWith('rgb'))  return hex.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
