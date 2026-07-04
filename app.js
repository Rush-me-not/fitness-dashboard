/**
 * Hermes Fitness Dashboard — Application Logic.
 * Loads JSON data, manages state, renders all views.
 */
const DATA = {};
const STATE = {
  tab: 'overview',
  filterExercise: '',
  filterMuscle: '',
  filterDateFrom: '',
  filterDateTo: '',
  decisionFilter: 'all',
};

// Expose DATA globally so charts.js can access it
window.FD = DATA;

// ── Init ──────────────────────────────────────────────────────────────

async function init() {
  const files = [
    'workouts', 'exercises', 'progression', 'prs',
    'weekly_summary', 'coaching_reviews', 'decision_history', 'system_health',
    'workout_insights'
  ];

  const results = await Promise.allSettled(
    files.map(f => fetch(`dashboard-data/${f}.json`).then(r => r.json()))
  );

  files.forEach((f, i) => {
    DATA[f] = results[i].status === 'fulfilled' ? results[i].value : null;
  });

  document.getElementById('last-updated').textContent =
    'Updated: ' + (DATA.weekly_summary?.exported_at || 'unknown');
  document.getElementById('data-age').textContent =
    'Data exported: ' + (DATA.weekly_summary?.exported_at || 'N/A');

  setupNavigation();
  renderTab('overview');
}

// ── Navigation ────────────────────────────────────────────────────────

function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab);
    });
  });
}

