const GAUGE_ARC_DEG = 270;
const GAUGE_START_ANGLE = -225;

function initGauge(circleEl) {
  const r = parseFloat(circleEl.getAttribute('r'));
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * (GAUGE_ARC_DEG / 360);

  circleEl.style.strokeDasharray = `${arcLength} ${circumference}`;
  circleEl.style.strokeDashoffset = arcLength;
  circleEl.dataset.arcLength = arcLength;
  circleEl.dataset.circumference = circumference;
}

function updateGauge(gaugeId, valueId, percent) {
  const circle = document.getElementById(gaugeId);
  const valueEl = document.getElementById(valueId);
  if (!circle) return;

  if (!circle.dataset.arcLength) initGauge(circle);

  const arcLength = parseFloat(circle.dataset.arcLength);
  const filled = arcLength * (Math.min(100, Math.max(0, percent)) / 100);
  circle.style.strokeDashoffset = arcLength - filled;

  if (valueEl) {
    const text = Math.round(percent) + '%';
    if (valueEl.textContent !== text) valueEl.textContent = text;
  }
}

// Initialize all gauges on page load
function initAllGauges() {
  document.querySelectorAll('.gauge-fg').forEach(initGauge);
  document.querySelectorAll('.gauge-bg').forEach(bg => {
    const r = parseFloat(bg.getAttribute('r'));
    const circumference = 2 * Math.PI * r;
    const arcLength = circumference * (GAUGE_ARC_DEG / 360);
    bg.style.strokeDasharray = `${arcLength} ${circumference}`;
    bg.style.strokeDashoffset = 0;
  });
}

document.addEventListener('DOMContentLoaded', initAllGauges);
