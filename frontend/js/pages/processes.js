function updateProcessesPage(type, data, skipRender) {
  if (type === 'processes') {
    const list = document.getElementById('proc-cpu-list');
    if (!list || !data.top_cpu) return;

    list.innerHTML = data.top_cpu.slice(0, 8).map(p => `
      <div class="proc-item">
        <span class="proc-name">${p.name}</span>
        <div class="proc-bar">
          <div class="proc-bar-fill" style="width:${Math.min(100, p.cpu_percent / 8)}%;background:var(--blue)"></div>
        </div>
        <span class="proc-value" style="color:var(--blue)">${p.cpu_percent}%</span>
      </div>
    `).join('');
  }

  if (type === 'gpu') {
    const list = document.getElementById('proc-gpu-list');
    if (!list || !data.top_processes) return;

    if (data.top_processes.length === 0) {
      list.innerHTML = '<div class="wifi-empty" style="padding:20px">No GPU processes</div>';
      return;
    }

    list.innerHTML = data.top_processes.map(p => `
      <div class="proc-item">
        <span class="proc-name">${p.name}</span>
        <span class="proc-value" style="color:var(--orange)">${p.vram_mb} MB</span>
      </div>
    `).join('');
  }

  if (type === 'cpu') {
    const grid = document.getElementById('core-grid');
    if (!grid || !data.per_core) return;

    if (grid.children.length !== data.per_core.length) {
      grid.innerHTML = data.per_core.map((_, i) => `
        <div class="core-item">
          <div class="core-label">C${i}</div>
          <div class="core-bar"><div class="core-bar-fill" id="core-fill-${i}"></div></div>
          <div class="core-value" id="core-val-${i}">0%</div>
        </div>
      `).join('');
    }

    data.per_core.forEach((val, i) => {
      const fill = document.getElementById('core-fill-' + i);
      const valEl = document.getElementById('core-val-' + i);
      if (fill) fill.style.width = val + '%';
      if (valEl) valEl.textContent = Math.round(val) + '%';
    });

    if (!skipRender) {
      drawSparkline('history-chart', [
        { data: history.cpu, color: '#58A6FF', max: 100, fill: true, fillColor: 'rgba(88,166,255,0.05)' },
        { data: history.gpu, color: '#F0883E', max: 100, fill: true, fillColor: 'rgba(240,136,62,0.05)' },
        { data: history.memory, color: '#3FB950', max: 100, fill: true, fillColor: 'rgba(63,185,80,0.05)' },
      ]);
    }
  }

  if (type === 'ollama') {
    const el = document.getElementById('ollama-status');
    if (!el) return;
    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('span:last-child');
    if (data.running && data.model) {
      dot.classList.add('active');
      text.textContent = data.model + ' (' + data.status + ')';
    } else if (data.running) {
      dot.classList.add('active');
      text.textContent = 'Idle - no model loaded';
    } else {
      dot.classList.remove('active');
      text.textContent = 'Offline';
    }
  }
}
