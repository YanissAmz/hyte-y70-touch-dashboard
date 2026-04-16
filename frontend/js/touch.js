let inactivityTimer;
const INACTIVITY_TIMEOUT = 30000;
const SWIPE_THRESHOLD = 40;

let currentPage = 0;
let totalPages = 0;
let track, pages;

function resetInactivity() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => goToPage(0), INACTIVITY_TIMEOUT);
}

function goToPage(index) {
  if (index < 0) index = totalPages - 1;
  if (index >= totalPages) index = 0;
  currentPage = index;
  track.style.transition = 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)';
  track.style.transform = 'translateX(-' + (currentPage * 100) + 'vw)';
  updateDots();
  // Animation scale-in sur la page cible
  var targetPage = pages[currentPage];
  if (targetPage) {
    targetPage.classList.remove('page-entering');
    requestAnimationFrame(function() {
      targetPage.classList.add('page-entering');
      targetPage.addEventListener('animationend', function() {
        targetPage.classList.remove('page-entering');
      }, { once: true });
    });
  }
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

function spawnRipple(x, y) {
  var ripple = document.createElement('div');
  ripple.className = 'ripple-wave';
  var size = 160;
  ripple.style.cssText = 'width:' + size + 'px;height:' + size + 'px;' +
    'left:' + (x - size / 2) + 'px;top:' + (y - size / 2) + 'px;' +
    'position:fixed;';
  document.body.appendChild(ripple);
  ripple.addEventListener('animationend', function() { ripple.remove(); }, { once: true });
}

function simulateTap(x, y) {
  spawnRipple(x, y);
  var el = document.elementFromPoint(x, y);
  if (!el) return;

  // Focus inputs
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    el.focus();
    el.click();
    return;
  }

  // Walk up to find clickable parent
  var target = el;
  while (target && target !== document.body) {
    if (target.dataset && target.dataset.link) {
      navigateTo(target.dataset.link);
      return;
    }
    if (target.tagName === 'BUTTON' || target.tagName === 'A' ||
        target.hasAttribute('onclick') ||
        target.classList.contains('led-preset') ||
        target.classList.contains('wallpaper-thumb') ||
        target.classList.contains('wifi-item') ||
        target.classList.contains('dot') ||
        target.classList.contains('control-btn') ||
        target.id === 'home-btn') {
      target.click();
      return;
    }
    target = target.parentElement;
  }
  el.click();
}

function initTouch() {
  track = document.getElementById('page-track');
  pages = Array.from(track.querySelectorAll('.page'));
  totalPages = pages.length;

  document.addEventListener('touchstart', resetInactivity, { passive: true });

  var startX = 0, startY = 0, lastY = 0;
  var decided = false, isHorizontal = false, moved = false;

  document.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    lastY = t.clientY;
    decided = false;
    isHorizontal = false;
    moved = false;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    var t = e.touches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;

    if (!decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      decided = true;
      isHorizontal = Math.abs(dx) >= Math.abs(dy);
      if (isHorizontal) track.style.transition = 'none';
      moved = true;
    }

    if (!decided) { e.preventDefault(); return; }

    if (isHorizontal) {
      e.preventDefault();
      var offset = -(currentPage * window.innerWidth) + dx;
      track.style.transform = 'translateX(' + offset + 'px)';
    } else {
      // Vertical scroll within current page
      var page = pages[currentPage];
      if (page) {
        page.scrollTop -= (t.clientY - lastY);
      }
      lastY = t.clientY;
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    var t = e.changedTouches[0];
    var dx = t.clientX - startX;
    if (!moved) {
      simulateTap(t.clientX, t.clientY);
      return;
    }
    if (isHorizontal) {
      if (Math.abs(dx) > SWIPE_THRESHOLD) {
        goToPage(dx < 0 ? currentPage + 1 : currentPage - 1);
      } else {
        goToPage(currentPage);
      }
    }
  }, { passive: true });

  // Click handlers (triggered by simulateTap)
  document.querySelectorAll('.dot').forEach(function(dot) {
    dot.addEventListener('click', function() { navigateTo(dot.dataset.page); });
  });
  document.getElementById('home-btn').addEventListener('click', function() { goToPage(0); });

  updateDots();
  resetInactivity();
}

document.addEventListener('DOMContentLoaded', initTouch);
