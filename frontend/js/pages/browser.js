// Browser page — uses WebKit message handler to navigate the webview directly
(function() {
  function loadURL(url) {
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      }
    }
    // Send URL to Python webview via WebKit message handler
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.dashboard) {
      window.webkit.messageHandlers.dashboard.postMessage(url);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const goBtn = document.getElementById('browser-go');
    const urlInput = document.getElementById('browser-url');
    if (goBtn) {
      goBtn.addEventListener('click', () => loadURL(urlInput.value));
    }
    if (urlInput) {
      urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') loadURL(e.target.value);
      });
    }
  });

  // Expose for launcher
  window.browserLoadURL = function(url) {
    loadURL(url);
  };
})();
