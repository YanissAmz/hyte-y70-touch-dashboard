function initControls() {
  // LED presets
  document.querySelectorAll('.led-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = parseInt(btn.dataset.r);
      const g = parseInt(btn.dataset.g);
      const b = parseInt(btn.dataset.b);
      if (r === 0 && g === 0 && b === 0) {
        fetch('/api/leds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: 'off' })
        });
      } else {
        fetch('/api/leds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r, g, b })
        });
      }
    });
  });

  // Color wheel
  const canvas = document.getElementById('color-wheel');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const cx = 150, cy = 150, radius = 140;

    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, '#fff');
      gradient.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * canvas.width / rect.width;
      const y = (e.clientY - rect.top) * canvas.height / rect.height;
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      fetch('/api/leds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r: pixel[0], g: pixel[1], b: pixel[2] })
      });
    });
  }

  // Screen controls
  const screenOff = document.getElementById('screen-off-btn');
  const screenOn = document.getElementById('screen-on-btn');
  if (screenOff) screenOff.addEventListener('click', () => {
    fetch('/api/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'off' })
    });
  });
  if (screenOn) screenOn.addEventListener('click', () => {
    fetch('/api/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'on' })
    });
  });

  // Load wallpapers
  fetch('/api/wallpapers').then(r => r.json()).then(wallpapers => {
    const gallery = document.getElementById('wallpaper-gallery');
    if (!gallery) return;
    gallery.innerHTML = wallpapers.map(name => `
      <div class="wallpaper-thumb" data-name="${name}">
        <img src="/wallpapers/${name}" alt="${name}" loading="lazy">
      </div>
    `).join('');

    gallery.querySelectorAll('.wallpaper-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        fetch('/api/wallpaper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: thumb.dataset.name })
        });
      });
    });
  });
}

function controlService(name, action) {
  fetch('/api/services/' + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
}

document.addEventListener('DOMContentLoaded', initControls);
