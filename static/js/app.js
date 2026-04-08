/* ── SentimentScope — Frontend App ──────────────────────────────────────────── */
'use strict';

// ── Chart.js global defaults ──────────────────────────────────────────────────
Chart.defaults.color = '#8892aa';
Chart.defaults.borderColor = '#252a38';
Chart.defaults.font.family = "'DM Sans', sans-serif";

const COLORS = {
  positive: '#3ddba8',
  neutral:  '#f0c060',
  negative: '#f06070',
  accent:   '#6c8fff',
  bg3:      '#1a1e2b',
};

// ── State ─────────────────────────────────────────────────────────────────────
let charts = {};
let allReviewsData = [];
let activeFilter = 'all';
let selectedRating = 0;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const businessSelect = $('businessSelect');
const daysSelect     = $('daysSelect');
const loadingOverlay = $('loadingOverlay');
const toast          = $('toast');

// ── Utilities ─────────────────────────────────────────────────────────────────
function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

function showToast(msg, duration = 3000) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function starsHTML(rating) {
  if (!rating) return '';
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function scoreColor(score) {
  if (score >= 0.05)  return COLORS.positive;
  if (score <= -0.05) return COLORS.negative;
  return COLORS.neutral;
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

// ── Review Card ───────────────────────────────────────────────────────────────
function reviewCard(r) {
  const keywords = (r.keywords || []).slice(0, 6).map(k =>
    `<span class="kw-tag">${k}</span>`).join('');
  const stars = r.rating ? `<span class="stars">${starsHTML(r.rating)}</span>` : '';
  return `
    <div class="review-card ${r.sentiment_label}">
      <div class="review-meta">
        <span class="review-author">${r.reviewer_name}</span>
        <span class="review-business">${r.business_name}</span>
        ${stars}
        <span class="sentiment-badge ${r.sentiment_label}">${r.sentiment_label}</span>
        <span class="review-date">${r.created_at}</span>
      </div>
      <div class="review-text">${r.review_text}</div>
      <div class="review-score">Sentiment score: <strong style="color:${scoreColor(r.sentiment_score)}">${r.sentiment_score}</strong></div>
      ${keywords ? `<div class="review-keywords">${keywords}</div>` : ''}
    </div>`;
}

// ── Load Dashboard Data ───────────────────────────────────────────────────────
async function loadDashboard() {
  const business = businessSelect.value;
  const days = daysSelect.value;
  const params = new URLSearchParams({ days });
  if (business) params.set('business', business);

  showLoading();
  try {
    const res = await fetch(`/api/dashboard?${params}`);
    if (!res.ok) {
      if (res.status === 404) {
        showToast('No reviews found for this selection. Try loading demo data!');
        hideLoading(); return;
      }
      throw new Error('API error');
    }
    const d = await res.json();
    renderDashboard(d);
  } catch (e) {
    showToast('Failed to load dashboard data.');
  } finally {
    hideLoading();
  }
}

function renderDashboard(d) {
  // KPIs
  $('kpiTotal').textContent    = d.total_reviews;
  $('kpiPositive').textContent = d.counts.positive || 0;
  $('kpiNeutral').textContent  = d.counts.neutral  || 0;
  $('kpiNegative').textContent = d.counts.negative || 0;
  $('kpiScore').textContent    = d.avg_score.toFixed(2);
  $('kpiScoreLabel').textContent = d.avg_score >= 0.05 ? '▲ Positive' : d.avg_score <= -0.05 ? '▼ Negative' : '→ Neutral';
  $('kpiRating').textContent   = d.avg_rating ? d.avg_rating.toFixed(1) : 'N/A';
  $('kpiStars').textContent    = d.avg_rating ? starsHTML(d.avg_rating) : '';

  renderTrendChart(d.trend);
  renderDonutChart(d.counts);
  renderKeyChart('posKeyChart', d.positive_keywords, COLORS.positive);
  renderKeyChart('negKeyChart', d.negative_keywords, COLORS.negative);
  renderScoreDist(d);

  // Recent reviews
  const container = $('recentReviews');
  container.innerHTML = (d.recent_reviews || []).map(reviewCard).join('') || '<p style="color:var(--text3)">No reviews yet.</p>';
}

function renderTrendChart(trend) {
  destroyChart('trend');
  const labels = trend.map(t => t.date);
  const ctx = $('trendChart').getContext('2d');
  charts.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Positive', data: trend.map(t => t.positive), borderColor: COLORS.positive, backgroundColor: COLORS.positive + '22', tension: .4, fill: true, pointRadius: 3 },
        { label: 'Neutral',  data: trend.map(t => t.neutral),  borderColor: COLORS.neutral,  backgroundColor: COLORS.neutral  + '22', tension: .4, fill: true, pointRadius: 3 },
        { label: 'Negative', data: trend.map(t => t.negative), borderColor: COLORS.negative, backgroundColor: COLORS.negative + '22', tension: .4, fill: true, pointRadius: 3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } } },
      scales: {
        x: { grid: { color: '#252a38' }, ticks: { maxTicksLimit: 10, maxRotation: 0 } },
        y: { grid: { color: '#252a38' }, beginAtZero: true },
      },
    },
  });
}

function renderDonutChart(counts) {
  destroyChart('donut');
  const ctx = $('donutChart').getContext('2d');
  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        data: [counts.positive || 0, counts.neutral || 0, counts.negative || 0],
        backgroundColor: [COLORS.positive, COLORS.neutral, COLORS.negative],
        borderColor: '#13161f', borderWidth: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      cutout: '68%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } } },
    },
  });
}

