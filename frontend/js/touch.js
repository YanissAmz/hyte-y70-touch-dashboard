let inactivityTimer;
const INACTIVITY_TIMEOUT = 30000;
const SWIPE_THRESHOLD = 40;

let currentPage = 0;
let totalPages = 0;
let track, pages;

function resetInactivity() {
  clearTimeout(inactivityTimer);
  // Don't auto-return when on browser or launcher page
  if (currentPage >= totalPages - 2) return;
  inactivityTimer = setTimeout(() => goToPage(0), INACTIVITY_TIMEOUT);
}

function goToPage(index) {
  if (index < 0) index = totalPages - 1;
  if (index >= totalPages) index = 0;
  currentPage = index;
  track.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
  track.style.transform = 'translateX(-' + (currentPage * 100) + 'vw)';
  updateDots();
}

function navigateTo(pageId) {
  const idx = pages.findIndex(p => p.id === pageId);
  if (idx >= 0) goToPage(idx);
}

function updateDots() {
  document.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('active', i === currentPage);
  });
}

function initTouch() {
  track = document.getElementById('page-track');
  pages = Array.from(track.querySelectorAll('.page'));
  totalPages = pages.length;

  // Inactivity reset
  document.addEventListener('touchstart', resetInactivity, { passive: true });
  document.addEventListener('click', resetInactivity);

  // Swipe detection — only intercept horizontal swipes for page navigation
  // Everything else (taps, vertical scroll, buttons) stays native
  let startX = 0, startY = 0;
  let decided = false, isHorizontal = false;

  document.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    decided = false;
    isHorizontal = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (!decided && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      decided = true;
      isHorizontal = Math.abs(dx) > Math.abs(dy);
      if (isHorizontal) {
        track.style.transition = 'none';
      }
    }

    if (isHorizontal) {
      e.preventDefault();
      const offset = -(currentPage * window.innerWidth) + dx;
      track.style.transform = 'translateX(' + offset + 'px)';
    }
    // Vertical movement: let browser handle natively (page scroll)
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (!isHorizontal) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      goToPage(dx < 0 ? currentPage + 1 : currentPage - 1);
    } else {
      goToPage(currentPage); // snap back
    }
  }, { passive: true });

  // Card navigation via native click (data-link)
  document.querySelectorAll('[data-link]').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', e => {
      e.stopPropagation();
      navigateTo(card.dataset.link);
    });
  });

  // Home button
  document.getElementById('home-btn').addEventListener('click', () => goToPage(0));

  // Dot navigation
  document.querySelectorAll('.dot').forEach(dot => {
    dot.addEventListener('click', () => navigateTo(dot.dataset.page));
  });

  updateDots();
  resetInactivity();
}

document.addEventListener('DOMContentLoaded', initTouch);
