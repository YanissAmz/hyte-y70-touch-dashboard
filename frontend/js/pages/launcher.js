// App launcher — apps natives + web
(function() {
  const NATIVE_APPS = [
    { name: 'Terminal',    icon: '⬛', color: '#3FB950', key: 'terminal' },
    { name: 'Fichiers',    icon: '📁', color: '#58A6FF', key: 'files'    },
    { name: 'Paramètres', icon: '⚙️',  color: '#8B949E', key: 'settings' },
    { name: 'Firefox',    icon: '🌐', color: '#F78166', key: 'firefox'   },
    { name: 'VS Code',    icon: '🔷', color: '#56D4DD', key: 'code'      },
    { name: 'Spotify',    icon: '🎵', color: '#1DB954', key: 'spotify'   },
  ];

  const WEB_APPS = [
    { name: 'Google',   icon: '🔍', color: '#4285F4', url: 'https://www.google.com'    },
    { name: 'YouTube',  icon: '▶️',  color: '#FF0000', url: 'https://www.youtube.com'  },
    { name: 'ChatGPT',  icon: '🤖', color: '#10A37F', url: 'https://chat.openai.com'  },
    { name: 'Claude',   icon: '🧠', color: '#D97706', url: 'https://claude.ai'         },
    { name: 'GitHub',   icon: '🐙', color: '#8B5CF6', url: 'https://github.com'        },
    { name: 'Spotify',  icon: '🎵', color: '#1DB954', url: 'https://open.spotify.com' },
    { name: 'Reddit',   icon: '📰', color: '#FF4500', url: 'https://www.reddit.com'    },
    { name: 'Twitter',  icon: '🐦', color: '#1DA1F2', url: 'https://x.com'             },
    { name: 'Grafana',  icon: '📊', color: '#F46800', url: 'http://localhost:3000'      },
  ];

  function makeItem(label, icon, color, onClick) {
    const item = document.createElement('div');
    item.className = 'launcher-item';
    item.innerHTML =
      '<div class="launcher-icon" style="background:' + color + '22">' + icon + '</div>' +
      '<div class="launcher-name">' + label + '</div>';
    item.addEventListener('click', onClick);
    return item;
  }

  async function launchNative(key) {
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: key }),
      });
      const data = await res.json();
      if (data.status === 'error') console.warn('launch error:', data.message);
    } catch (e) {
      console.warn('launch failed:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const nativeGrid = document.getElementById('launcher-native-grid');
    const webGrid    = document.getElementById('launcher-web-grid');
    if (!nativeGrid || !webGrid) return;

    NATIVE_APPS.forEach(app => {
      nativeGrid.appendChild(makeItem(app.name, app.icon, app.color, () => launchNative(app.key)));
    });

    WEB_APPS.forEach(app => {
      webGrid.appendChild(makeItem(app.name, app.icon, app.color, () => {
        if (window.browserLoadURL) window.browserLoadURL(app.url);
      }));
    });
  });
})();
