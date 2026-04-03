function updateSysinfoPage(type, data) {
  if (type === 'system') {
    const hwGrid = document.getElementById('sysinfo-hw');
    if (hwGrid) {
      hwGrid.innerHTML = [
        { label: 'CPU', value: data.cpu_model },
        { label: 'GPU', value: data.gpu_model },
        { label: 'RAM', value: data.ram_model },
        { label: 'Storage', value: data.disk_model },
      ].map(item => `
        <div class="sysinfo-item">
          <div class="sysinfo-label">${item.label}</div>
          <div class="sysinfo-value">${item.value}</div>
        </div>
      `).join('');
    }

    const osGrid = document.getElementById('sysinfo-os');
    if (osGrid) {
      osGrid.innerHTML = [
        { label: 'Hostname', value: data.hostname },
        { label: 'Kernel', value: data.kernel },
        { label: 'OS', value: data.os },
        { label: 'Uptime', value: formatUptime(data.uptime_s) },
      ].map(item => `
        <div class="sysinfo-item">
          <div class="sysinfo-label">${item.label}</div>
          <div class="sysinfo-value">${item.value}</div>
        </div>
      `).join('');
    }

    // Docker containers
    const dockerList = document.getElementById('docker-list');
    if (dockerList && data.docker_containers) {
      if (data.docker_containers.length === 0) {
        dockerList.innerHTML = '<div class="wifi-empty">No containers running</div>';
      } else {
        dockerList.innerHTML = data.docker_containers.map(c => `
          <div class="proc-item">
            <span class="proc-name">${c.name}</span>
            <span class="proc-value" style="color:var(--green)">${c.status}</span>
          </div>
        `).join('');
      }
    }
  }

  if (type === 'disk') {
    pushHistory('disk_read', data.io_read_bps || 0);
    pushHistory('disk_write', data.io_write_bps || 0);

    drawSparkline('diskio-chart', [
      { data: history.disk_read, color: '#3FB950', fill: true, fillColor: 'rgba(63,185,80,0.08)' },
      { data: history.disk_write, color: '#F85149', fill: true, fillColor: 'rgba(248,81,73,0.08)' },
    ]);

    if (data.nvme_temp_c !== null) pushHistory('temp_nvme', data.nvme_temp_c);
  }

  if (type === 'cpu' && data.temp_c !== null) {
    pushHistory('temp_cpu', data.temp_c);
  }

  if (type === 'gpu') {
    pushHistory('temp_gpu', data.temp_c);
  }

  // Temperature chart
  if (type === 'cpu' || type === 'gpu' || type === 'disk') {
    drawSparkline('temp-chart', [
      { data: history.temp_cpu, color: '#F85149', max: 100 },
      { data: history.temp_gpu, color: '#F0883E', max: 100 },
      { data: history.temp_nvme, color: '#58A6FF', max: 80 },
    ]);
  }
}
