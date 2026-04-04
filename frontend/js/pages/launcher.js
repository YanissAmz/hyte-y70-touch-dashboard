// App launcher page
(function() {
  const APPS = [
    { name: 'Google',     icon: '🔍', color: '#4285F4', url: 'https://www.google.com' },
    { name: 'YouTube',    icon: '▶️',  color: '#FF0000', url: 'https://www.youtube.com' },
    { name: 'ChatGPT',    icon: '🤖', color: '#10A37F', url: 'https://chat.openai.com' },
    { name: 'Claude',     icon: '🧠', color: '#D97706', url: 'https://claude.ai' },
    { name: 'GitHub',     icon: '🐙', color: '#8B5CF6', url: 'https://github.com' },
    { name: 'Spotify',    icon: '🎵', color: '#1DB954', url: 'https://open.spotify.com' },
    { name: 'Reddit',     icon: '📰', color: '#FF4500', url: 'https://www.reddit.com' },
    { name: 'Twitter',    icon: '🐦', color: '#1DA1F2', url: 'https://x.com' },
    { name: 'Grafana',    icon: '📊', color: '#F46800', url: 'http://localhost:3000' },
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('launcher-grid');
    if (!grid) return;

    APPS.forEach(app => {
      const item = document.createElement('div');
      item.className = 'launcher-item';
      item.innerHTML =
        '<div class="launcher-icon" style="background:' + app.color + '22">' + app.icon + '</div>' +
        '<div class="launcher-name">' + app.name + '</div>';
      item.addEventListener('click', () => {
        if (window.browserLoadURL) window.browserLoadURL(app.url);
      });
      grid.appendChild(item);
    });
  });
})();
