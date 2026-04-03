let inactivityTimer;
const INACTIVITY_TIMEOUT = 30000;

function resetInactivity() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    navigateTo('page-main');
  }, INACTIVITY_TIMEOUT);
}

function navigateTo(pageId) {
  const container = document.getElementById('page-container');
  const target = document.getElementById(pageId);
  if (container && target) {
    const pageIndex = Array.from(container.children).indexOf(target);
    if (pageIndex >= 0) {
      container.scrollTo({ top: pageIndex * container.clientHeight, behavior: 'smooth' });
    }
  }
}

function initTouch() {
  const container = document.getElementById('page-container');

  document.addEventListener('touchstart', resetInactivity, { passive: true });
  document.addEventListener('mousedown', resetInactivity);
  document.addEventListener('click', resetInactivity);

  // Card tap navigation
  document.querySelectorAll('[data-link]').forEach(card => {
    let touchStart = { x: 0, y: 0, t: 0 };

    card.addEventListener('touchstart', e => {
      touchStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: Date.now()
      };
    }, { passive: true });

    card.addEventListener('touchend', e => {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStart.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStart.y);
      if (Date.now() - touchStart.t < 300 && dx < 15 && dy < 15) {
        e.preventDefault();
        navigateTo(card.dataset.link);
      }
    });

    // Mouse fallback for desktop testing
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateTo(card.dataset.link);
    });
  });

  // Home button
  document.getElementById('home-btn').addEventListener('click', () => {
    navigateTo('page-main');
  });
  document.getElementById('home-btn').addEventListener('touchend', (e) => {
    e.preventDefault();
    navigateTo('page-main');
  });

  // Dot navigation
  document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => navigateTo(dot.dataset.page));
    dot.addEventListener('touchend', (e) => {
      e.preventDefault();
      navigateTo(dot.dataset.page);
    });
  });

  // Track current page via scroll position
  if (container) {
    container.addEventListener('scroll', () => {
      const pageHeight = container.clientHeight;
      const currentPage = Math.round(container.scrollTop / pageHeight);
      const pages = container.querySelectorAll('.page');
      document.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentPage);
      });
    }, { passive: true });
  }

  resetInactivity();
}

document.addEventListener('DOMContentLoaded', initTouch);