function renderKeyChart(canvasId, keywords, color) {
  const key = canvasId;
  destroyChart(key);
  if (!keywords || !keywords.length) return;
  const labels = keywords.slice(0, 8).map(k => k[0]);
  const data   = keywords.slice(0, 8).map(k => k[1]);
  const ctx = $(canvasId).getContext('2d');
  charts[key] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: color + 'bb', borderColor: color, borderWidth: 1, borderRadius: 5 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#252a38' }, beginAtZero: true },
        y: { grid: { display: false } },
      },
    },
  });
}

function renderScoreDist(d) {
  destroyChart('scoreDist');
  // Build buckets: -1.0 to +1.0 in 0.2 steps
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    label: (-1 + i * 0.2).toFixed(1),
    count: 0,
  }));
  (d.recent_reviews || []).forEach(r => {
    const idx = Math.min(9, Math.floor((r.sentiment_score + 1) / 0.2));
    buckets[Math.max(0, idx)].count++;
  });
  const ctx = $('scoreDistChart').getContext('2d');
  charts.scoreDist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.label),
      datasets: [{
        label: 'Reviews',
        data: buckets.map(b => b.count),
        backgroundColor: buckets.map(b => {
          const v = parseFloat(b.label);
          return v >= 0.05 ? COLORS.positive + 'bb' : v <= -0.05 ? COLORS.negative + 'bb' : COLORS.neutral + 'bb';
        }),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#252a38' }, beginAtZero: true },
      },
    },
  });
}

// ── Load All Reviews ──────────────────────────────────────────────────────────
async function loadAllReviews() {
  const business = businessSelect.value;
  const params = new URLSearchParams({ limit: 100 });
  if (business) params.set('business', business);
  try {
    const res = await fetch(`/api/reviews?${params}`);
    allReviewsData = await res.json();
    renderAllReviews();
  } catch { showToast('Failed to load reviews.'); }
}

function renderAllReviews() {
  const search = $('reviewSearch').value.toLowerCase();
  let data = allReviewsData;
  if (activeFilter !== 'all') data = data.filter(r => r.sentiment_label === activeFilter);
  if (search) data = data.filter(r => r.review_text.toLowerCase().includes(search) || r.reviewer_name.toLowerCase().includes(search));
  $('allReviews').innerHTML = data.map(reviewCard).join('') || '<p style="color:var(--text3);padding:1rem 0">No reviews match your filter.</p>';
}

// ── Submit Review ─────────────────────────────────────────────────────────────
$('submitReviewBtn').addEventListener('click', async () => {
  const business = $('fBusiness').value.trim();
  const text     = $('fReview').value.trim();
  if (!business || !text) { showToast('Business name and review text are required.'); return; }

  showLoading();
  try {
    const res = await fetch('/api/submit_review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name:  business,
        reviewer_name:  $('fName').value.trim() || 'Anonymous',
        review_text:    text,
        rating:         selectedRating || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      const r = data.review;
      const result = $('submitResult');
      result.className = 'submit-result success';
      result.innerHTML = `
        <strong>✓ Submitted!</strong><br>
        Sentiment: <strong style="color:${scoreColor(r.sentiment_score)}">${r.sentiment_label}</strong>
        (score: ${r.sentiment_score})<br>
        Keywords: ${r.keywords.slice(0, 6).join(', ')}
      `;
      result.classList.remove('hidden');
      $('fBusiness').value = '';
      $('fName').value     = '';
      $('fReview').value   = '';
      resetStars();
      // Refresh business selector
      await refreshBusinessList();
    } else {
      throw new Error(data.error || 'Submission failed');
    }
  } catch (e) {
    const result = $('submitResult');
    result.className = 'submit-result error';
    result.textContent = e.message;
    result.classList.remove('hidden');
  } finally {
    hideLoading();
  }
});

async function refreshBusinessList() {
  try {
    const res = await fetch('/api/businesses');
    const businesses = await res.json();
    const current = businessSelect.value;
    businessSelect.innerHTML = '<option value="">All Businesses</option>' +
      businesses.map(b => `<option value="${b}"${b === current ? ' selected' : ''}>${b}</option>`).join('');
  } catch {}
}

// ── Star Rating ───────────────────────────────────────────────────────────────
function resetStars() {
  selectedRating = 0;
  document.querySelectorAll('.star').forEach(s => s.classList.remove('active', 'hover'));
}

document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('mouseenter', () => {
    const val = parseInt(star.dataset.val);
    document.querySelectorAll('.star').forEach(s => {
      s.classList.toggle('hover', parseInt(s.dataset.val) <= val);
    });
  });
  star.addEventListener('mouseleave', () => {
    document.querySelectorAll('.star').forEach(s => s.classList.remove('hover'));
  });
  star.addEventListener('click', () => {
    selectedRating = parseInt(star.dataset.val);
    $('fRating').value = selectedRating;
    document.querySelectorAll('.star').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.val) <= selectedRating);
    });
  });
});

// ── Tab Navigation ────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'reviews') loadAllReviews();
  });
});

// ── Filters & Search ──────────────────────────────────────────────────────────
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.filter;
    renderAllReviews();
  });
});

$('reviewSearch').addEventListener('input', renderAllReviews);

// ── Controls ──────────────────────────────────────────────────────────────────
$('refreshBtn').addEventListener('click', loadDashboard);
businessSelect.addEventListener('change', loadDashboard);
daysSelect.addEventListener('change', loadDashboard);

$('loadDemoBtn').addEventListener('click', async () => {
  const business = businessSelect.value || 'Demo Cafe';
  showLoading();
  try {
    const res = await fetch('/api/seed_demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_name: business }),
    });
    const data = await res.json();
    showToast(`✓ Loaded ${data.count} demo reviews for "${data.business}"`);
    await refreshBusinessList();
    businessSelect.value = business;
    loadDashboard();
  } catch { showToast('Failed to load demo data.'); }
  finally { hideLoading(); }
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadDashboard();
