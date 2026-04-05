function initControls() {
  // Effect buttons
  document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      fetch('/api/leds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effect: btn.dataset.effect })
      });
    });
  });

  // LED presets (couleur statique → désactive l'effet actif)
  document.querySelectorAll('.led-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      // Preset couleur → passer en mode statique
      document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.effect-btn[data-effect="static"]')?.classList.add('active');
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

    // Roue hue pure — saturation 100% partout pour des couleurs LED vibrantes
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
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

  // Brightness slider
  const brightnessSlider = document.getElementById('brightness-slider');
  const brightnessValue = document.getElementById('brightness-value');
  let brightnessTimer = null;
  if (brightnessSlider) {
    brightnessSlider.addEventListener('input', () => {
      const level = parseInt(brightnessSlider.value);
      if (brightnessValue) brightnessValue.textContent = level + '%';
      // Debounce — envoyer 300ms après la fin du glissement
      clearTimeout(brightnessTimer);
      brightnessTimer = setTimeout(() => {
        fetch('/api/screen/brightness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level })
        });
      }, 300);
    });
  }

  // Desktop mode button
  const desktopBtn = document.getElementById('desktop-mode-btn');
  if (desktopBtn) {
    desktopBtn.addEventListener('click', () => {
      // Via WebKit message handler si disponible (plus réactif)
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.dashboard) {
        window.webkit.messageHandlers.dashboard.postMessage('desktop-mode');
      } else {
        // Fallback : passer par l'API REST (webview.py poll le signal file)
        fetch('/api/desktop-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enter' })
        });
      }
    });
  }

  // Power profiles
  function refreshPowerProfile() {
    fetch('/api/power').then(r => r.json()).then(data => {
      document.querySelectorAll('.power-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.profile === data.current);
      });
    }).catch(() => {});
  }
  document.querySelectorAll('.power-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      fetch('/api/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: btn.dataset.profile })
      }).then(() => refreshPowerProfile());
    });
  });
  refreshPowerProfile();

  // Haptic LED toggle (persist in localStorage)
  const haptic = document.getElementById('haptic-toggle');
  if (haptic) {
    haptic.checked = localStorage.getItem('hapticLED') === '1';
    window.hapticLED = haptic.checked;
    haptic.addEventListener('change', () => {
      window.hapticLED = haptic.checked;
      localStorage.setItem('hapticLED', haptic.checked ? '1' : '0');
    });
  }

  // Vérifier le statut OpenRGB
  fetch('/api/leds/status').then(r => r.json()).then(data => {
    const badge = document.getElementById('led-status-badge');
    if (!badge) return;
    if (data.available) {
      badge.textContent = `OpenRGB ✓ (${data.devices.length} device${data.devices.length > 1 ? 's' : ''})`;
      badge.className = 'badge badge-green';
    } else {
      badge.textContent = 'OpenRGB offline';
      badge.className = 'badge badge-red';
    }
  }).catch(() => {});

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
