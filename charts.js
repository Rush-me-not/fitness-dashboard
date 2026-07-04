/**
 * Hermes Fitness Dashboard — Chart Renderers.
 * Called by app.js after DOM elements are created.
 */

function renderWeeklyVolumeChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const weeks = window.FD?.weekly_summary?.weeks || [];
  if (!weeks.length) return;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks.map(w => w.week).reverse(),
      datasets: [{
        label: 'Volume (lbs)',
        data: weeks.map(w => w.volume_lbs).reverse(),
        backgroundColor: '#5b9bd588',
        borderColor: '#5b9bd5',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b6b7b', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#252530' } },
        y: { ticks: { color: '#6b6b7b', font: { size: 10 } }, grid: { color: '#252530' }, beginAtZero: true },
      },
    },
  });
}

function renderQualityTrendChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const reviews = window.FD?.coaching_reviews?.sessions || [];
  if (!reviews.length) return;

  const data = [...reviews].reverse();

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(r => r.date),
      datasets: [{
        label: 'Quality Score',
        data: data.map(r => r.quality_score),
        borderColor: '#2ea043',
        backgroundColor: '#2ea04322',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#2ea043',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b6b7b', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: '#252530' } },
        y: { ticks: { color: '#6b6b7b', font: { size: 10 } }, grid: { color: '#252530' }, min: 0, max: 100 },
      },
    },
  });
}