function renderTab(tab) {
  STATE.tab = tab;
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  switch (tab) {
    case 'overview': renderOverview(main); break;
    case 'history': renderHistory(main); break;
    case 'progression': renderProgression(main); break;
    case 'muscles': renderMuscles(main); break;
    case 'insights': renderInsights(main); break;
    case 'decisions': renderDecisions(main); break;
    case 'health': renderHealth(main); break;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function fmt(n) {
  if (n == null) return '—';
  if (typeof n === 'number') return n.toLocaleString();
  return n;
}

// ── Overview ──────────────────────────────────────────────────────────

function renderOverview(container) {
  const workouts = DATA.workouts || [];
  const reviews = DATA.coaching_reviews?.sessions || [];
  const decisions = DATA.decision_history || {};
  const system = DATA.system_health || {};

  const totalVol = workouts.reduce((s, w) => s + (w.total_volume_lbs || 0), 0);
  const totalSets = workouts.reduce((s, w) => s + (w.total_sets || 0), 0);
  const avgScore = reviews.length ? reviews.reduce((s, r) => s + (r.quality_score || 0), 0) / reviews.length : 0;
  const decSuccess = decisions.success_rate?.overall || 0;

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="value">${workouts.length}</div><div class="label">Total Workouts</div></div>
      <div class="kpi"><div class="value">${fmt(totalVol)}</div><div class="label">Total Volume (lbs)</div></div>
      <div class="kpi"><div class="value">${fmt(totalSets)}</div><div class="label">Total Sets</div></div>
      <div class="kpi"><div class="value">${(DATA.prs || []).length}</div><div class="label">Personal Records</div></div>
      <div class="kpi ${avgScore >= 70 ? 'trend-up' : ''}"><div class="value">${avgScore.toFixed(0)}</div><div class="label">Avg Quality Score</div></div>
      <div class="kpi ${decSuccess >= 50 ? 'trend-up' : 'warn'}"><div class="value">${decSuccess}%</div><div class="label">Decision Success Rate</div></div>
    </div>
    <div class="card-grid">
      <div class="chart-box"><h3 style="color:var(--muted);margin-bottom:8px;">Weekly Volume</h3><canvas id="overview-weekly-chart"></canvas></div>
      <div class="chart-box"><h3 style="color:var(--muted);margin-bottom:8px;">Workout Quality Trend</h3><canvas id="overview-quality-chart"></canvas></div>
    </div>
    ${system.overall ? `
    <div class="card">
      <h3>System Health: <span style="color:${system.overall==='healthy'?'var(--green)':'var(--yellow)'}">${system.overall.toUpperCase()}</span></h3>
      <p style="color:var(--muted);font-size:0.9em;">${system.healthy || 0} healthy, ${(system.warnings||[]).length} warnings</p>
    </div>` : ''}
  `;

  // Render charts
  setTimeout(() => {
    try {
      renderWeeklyVolumeChart('overview-weekly-chart');
      renderQualityTrendChart('overview-quality-chart');
    } catch(e) {
      console.error('Chart error:', e);
    }
  }, 200);
}

// ── History ───────────────────────────────────────────────────────────

function renderHistory(container) {
  const workouts = DATA.workouts || [];
  const reviews = DATA.coaching_reviews?.sessions || [];
  const reviewMap = {};
  reviews.forEach(r => reviewMap[r.id || r.date] = r);

  container.innerHTML = `
    <div class="filter-bar">
      <input type="text" id="history-search" placeholder="Search exercises...">
      <select id="history-focus"><option value="">All focuses</option></select>
    </div>
    <div id="history-list"></div>
  `;

  // Populate focus filter
  const focuses = [...new Set(workouts.map(w => w.focus).filter(Boolean))];
  const focusSelect = $('#history-focus');
  focuses.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f; opt.textContent = f;
    focusSelect.appendChild(opt);
  });

  function filterAndRender() {
    const search = ($('#history-search')?.value || '').toLowerCase();
    const focus = $('#history-focus')?.value || '';

    let filtered = workouts;
    if (focus) filtered = filtered.filter(w => w.focus === focus);
    if (search) filtered = filtered.filter(w =>
      w.exercises?.some(ex => ex.name.toLowerCase().includes(search))
    );

    const list = $('#history-list');
    list.innerHTML = filtered.map(w => {
      const r = reviewMap[w.id] || {};
      const grade = r.grade || '';
      return `
      <div class="session-row" data-sid="${w.id}">
        <div class="session-header" onclick="toggleSession(${w.id})">
          <span class="session-date">${w.date}</span>
          <span class="session-focus">${w.focus || 'Workout'}</span>
          <span class="session-meta">${w.exercise_count} exercises · ${w.total_sets} sets · ${fmt(w.total_volume_lbs)} lbs</span>
          ${grade ? `<span class="session-grade grade-${grade}">${grade}</span>` : ''}
        </div>
        <div class="session-detail" id="detail-${w.id}">
          ${(w.exercises || []).map(ex => {
            // Build per-set rep string (e.g., "8-8-7" or "3×8")
            const repList = (ex.sets || []).map(s => s.reps).join('-');
            const repDisplay = repList || `${ex.total_sets}×${Math.round(ex.total_reps/ex.total_sets)}`;
            // Per-set weight string
            const weights = [...new Set((ex.sets || []).map(s => s.weight_lbs || s.weight_kg || 0).filter(w => w>0))];
            const wtDisplay = weights.length === 1 ? weights[0] + ' lbs' : 
                             weights.length > 1 ? weights.join('/') + ' lbs' : 
                             ex.max_weight_lbs > 0 ? fmt(ex.max_weight_lbs) + ' lbs' : 'BW';
            return `
          <div class="exercise-row">
            <span class="ex-name">${ex.name}</span>
            <span class="ex-sets">${ex.total_sets}×${repDisplay}</span>
            <span class="ex-weight">${wtDisplay}</span>
            <span class="ex-status status-${ex.status || 'completed'}">${ex.status || 'done'}</span>
          </div>`}).join('')}
          ${w.notes ? `<p style="color:var(--muted);font-size:0.85em;margin-top:8px;">📝 ${w.notes}</p>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  $('#history-search')?.addEventListener('input', filterAndRender);
  $('#history-focus')?.addEventListener('change', filterAndRender);
  filterAndRender();
}

function toggleSession(id) {
  const detail = document.getElementById('detail-' + id);
  if (detail) detail.classList.toggle('open');
}

// ── Progression ────────────────────────────────────────────────────────

function renderProgression(container) {
  const progression = DATA.progression || {};
  const exercises = Object.keys(progression).sort();

  container.innerHTML = `
    <div class="filter-bar">
      <input type="text" id="prog-search" placeholder="Search exercise...">
    </div>
    <div class="card-grid" id="prog-grid"></div>
  `;

  function renderCharts(filter) {
    const grid = $('#prog-grid');
    grid.innerHTML = '';
    const filtered = filter ? exercises.filter(e => e.toLowerCase().includes(filter)) : exercises;

    if (filtered.length === 0) {
      grid.innerHTML = '<p style="color:var(--muted);">No exercises found.</p>';
      return;
    }

    filtered.slice(0, 12).forEach((name, i) => {
      const data = progression[name] || [];
      const card = document.createElement('div');
      card.className = 'chart-box';
      card.innerHTML = `<h3 style="color:var(--muted);margin-bottom:8px;">${name}</h3>
        <canvas id="prog-chart-${i}"></canvas>
        <p style="color:var(--muted);font-size:0.8em;margin-top:4px;">
          ${data.length} sessions · Latest: ${data[data.length-1]?.max_weight_lbs || 0} lbs
        </p>`;
      grid.appendChild(card);

      setTimeout(() => {
        const canvas = document.getElementById('prog-chart-' + i);
        if (!canvas || !data.length) return;
        new Chart(canvas, {
          type: 'line',
          data: {
            labels: data.map(d => d.date),
            datasets: [{
              label: 'Weight (lbs)',
              data: data.map(d => d.max_weight_lbs),
              borderColor: '#5b9bd5',
              backgroundColor: '#5b9bd522',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
            }],
          },
          options: chartOptions(),
        });
      }, 50);
    });
  }

  const search = $('#prog-search');
  if (search) {
    search.addEventListener('input', e => renderCharts(e.target.value.toLowerCase()));
  }
  renderCharts('');
}

// ── Muscles ────────────────────────────────────────────────────────────

function renderMuscles(container) {
  const exercises = DATA.exercises || {};
  const progression = DATA.progression || {};

  // Aggregate by muscle group
  const groups = {};
  for (const [cid, meta] of Object.entries(exercises)) {
    const mg = meta.muscle_group || 'unknown';
    if (!groups[mg]) groups[mg] = { exercises: [], totalVolume: 0, sessions: 0 };

    // Find progression data by display name
    const name = meta.canonical_name || meta.display_name || cid;
    const prog = progression[name] || [];
    const vol = prog.reduce((s, d) => s + (d.volume_lbs || 0), 0);

    groups[mg].exercises.push(name);
    groups[mg].totalVolume += vol;
    groups[mg].sessions = Math.max(groups[mg].sessions, prog.length);
  }

  const maxVol = Math.max(...Object.values(groups).map(g => g.totalVolume), 1);

  container.innerHTML = `
    <div class="muscle-grid">
      ${Object.entries(groups).map(([name, data]) => {
        const pct = (data.totalVolume / maxVol * 100);
        const cls = pct > 50 ? 'volume-high' : pct > 20 ? 'volume-mid' : 'volume-low';
        return `
        <div class="muscle-card">
          <div class="name">${name.charAt(0).toUpperCase() + name.slice(1)}</div>
          <div class="volume ${cls}">${fmt(data.totalVolume)}</div>
          <div class="detail">lbs total volume</div>
          <div class="detail">${data.exercises.length} exercises · ${data.sessions} sessions</div>
          <div class="balance-bar"><div class="balance-fill" style="width:${pct}%;background:${pct>50?'var(--accent)':pct>20?'var(--accent2)':'var(--muted)'}"></div></div>
        </div>`;
      }).join('')}
    </div>
    <div class="chart-box"><h3 style="color:var(--muted);margin-bottom:8px;">Muscle Group Volume Distribution</h3><canvas id="muscle-pie-chart"></canvas></div>
  `;

  setTimeout(() => {
    const canvas = document.getElementById('muscle-pie-chart');
    if (!canvas) return;
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(groups).map(g => g.charAt(0).toUpperCase() + g.slice(1)),
        datasets: [{
          data: Object.values(groups).map(g => g.totalVolume),
          backgroundColor: ['#5b9bd5','#7c5ce7','#2ea043','#d2991d','#f85149','#79c0ff','#56d364','#e3b341'],
        }],
      },
      options: { ...chartOptions(), plugins: { legend: { labels: { color: '#e1e1e6' } } } },
    });
  }, 100);
}

// ── Insights ───────────────────────────────────────────────────────────

function renderInsights(container) {
  const insights = window.FD?.workout_insights || {};
  const sessions = insights.sessions || [];
  const weekly = insights.weekly || [];
  const alerts = insights.alerts || [];

  let html = '';

  // ── Progression Alerts ───────────────────────────────
  if (alerts.length) {
    html += '<div class="card-grid" style="margin-bottom:20px;">';
    alerts.forEach(a => {
      const bg = a.type === 'improving' ? '#1b3a1b' : a.type === 'plateau' ? '#3a2f1b' : '#1a1a24';
      html += `<div class="card" style="background:${bg};border-color:${a.type==='improving'?'var(--green)':a.type==='plateau'?'var(--yellow)':'var(--border)'};">
        <div style="font-size:1.4em;">${a.icon || ''}</div>
        <strong>${a.title || ''}</strong>
        <p style="color:var(--muted);font-size:0.85em;margin-top:4px;">${a.detail || ''}</p>
      </div>`;
    });
    html += '</div>';
  }

  // ── This Week ────────────────────────────────────────
  if (weekly.length) {
    const w = weekly[0];
    html += `<div class="card" style="margin-bottom:20px;">
      <h3>📊 ${w.period || 'This Week'}</h3>
      <div class="kpi-grid" style="margin-bottom:0;">
        <div class="kpi"><div class="value" style="font-size:1.4em;">${w.session_count || 0}</div><div class="label">Sessions</div></div>
        <div class="kpi"><div class="value" style="font-size:1.4em;">${fmt(w.total_volume_lbs)}</div><div class="label">Volume (lbs)</div></div>
        <div class="kpi"><div class="value" style="font-size:1.4em;">${fmt(w.total_sets)}</div><div class="label">Sets</div></div>
        <div class="kpi"><div class="value" style="font-size:1.4em;">${w.prs || 0}</div><div class="label">PRs</div></div>
        <div class="kpi ${(w.avg_quality||0)>=70?'trend-up':''}"><div class="value" style="font-size:1.4em;">${(w.avg_quality||0).toFixed(0)}</div><div class="label">Avg Quality</div></div>
        <div class="kpi ${(w.consistency_score||0)>=80?'trend-up':''}"><div class="value" style="font-size:1.4em;">${(w.consistency_score||0).toFixed(0)}%</div><div class="label">Consistency</div></div>
      </div>`;

    // Flags
    const flags = [...(w.overtraining_flags||[]), ...(w.undertraining_flags||[])];
    if (flags.length) {
      html += '<div style="margin-top:12px;">';
      flags.forEach(f => html += `<span style="display:inline-block;background:var(--card);padding:4px 10px;border-radius:12px;margin:2px;font-size:0.8em;color:var(--yellow);">⚠ ${f}</span>`);
      html += '</div>';
    }

    // Priorities
    if (w.priorities && w.priorities.length) {
      html += '<div style="margin-top:12px;"><strong style="color:var(--accent);">Priorities:</strong>';
      w.priorities.forEach(p => html += `<p style="color:var(--muted);font-size:0.85em;margin:2px 0 0 16px;">→ ${p.action}</p>`);
      html += '</div>';
    }
    html += '</div>';
  }

  // ── Per-Session Insights ─────────────────────────────
  if (sessions.length) {
    html += '<h3 style="color:var(--muted);margin-bottom:8px;">Session-by-Session</h3>';
    sessions.forEach(s => {
      const bg = s.grade === 'A' ? '#1b3a1b33' : s.grade === 'B' ? '#1a2a1a33' : '';
      html += `<div class="decision-card conf-${s.grade==='A'?'high':s.grade==='B'?'medium':'low'}" style="background:${bg};cursor:pointer;" onclick="this.querySelector('.detail').classList.toggle('open')">
        <div class="decision-header">
          <span class="session-grade grade-${s.grade}" style="font-size:1.2em;">${s.grade}</span>
          <span style="font-weight:600;">${s.date}</span>
          <span style="color:var(--accent);">${s.focus || ''}</span>
          <span style="color:var(--muted);font-size:0.8em;">${fmt(s.volume_lbs)} lbs · ${s.intensity || ''}</span>
        </div>
        <p style="color:var(--text);font-size:0.9em;margin:4px 0;">${s.summary || ''}</p>`;

      // PRs
      if (s.prs && s.prs.length) {
        html += '<div style="margin-top:4px;">';
        s.prs.forEach(p => html += `<span style="display:inline-block;background:#1b3a1b;color:var(--green);padding:2px 8px;border-radius:8px;margin:2px;font-size:0.75em;">🏆 ${p.exercise} ${p.improvement_pct>0?'+'+p.improvement_pct+'%':''}</span>`);
        html += '</div>';
      }

      // Expandable detail
      html += `<div class="detail session-detail" style="margin-top:8px;">`;
      if (s.factor_breakdown) {
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">';
        for (const [name, f] of Object.entries(s.factor_breakdown)) {
          const pct = f.max ? (f.score/f.max*100) : 0;
          const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--accent)' : pct >= 30 ? 'var(--yellow)' : 'var(--red)';
          html += `<div style="font-size:0.8em;"><span style="color:var(--muted)">${name}:</span> <span style="color:${color}">${f.score.toFixed(0)}/${f.max}</span></div>`;
        }
        html += '</div>';
      }
      html += '</div></div>';
    });
  }

  container.innerHTML = html || '<p style="color:var(--muted);padding:40px;text-align:center;">No insights yet — complete workouts to generate analysis.</p>';
}

// ── Decisions ──────────────────────────────────────────────────────────

function renderDecisions(container) {
  const history = DATA.decision_history || {};
  const recs = history.recommendations || [];

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="value">${history.total || 0}</div><div class="label">Total Recommendations</div></div>
      <div class="kpi"><div class="value">${history.pending || 0}</div><div class="label">Pending</div></div>
      <div class="kpi ${(history.success_rate?.overall||0)>=50?'trend-up':'warn'}"><div class="value">${history.success_rate?.overall||0}%</div><div class="label">Success Rate</div></div>
    </div>
    <div class="filter-bar">
      <select id="decision-filter">
        <option value="all">All Categories</option>
        <option value="progressive_overload">Progressive Overload</option>
        <option value="recovery">Recovery</option>
        <option value="program">Program</option>
        <option value="exercise">Exercise</option>
        <option value="weekly">Weekly</option>
        <option value="long_term">Long Term</option>
      </select>
    </div>
    <div id="decision-list"></div>
  `;

  function renderDecisionsList(filter) {
    const list = $('#decision-list');
    let filtered = recs;
    if (filter && filter !== 'all') {
      filtered = recs.filter(r => r.category === filter);
    }

    list.innerHTML = filtered.slice(-20).reverse().map(r => `
      <div class="decision-card conf-${r.confidence || 'low'}">
        <div class="decision-header">
          <span class="decision-badge badge-${r.confidence || 'low'}">${(r.confidence || 'low').toUpperCase()}</span>
          <span style="color:var(--muted);font-size:0.8em;">${(r.category || '').replace(/_/g, ' ')}</span>
          ${r.status === 'evaluated' ? `<span class="decision-outcome ${r.was_successful ? 'outcome-success' : 'outcome-failed'}">${r.was_successful ? '✓ Success' : '✗ Failed'}</span>` : `<span class="decision-outcome outcome-pending">○ ${r.status}</span>`}
        </div>
        <p style="color:var(--text);margin:4px 0;">${r.decision || ''}</p>
        ${r.rationale ? `<p style="color:var(--muted);font-size:0.8em;">${r.rationale.slice(0, 200)}</p>` : ''}
      </div>
    `).join('') || '<p style="color:var(--muted);">No recommendations match this filter.</p>';
  }

  $('#decision-filter')?.addEventListener('change', e => renderDecisionsList(e.target.value));
  renderDecisionsList('all');
}

// ── Health ─────────────────────────────────────────────────────────────

function renderHealth(container) {
  const health = DATA.system_health || {};

  container.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <h3>Overall Status:
        <span style="color:${health.overall==='healthy'?'var(--green)':health.overall==='warning'?'var(--yellow)':'var(--red)'}">
          ${(health.overall || 'unknown').toUpperCase()}
        </span>
      </h3>
      <p style="color:var(--muted);">${health.exported_at ? 'Data as of ' + health.exported_at : ''}</p>
    </div>
    <div class="health-grid">
      ${(health.healthy_items || []).map(h => `
      <div class="health-item">
        <div class="health-dot green"></div>
        <div><strong>${h.component}</strong><br><span style="color:var(--muted);font-size:0.85em;">${h.detail}</span></div>
      </div>`).join('')}
      ${(health.warnings || []).map(w => `
      <div class="health-item">
        <div class="health-dot yellow"></div>
        <div><strong>${w.component}</strong><br><span style="color:var(--muted);font-size:0.85em;">${w.detail}</span></div>
      </div>`).join('')}
      ${(health.issues || []).map(i => `
      <div class="health-item">
        <div class="health-dot red"></div>
        <div><strong>${i.component}</strong><br><span style="color:var(--muted);font-size:0.85em;">${i.detail}</span></div>
      </div>`).join('')}
    </div>
    ${(!health.healthy_items && !health.warnings) ? '<p style="color:var(--muted);">No health data available. Run export_dashboard_data_v2.py to generate.</p>' : ''}
  `;
}

// ── Chart Helpers (shared) ─────────────────────────────────────────────

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { color: '#6b6b7b', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#6b6b7b', maxTicksLimit: 6, font: { size: 10 } }, grid: { color: '#252530' } },
      y: { ticks: { color: '#6b6b7b', font: { size: 10 } }, grid: { color: '#252530' }, beginAtZero: true },
    },
  };
}

// ── Start ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
