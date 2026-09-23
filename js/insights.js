// All insight computation + tiny dependency-free SVG charts (no chart library
// needed). Color ramp is sequential, single-hue-family, light->dark = low->high
// score, built from the brand's saffron/maroon so charts read as one system.
const SCORE_RAMP = ['#F3D9C4', '#EFB27E', '#E8842A', '#464038']; // scores 1..4
// Matches the four smiley colors exactly (Very difficult -> Difficult ->
// Easy -> Pleasure), for the 24 per-asana mini charts specifically, so a
// bar's color reads the same way the rating smileys already do. Deliberately
// NOT blended between adjacent colors: an earlier version did an RGB lerp
// for fractional (Morning+Evening averaged) scores like 2.5, but every blend
// path tried (RGB and hue-based) either looked muddy or - worse, with hue
// interpolation - made a mediocre score momentarily indistinguishable from
// "Pleasure" green. Snapping to the nearest whole score (see
// discreteAsanaColor below) means a bar is always one of these four exact
// colors; the tooltip still shows the precise averaged value.
const ASANA_BAR_RAMP = ['#E5352B', '#F5900E', '#2F8FE0', '#4CAF50'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rampColor(score, palette) {
  palette = palette || SCORE_RAMP;
  const clamped = Math.max(1, Math.min(4, score));
  const idx = clamped - 1;
  const lo = Math.floor(idx), hi = Math.min(3, Math.ceil(idx));
  const t = idx - lo;
  return lerpHex(palette[lo], palette[hi], t);
}
function lerpHex(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// Rounds to the nearest whole rating (1-4) and returns that exact smiley
// color - no in-between blend. See the note above ASANA_BAR_RAMP.
function discreteAsanaColor(value) {
  const idx = Math.max(1, Math.min(4, Math.round(value))) - 1;
  return ASANA_BAR_RAMP[idx];
}

function formatDDMMM(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}-${MONTH_ABBR[parseInt(m, 10) - 1]}`;
}
function formatDDMM(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}-${m}`;
}

function timeBucket(hhmm) {
  if (!hhmm) return 'Unspecified';
  const h = parseInt(hhmm.split(':')[0], 10);
  if (h >= 5 && h < 11) return 'Morning';
  if (h >= 11 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}

// asanaRatings is { morning: {asanaKey: value}, evening: {...} } going
// forward, but older saved entries have a flat { asanaKey: value } shape
// from before Morning/Evening sessions existed. This flattens either shape
// into one list of [key, value] entries (both sessions' ratings count
// equally, per asana).
function flattenAsanaEntries(ratings) {
  if (!ratings) return [];
  if (ratings.morning || ratings.evening) {
    return [...Object.entries(ratings.morning || {}), ...Object.entries(ratings.evening || {})];
  }
  return Object.entries(ratings);
}

// Equal weight per asana (and per session): plain mean of every rating from
// whichever session(s) were logged that day.
function entryAvgScore(entry) {
  const scores = flattenAsanaEntries(entry.asanaRatings).map(([, v]) => v).filter(Boolean);
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function topAsanasForEntry(entry, n) {
  n = n || 3;
  return flattenAsanaEntries(entry.asanaRatings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, val]) => ({ name: (ASANAS.find(a => a.key === key) || {}).name || key, value: val }));
}

function bottomAsanasForEntry(entry, n) {
  n = n || 3;
  return flattenAsanaEntries(entry.asanaRatings)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([key, val]) => ({ name: (ASANAS.find(a => a.key === key) || {}).name || key, value: val }));
}

// Day score for the 30-day trend chart specifically: the Morning session's
// own average and the Evening session's own average, then averaged together
// (or whichever session exists, if only one was logged) - the same
// "average per session, not per rating" convention as asanaValueForDay,
// just applied at the whole-day level instead of per-asana. This is
// deliberately a separate function from entryAvgScore (used by the stat
// tiles/streak/key message), which instead flattens every rating from both
// sessions into one list before averaging - equal weight per asana rating
// regardless of session. Both conventions are reasonable; kept apart so
// changing the trend chart doesn't quietly shift those other numbers.
function dayScoreForTrend(entry) {
  if (!entry || !entry.asanaRatings) return null;
  const r = entry.asanaRatings;
  const meanOf = (map) => {
    const vals = Object.values(map || {}).filter(v => v !== undefined && v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  if (r.morning || r.evening) {
    const m = meanOf(r.morning), e = meanOf(r.evening);
    if (m !== null && e !== null) return (m + e) / 2;
    return m !== null ? m : e;
  }
  return meanOf(r);
}

// One representative value per asana per day for the mini 7-day charts -
// the average of Morning/Evening when both were logged that day.
function asanaValueForDay(entry, asanaKey) {
  if (!entry || !entry.asanaRatings) return undefined;
  const r = entry.asanaRatings;
  if (r.morning || r.evening) {
    const m = r.morning ? r.morning[asanaKey] : undefined;
    const e = r.evening ? r.evening[asanaKey] : undefined;
    if (m !== undefined && e !== undefined) return (m + e) / 2;
    return m !== undefined ? m : e;
  }
  return r[asanaKey];
}

// Same per-day lookup, but scoped to a single session's own rating for the
// Morning/Evening mini-chart tabs - always a whole 1-4 number (no averaging),
// so those tabs never need a blended bar color. Entries saved before the
// Morning/Evening split (flat asanaRatings shape) count as Morning, matching
// flattenAsanaEntries()'s convention elsewhere.
function asanaValueForDayMode(entry, asanaKey, mode) {
  if (!entry || !entry.asanaRatings) return undefined;
  const r = entry.asanaRatings;
  if (mode === 'morning') {
    if (r.morning) return r.morning[asanaKey];
    if (!r.evening) return r[asanaKey];
    return undefined;
  }
  if (mode === 'evening') {
    return r.evening ? r.evening[asanaKey] : undefined;
  }
  return asanaValueForDay(entry, asanaKey);
}

function sortedDates(entriesMap) {
  return Object.keys(entriesMap).sort();
}

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function computeStats(entriesMap) {
  const dates = sortedDates(entriesMap);
  const todayStr = new Date().toISOString().slice(0, 10);
  const last30 = dates.filter(d => d >= addDays(todayStr, -29));
  const last7 = dates.filter(d => d >= addDays(todayStr, -6));

  const avgOf = (list) => {
    const scores = list.map(d => entryAvgScore(entriesMap[d])).filter(v => v !== null);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  };

  let streak = 0;
  let cursor = todayStr;
  while (entriesMap[cursor]) { streak++; cursor = addDays(cursor, -1); }

  return {
    totalDaysLogged: dates.length,
    todayScore: entriesMap[todayStr] ? entryAvgScore(entriesMap[todayStr]) : null,
    avg7: avgOf(last7),
    avg30: avgOf(last30),
    streak,
    last30Dates: last30,
  };
}

// Six always-on factors (rendered as a fixed 3x2 grid), plus a 7th shown only
// for accounts with at least one "female" entry. A factor's getCategory can
// return null to opt an entry out of that particular breakdown.
const FACTORS = {
  moon: { label: 'Moon phase', getCategory: (e) => getMoonPhase(e.date).label },
  meal: { label: 'Meal / snack status', getCategory: (e) => (MEAL_STATUS_OPTIONS.find(o => o.value === e.mealStatus) || {}).label || 'Unspecified' },
  fasting: { label: 'Recent fasting', getCategory: (e) => (FASTING_OPTIONS.find(o => o.value === e.fasting) || {}).label || 'Unspecified' },
  // Bucketed by count rather than which combination, since 6 items would
  // otherwise produce up to 64 sparse (mostly n=1) categories.
  kriya: { label: 'Kriyas & Sadhanas done', getCategory: (e) => {
    const done = KRIYA_SADHANA_ITEMS.filter(k => e.kriyaSadhana && e.kriyaSadhana[k.key] === true).length;
    return `${done} of ${KRIYA_SADHANA_ITEMS.length} done`;
  } },
  balancing: { label: 'Balancing Sadhana', getCategory: (e) => (e.kriyaSadhana && e.kriyaSadhana['suka-kriya-aum'] === true) ? 'Completed' : 'Not completed' },
  time: { label: 'Time of day practiced', getCategory: (e) => timeBucket(e.practiceTime) },
  menstrual: { label: 'Menstrual cycle', getCategory: (e) => {
    if (e.sex !== 'female' || e.menstrualCycle === null || e.menstrualCycle === undefined) return null;
    return e.menstrualCycle === true ? 'During cycle' : 'Not during cycle';
  } },
};
const BASE_FACTOR_KEYS = ['moon', 'meal', 'fasting', 'kriya', 'balancing', 'time'];

function factorBreakdown(entriesMap, factorKey) {
  const factor = FACTORS[factorKey];
  const buckets = {};
  Object.values(entriesMap).forEach(entry => {
    const score = entryAvgScore(entry);
    if (score === null) return;
    const cat = factor.getCategory(entry);
    if (cat === null || cat === undefined) return;
    if (!buckets[cat]) buckets[cat] = [];
    buckets[cat].push(score);
  });
  return Object.entries(buckets)
    .map(([label, scores]) => ({ label, avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length }))
    .sort((a, b) => b.avg - a.avg);
}

// ---------- The weekly Key Message (the headline insight) ----------
// Part 1 looks for the best time-of-day x moon-phase combination in the last
// 7 days (falling back to the single strongest factor if combos are too
// thin), and folds in a general note from a day that matches. Part 2 names
// the asanas scoring lowest that week, as a concrete next action.
// Monday of the calendar week containing dateStr (ISO week start, not the
// rolling "last 7 days" the rest of the app uses elsewhere).
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
function weekRange(mondayStr) {
  return { start: mondayStr, end: addDays(mondayStr, 6) };
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Same finding/improvement algorithm regardless of which week is passed in -
// range = {start, end} (inclusive), weekLabel is how it reads in a sentence
// ("this week" / "last week"). Also returns weakestKeys so a caller can
// cross-reference against another week's weak asanas (see
// generateCurrentWeekMessage below).
function generateKeyMessage(entriesMap, range, weekLabel) {
  weekLabel = weekLabel || 'this week';
  const weekDates = sortedDates(entriesMap).filter(d => d >= range.start && d <= range.end);
  const entries = weekDates.map(d => entriesMap[d]).filter(Boolean);

  if (entries.length < 3) {
    return {
      finding: `Log a few more days ${weekLabel} to unlock a personalized weekly finding.`,
      improvement: '',
      weakestKeys: [],
    };
  }

  const comboBuckets = {};
  entries.forEach(e => {
    const score = entryAvgScore(e);
    if (score === null) return;
    const key = `${timeBucket(e.practiceTime)}||${getMoonPhase(e.date).label}`;
    (comboBuckets[key] = comboBuckets[key] || []).push({ score, entry: e });
  });
  const comboRows = Object.entries(comboBuckets)
    .map(([key, items]) => {
      const [time, moon] = key.split('||');
      return { time, moon, avg: items.reduce((a, b) => a + b.score, 0) / items.length, count: items.length, items };
    })
    .sort((a, b) => b.avg - a.avg);

  let finding;
  const weekMap = {}; weekDates.forEach(d => weekMap[d] = entriesMap[d]);

  if (comboRows.length >= 2 && (comboRows[0].avg - comboRows[comboRows.length - 1].avg) >= 0.3) {
    const best = comboRows[0];
    finding = `${capitalize(weekLabel)}, practice reads easiest doing asanas in the ${best.time.toLowerCase()} during ${best.moon} (avg ${best.avg.toFixed(1)}/4).`;
    const noted = best.items.map(i => i.entry).find(e => e.generalNotes && e.generalNotes.trim());
    if (noted) finding += ` You noted: "${noted.generalNotes.trim()}" on one of those days.`;
  } else {
    let bestFactor = null;
    BASE_FACTOR_KEYS.forEach(key => {
      const rows = factorBreakdown(weekMap, key).filter(r => r.count >= 1);
      if (rows.length < 2) return;
      const gap = rows[0].avg - rows[rows.length - 1].avg;
      if (!bestFactor || gap > bestFactor.gap) bestFactor = { key, gap, best: rows[0], worst: rows[rows.length - 1] };
    });
    if (bestFactor && bestFactor.gap >= 0.3) {
      finding = `${capitalize(weekLabel)}, ${FACTORS[bestFactor.key].label.toLowerCase()} seems to matter most: "${bestFactor.best.label}" reads easiest (avg ${bestFactor.best.avg.toFixed(1)}/4) versus "${bestFactor.worst.label}" (avg ${bestFactor.worst.avg.toFixed(1)}/4).`;
    } else {
      finding = `${capitalize(weekLabel)}'s scores are fairly even across moon phase, meals, kriyas and timing - no strong single factor stands out yet.`;
    }
  }

  const asanaBuckets = {};
  entries.forEach(e => {
    flattenAsanaEntries(e.asanaRatings).forEach(([key, val]) => (asanaBuckets[key] = asanaBuckets[key] || []).push(val));
  });
  const asanaAverages = Object.entries(asanaBuckets)
    .map(([key, vals]) => ({ key, avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length }))
    .filter(a => a.count >= 2)
    .sort((a, b) => a.avg - b.avg);

  let improvement = '';
  let weakestKeys = [];
  if (asanaAverages.length) {
    const weakest = asanaAverages.slice(0, Math.min(3, asanaAverages.length));
    weakestKeys = weakest.map(a => a.key);
    const names = weakest.map(a => (ASANAS.find(x => x.key === a.key) || {}).name || a.key);
    improvement = `Give extra attention to ${names.join(', ')} - lowest-scoring ${weekLabel} (avg ${weakest[0].avg.toFixed(1)}/4).`;
  }

  return { finding, improvement, weakestKeys };
}

// The current week's box is progressive (whatever's been logged Monday
// through today) and layers on one extra sentence cross-referencing last
// week's weakest asanas - "the same logic used now" (generateKeyMessage,
// unmodified) still drives both weeks' own finding/improvement.
function generateCurrentWeekMessage(entriesMap, currentRange, lastRange) {
  const current = generateKeyMessage(entriesMap, currentRange, 'this week');
  const last = generateKeyMessage(entriesMap, lastRange, 'last week');

  let advice = '';
  if (last.weakestKeys.length) {
    const lastNames = last.weakestKeys.map(k => (ASANAS.find(a => a.key === k) || {}).name || k);
    const overlap = last.weakestKeys.filter(k => current.weakestKeys.includes(k));
    if (overlap.length) {
      const overlapNames = overlap.map(k => (ASANAS.find(a => a.key === k) || {}).name || k);
      advice = `Building on last week: ${overlapNames.join(', ')} ${overlap.length > 1 ? 'were' : 'was'} weak last week too - keep watching ${overlap.length > 1 ? 'them' : 'it'} this week.`;
    } else {
      advice = `Last week's focus areas were ${lastNames.join(', ')} - worth checking in on how they're trending this week.`;
    }
  }

  return { finding: current.finding, improvement: current.improvement, advice };
}

// ---------- SVG chart rendering ----------
function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function ensureTooltip() {
  let tip = document.getElementById('chart-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'chart-tooltip';
    tip.className = 'tooltip';
    document.body.appendChild(tip);
  }
  return tip;
}
function showTip(evt, html) {
  const tip = ensureTooltip();
  tip.innerHTML = html;
  tip.style.left = (evt.pageX + 12) + 'px';
  tip.style.top = (evt.pageY - 10) + 'px';
  tip.classList.add('show');
}
function hideTip() { ensureTooltip().classList.remove('show'); }

// Anchored a little below a given element (its pose icon) rather than
// following the cursor - used for the 24 asana tiles' rating tooltip, so it
// sits in the same spot regardless of which of the 4 smileys is hovered.
function showTipBelowElement(el, html) {
  const tip = ensureTooltip();
  tip.innerHTML = html;
  const rect = el.getBoundingClientRect();
  tip.style.left = (window.scrollX + rect.left) + 'px';
  tip.style.top = (window.scrollY + rect.bottom + 6) + 'px';
  tip.classList.add('show');
}

// Catmull-Rom -> cubic Bezier smoothing, so the trend line reads as a
// gentle curve rather than sharp point-to-point segments.
function smoothPathD(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Hand-drawn (not sourced) up/down/flat glyphs for the trend-direction
// indicator, in the one fixed color the arrow always uses regardless of
// direction. A single bold, solid block-arrow polygon (notched tail,
// triangular head) drawn once pointing right, then rotated for up/down -
// same shape, just spun +/-90 degrees around the icon's center.
const TREND_ARROW_COLOR = '#1E257C';
const TREND_ARROW_PATH = 'M0,37 L58,37 L58,25 L100,50 L58,75 L58,63 L0,63 L12,50 Z';
const TREND_ARROW_ICONS = {
  flat: `<svg viewBox="0 0 100 100" width="28" height="28"><path d="${TREND_ARROW_PATH}" fill="${TREND_ARROW_COLOR}"/></svg>`,
  up: `<svg viewBox="0 0 100 100" width="28" height="28"><path d="${TREND_ARROW_PATH}" fill="${TREND_ARROW_COLOR}" transform="rotate(-90 50 50)"/></svg>`,
  down: `<svg viewBox="0 0 100 100" width="28" height="28"><path d="${TREND_ARROW_PATH}" fill="${TREND_ARROW_COLOR}" transform="rotate(90 50 50)"/></svg>`,
};

// A day-to-day trend needs some dead band around zero, or a near-flat 30
// days flickers between "up" and "down" over trivial noise; anything within
// +/-0.1 (on the 1-4 scale) reads as "stay put" instead.
const TREND_FLAT_THRESHOLD = 0.1;

function computeTrendSummary(points) {
  const withData = points.filter(p => p.hasData);
  if (withData.length < 2) return null;
  const start = withData[0];
  const end = withData[withData.length - 1];
  const avg = withData.reduce((a, p) => a + p.score, 0) / withData.length;
  const trend = end.score - start.score;
  const direction = trend > TREND_FLAT_THRESHOLD ? 'up' : trend < -TREND_FLAT_THRESHOLD ? 'down' : 'flat';
  return { start, end, avg, trend, direction };
}

function renderTrendArrow(arrowContainer, points) {
  if (!arrowContainer) return;
  const summary = computeTrendSummary(points);
  if (!summary) { arrowContainer.innerHTML = ''; return; }
  arrowContainer.innerHTML = TREND_ARROW_ICONS[summary.direction];
  arrowContainer.style.cursor = 'pointer';
  arrowContainer.onmousemove = (e) => {
    const trendSign = summary.trend > 0 ? '+' : '';
    showTip(e, `<strong>30-day trend: ${summary.direction === 'up' ? 'Going up' : summary.direction === 'down' ? 'Going down' : 'Holding steady'}</strong>`
      + `<br>Start (${formatDDMMM(summary.start.date)}): ${summary.start.score.toFixed(2)} / 4`
      + `<br>End (${formatDDMMM(summary.end.date)}): ${summary.end.score.toFixed(2)} / 4`
      + `<br>Average: ${summary.avg.toFixed(2)} / 4`
      + `<br>Trend: ${trendSign}${summary.trend.toFixed(2)}`);
  };
  arrowContainer.onmouseleave = hideTip;
}

// 0 = the rolling last-30-days window (same as before); N>0 = a fixed
// calendar month N months before this one (1 = last month, 2 = two months
// back, etc.) - not a rolling window, so an early, partial month (e.g. the
// very first month the user ever logged) still renders whatever days exist
// in it rather than needing a full 30/31 days to show anything.
let trendMonthsBack = 0;

function monthsBetween(fromDateStr, toDateStr) {
  const a = new Date(fromDateStr + 'T00:00:00Z');
  const b = new Date(toDateStr + 'T00:00:00Z');
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

function monthRangeBack(monthsBack, todayStr) {
  const d = new Date(todayStr + 'T00:00:00Z');
  const firstOfTargetMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1));
  const firstOfNextMonth = new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 1));
  const lastOfTargetMonth = new Date(firstOfNextMonth.getTime() - 24 * 60 * 60 * 1000);
  const start = firstOfTargetMonth.toISOString().slice(0, 10);
  const end = lastOfTargetMonth.toISOString().slice(0, 10);
  const dates = [];
  for (let dt = start; dt <= end; dt = addDays(dt, 1)) dates.push(dt);
  return dates;
}

function monthNameFor(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

// Wires the "< Previous Month" / "Current 30 Days" toggle and (re)renders
// the chart (plus the "| <Month>" title suffix) for whichever is currently
// selected - self-contained the same way the mini-asana-chart tabs
// re-invoke themselves on click. Each "<" click steps one more calendar
// month further back; it stops at the month of the very first entry ever
// logged rather than paging into months with nothing in them at all.
function renderTrendSection(navContainer, monthLabelEl, chartContainer, legendContainer, arrowContainer, entriesMap, stats, allDates) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxMonthsBack = allDates.length ? monthsBetween(allDates[0], todayStr) : 0;
  const canGoBack = trendMonthsBack < maxMonthsBack;

  navContainer.innerHTML = `
    <button type="button" class="trend-nav-arrow" id="trend-prev-btn" aria-label="Previous month" ${canGoBack ? '' : 'disabled'}>&lsaquo;</button>
    <button type="button" class="trend-nav-current ${trendMonthsBack === 0 ? 'active' : ''}" id="trend-current-btn">Current 30 Days</button>
  `;
  navContainer.querySelector('#trend-prev-btn').addEventListener('click', () => {
    if (trendMonthsBack >= maxMonthsBack) return;
    trendMonthsBack += 1;
    renderTrendSection(navContainer, monthLabelEl, chartContainer, legendContainer, arrowContainer, entriesMap, stats, allDates);
  });
  navContainer.querySelector('#trend-current-btn').addEventListener('click', () => {
    trendMonthsBack = 0;
    renderTrendSection(navContainer, monthLabelEl, chartContainer, legendContainer, arrowContainer, entriesMap, stats, allDates);
  });

  let trendDates = [];
  let monthLabel;
  if (trendMonthsBack === 0) {
    const trendStart = stats.last30Dates.length ? stats.last30Dates[0] : allDates[0];
    if (trendStart) {
      for (let d = trendStart; d <= todayStr; d = addDays(d, 1)) trendDates.push(d);
    }
    monthLabel = monthNameFor(todayStr);
  } else {
    trendDates = monthRangeBack(trendMonthsBack, todayStr);
    monthLabel = monthNameFor(trendDates[0]);
  }
  if (monthLabelEl) monthLabelEl.textContent = `| ${monthLabel}`;
  renderTrendChart(chartContainer, entriesMap, trendDates, legendContainer, arrowContainer);
}

function renderTrendChart(container, entriesMap, dateList, legendContainer, arrowContainer) {
  container.innerHTML = '';
  const todayStr = new Date().toISOString().slice(0, 10);
  // Every day in range gets a point - a day with no logged data still shows
  // up (as a grey, zero-value marker below), except today, which is simply
  // left off rather than flagged as "no data" (it may not be over yet).
  const points = dateList
    .map(d => {
      const score = dayScoreForTrend(entriesMap[d]);
      return { date: d, score, hasData: score !== null };
    })
    .filter(p => p.hasData || p.date !== todayStr);
  renderTrendArrow(arrowContainer, points);
  if (points.length < 2) {
    container.innerHTML = '<div class="empty-state">Log at least two days to see the trend line.</div>';
    if (legendContainer) legendContainer.innerHTML = '';
    return;
  }
  // Extra bottom padding for the 45-degree-tilted date labels.
  const w = container.clientWidth || 600, h = 260, padL = 32, padR = 12, padT = 16, padB = 46;
  const svg = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
  const xStep = (w - padL - padR) / (points.length - 1 || 1);
  // Domain is 0-4 (not 1-4) so a no-data day's 0 value has room to sit below
  // the lowest real score, right on the x-axis.
  const yFor = (score) => padT + (4 - score) / 4 * (h - padT - padB);
  const xFor = (i) => padL + i * xStep;
  const baselineY = h - padB;

  [0, 1, 2, 3, 4].forEach(v => {
    svg.appendChild(svgEl('line', { x1: padL, x2: w - padR, y1: yFor(v), y2: yFor(v), stroke: '#e6dcd0', 'stroke-width': 1 }));
    const t = svgEl('text', { x: 4, y: yFor(v) + 4, 'font-size': 10, fill: '#464038' });
    t.textContent = v; svg.appendChild(t);
  });

  // More frequent x-axis ticks than before (roughly every 2-3 days on a
  // 30-day chart, capped so labels never overlap even on a longer range),
  // always including the first and last day.
  const tickStep = Math.max(1, Math.round(points.length / 14));
  const tickIdxs = new Set([0, points.length - 1]);
  for (let i = tickStep; i < points.length - 1; i += tickStep) tickIdxs.add(i);
  const sortedTicks = Array.from(tickIdxs).sort((a, b) => a - b);

  // A separate path per run of consecutive real-data points - a no-data day
  // breaks the line (a visible gap) instead of pulling it down to 0.
  let segStart = null;
  for (let i = 0; i <= points.length; i++) {
    const isData = i < points.length && points[i].hasData;
    if (isData) {
      if (segStart === null) segStart = i;
    } else {
      if (segStart !== null && i - segStart >= 2) {
        const seg = points.slice(segStart, i).map((p, idx) => ({ x: xFor(segStart + idx), y: yFor(p.score) }));
        svg.appendChild(svgEl('path', { d: smoothPathD(seg), fill: 'none', stroke: '#E8842A', 'stroke-width': 2 }));
      }
      segStart = null;
    }
  }

  // Plain days and no-data markers keep this radius; New Moon/Full
  // Moon/Ekadashi are drawn at double this (see SPECIAL_MARKER_R below) so
  // they stand out from an ordinary day at a glance.
  const MARKER_R = 3.5;
  const SPECIAL_MARKER_R = MARKER_R * 2;
  // Cap the hit radius at half the gap between points so hit areas on a
  // dense (e.g. 45-day) chart touch rather than overlap and steal a
  // neighboring day's hover; floor it at the largest marker's own radius so
  // the hit area is never smaller than the (bigger) special-day markers.
  const hitRadius = Math.max(SPECIAL_MARKER_R, Math.min(12, xStep / 2));

  points.forEach((p, i) => {
    const event = getLunarEvent(p.date);
    const entry = entriesMap[p.date];
    const fastValue = entry ? entry.ekadashiFast : undefined;
    const fastLabel = fastValue != null ? ((EKADASHI_FAST_OPTIONS.find(o => o.value === fastValue) || {}).label || '-') : '-';
    // A voluntary fast (Half/Half Fast chosen on a day that ISN'T Ekadashi)
    // gets its own ring marker; on Ekadashi the fast answer is already
    // called out next to the "Ekadashi" tag itself, so it isn't duplicated
    // here.
    const isVoluntaryFast = !event.isEkadashi && (fastValue === 'half' || fastValue === 'full');
    const cx = xFor(i), cy = yFor(p.hasData ? p.score : 0);
    let marker, usedR;
    if (!p.hasData) {
      // No-data (past days only, see the filter above) always reads as a
      // plain grey marker, regardless of what lunar event that date is -
      // there's no score to color-code, so lunar styling doesn't apply.
      usedR = MARKER_R;
      marker = svgEl('circle', { cx, cy, r: usedR, fill: '#5c5c5c' });
    } else if (event.isFullMoon) {
      // A pure white fill with no border, as specified, is literally
      // invisible against this chart's white/cream background - a plain
      // white circle on white leaves an unmarked gap in the line with no
      // visual cue at all. Added a hairline neutral border (not a color,
      // just enough to trace the circle's edge) purely so the marker is
      // findable; the fill itself stays exactly white.
      usedR = SPECIAL_MARKER_R;
      marker = svgEl('circle', { cx, cy, r: usedR, fill: '#ffffff', stroke: '#d8d2c5', 'stroke-width': 1 });
    } else if (event.isNewMoon) {
      // Fill and ring would otherwise be the same color now that the palette
      // has one ink tone - a white ring keeps this visually distinct from a
      // plain point (by size) and from the Full Moon marker (by fill).
      usedR = SPECIAL_MARKER_R;
      marker = svgEl('circle', { cx, cy, r: usedR, fill: '#464038', stroke: '#fff', 'stroke-width': 2 });
    } else if (event.isEkadashi) {
      usedR = SPECIAL_MARKER_R;
      marker = svgEl('circle', { cx, cy, r: usedR, fill: '#00FDFF' });
    } else {
      usedR = MARKER_R;
      marker = svgEl('circle', { cx, cy, r: usedR, fill: '#AF4D30' });
    }
    svg.appendChild(marker);

    if (isVoluntaryFast) {
      // A thin black ring drawn outside the marker itself - doesn't replace
      // or recolor the marker, just flags "a fast was recorded this day" as
      // an independent fact layered on top.
      svg.appendChild(svgEl('circle', { cx, cy, r: usedR + 3, fill: 'none', stroke: '#1a1a1a', 'stroke-width': 1.2 }));
    }

    // The visible marker is small - too small to reliably land a real mouse
    // cursor on, especially with 30-45 points sharing one chart width. A
    // larger invisible hit target around each point makes hover actually
    // usable; the small dot stays purely decorative.
    const hitArea = svgEl('circle', { cx, cy, r: hitRadius, fill: 'transparent' });
    hitArea.style.cursor = 'pointer';
    hitArea.addEventListener('mousemove', (e) => {
      const tags = [
        event.isFullMoon && 'Full Moon',
        event.isNewMoon && 'New Moon',
        event.isEkadashi && `Ekadashi (${fastLabel})`,
      ].filter(Boolean).join(' · ');
      const dateLabel = formatDDMMM(p.date) + (isVoluntaryFast ? ` (${fastLabel})` : '');
      if (!p.hasData) {
        showTip(e, `<strong>${dateLabel}</strong>${tags ? ' · ' + tags : ''}<br>No data`);
        return;
      }
      const top3 = topAsanasForEntry(entry, 3);
      const bottom3 = bottomAsanasForEntry(entry, 3);
      showTip(e, `<strong>${dateLabel}</strong>${tags ? ' · ' + tags : ''}<br>Score: ${p.score.toFixed(2)} / 4`
        + `<br>Top asanas: ${top3.map(a => `${a.name} (${a.value})`).join(', ') || '-'}`
        + `<br>Low asanas: ${bottom3.map(a => `${a.name} (${a.value})`).join(', ') || '-'}`);
    });
    hitArea.addEventListener('mouseleave', hideTip);
    svg.appendChild(hitArea);
  });

  // Date labels tilted 45 degrees so more of them fit without overlapping.
  sortedTicks.forEach(i => {
    const t = svgEl('text', {
      x: xFor(i), y: baselineY + 14, 'font-size': 10, fill: '#464038',
      'text-anchor': 'end', transform: `rotate(-45 ${xFor(i)} ${baselineY + 14})`,
    });
    t.textContent = formatDDMMM(points[i].date);
    svg.appendChild(t);
  });

  container.appendChild(svg);

  if (legendContainer) {
    legendContainer.innerHTML = `
      <span><span class="legend-dot" style="background:#464038;border-color:#464038"></span>New Moon</span>
      <span><span class="legend-dot" style="background:#ffffff;border-color:#c9c2b4"></span>Full Moon</span>
      <span><span class="legend-dot" style="background:#00FDFF;border-color:#00FDFF"></span>Ekadashi</span>
      <span><span class="legend-dot" style="background:transparent;border-color:#1a1a1a"></span>Normal day Fasting</span>
    `;
  }
}

// ---------- "What's shaping your practice": 6 fixed topics, 3x2 grid ----------
// A fixed topic list (not derived from FACTORS/BASE_FACTOR_KEYS - those stay
// as-is, still used by the Key Message and "More findings" cards elsewhere).
// Only Moon Phase is fully built out for now; the rest are placeholders to
// fill in next, per topic, once each one's exact breakdown is decided.
const SHAPING_TOPICS = [
  {
    key: 'moon', title: 'Moon Phase',
    caption: 'Based on the last 30 days.',
    footer: 'Overall Score of Asanas during the recent phases of the Moon. Hover over the bar to find the Top and bottom performed Asanas.',
  },
  { key: 'sun', title: 'Trikala Sandhya' },
  { key: 'fasting', title: 'Fasting' },
  { key: 'showering', title: 'Showering' },
  { key: 'kriyas', title: 'Kriyas and Sadhanas' },
  { key: 'menstrual', title: 'Menstrual Cycle', caption: 'Based on the last two cycles...' },
];
const MOON_BAR_COLOR = '#F37021';
const SHAPING_WINDOW_DAYS = 30;

function lastNDaysEntries(entriesMap, n) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const cutoff = addDays(todayStr, -(n - 1));
  return Object.values(entriesMap).filter(e => e.date >= cutoff && e.date <= todayStr);
}

// One bucket per MOON_PHASES entry (fixed chronological order, not sorted by
// score), each with its own avg score plus the top/bottom 3 asanas rated
// during days in that phase - all scoped to the last 30 days only.
function computeMoonPhaseRows(entries) {
  const buckets = {};
  MOON_PHASES.forEach(p => { buckets[p.key] = { scores: [], asanaTotals: {} }; });
  entries.forEach(entry => {
    const score = entryAvgScore(entry);
    if (score === null) return;
    const b = buckets[getMoonPhase(entry.date).key];
    b.scores.push(score);
    flattenAsanaEntries(entry.asanaRatings).forEach(([key, val]) => {
      const t = b.asanaTotals[key] || (b.asanaTotals[key] = { sum: 0, count: 0 });
      t.sum += val; t.count += 1;
    });
  });
  return MOON_PHASES.map(p => {
    const b = buckets[p.key];
    const avg = b.scores.length ? b.scores.reduce((a, c) => a + c, 0) / b.scores.length : null;
    const asanaAverages = Object.entries(b.asanaTotals).map(([key, t]) => ({
      name: (ASANAS.find(a => a.key === key) || {}).name || key,
      avg: t.sum / t.count,
    })).sort((a, b2) => b2.avg - a.avg);
    return {
      key: p.key, label: p.label, avg, count: b.scores.length,
      top3: asanaAverages.slice(0, 3),
      bottom3: asanaAverages.slice(-3).reverse(),
    };
  });
}

// Rounded-right-corner bar (square left edge flush against the axis line),
// mirroring roundedTopPath's approach but for a horizontal bar.
function roundedRightPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width, height / 2));
  return `M${x},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} `
    + `L${x + width},${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} `
    + `L${x},${y + height} Z`;
}

function renderMoonPhaseChart(container, entries) {
  const rows = computeMoonPhaseRows(entries);
  const withData = rows.filter(r => r.avg !== null);
  if (!withData.length) {
    container.innerHTML = '<div class="empty-state">Not enough data in the last 30 days yet.</div>';
    return;
  }

  // Domain is zoomed to the data's own range (not the full 1-4 scale), so
  // small real differences between phases stay visually readable - padded
  // 0.1 below the lowest value, rounded up to the ceiling 0.1 above.
  const vals = withData.map(r => r.avg);
  let domainMin = Math.round((Math.floor(Math.min(...vals) * 10) / 10 - 0.1) * 100) / 100;
  let domainMax = Math.round((Math.ceil(Math.max(...vals) * 10) / 10) * 100) / 100;
  domainMin = Math.max(1, domainMin);
  if (domainMax - domainMin < 0.4) domainMax = domainMin + 0.4;
  domainMax = Math.min(4, domainMax);
  if (domainMax - domainMin < 0.1) domainMin = Math.max(1, domainMax - 0.4);

  const w = container.clientWidth || 440;
  const rowH = 34, padT = 10, padB = 26;
  const iconColW = 28, labelW = 138, leftPad = 10, rightPad = 14;
  const chartLeft = leftPad + iconColW + labelW;
  const chartRight = w - rightPad;
  const barMax = Math.max(20, chartRight - chartLeft);
  const h = padT + rows.length * rowH + padB;
  const xFor = (v) => Math.round((chartLeft + (v - domainMin) / (domainMax - domainMin) * barMax) * 100) / 100;

  let gridSvg = '';
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const t = domainMin + (domainMax - domainMin) * i / tickCount;
    const x = xFor(t);
    gridSvg += `<line x1="${x}" x2="${x}" y1="${padT}" y2="${h - padB}" stroke="#e6dcd0" stroke-width="1"/>`;
    gridSvg += `<text x="${x}" y="${h - padB + 16}" font-size="10" fill="#464038" text-anchor="middle">${Math.round(t * 100) / 100}</text>`;
  }
  gridSvg += `<line x1="${chartLeft}" x2="${chartLeft}" y1="${padT}" y2="${h - padB}" stroke="#1a1a1a" stroke-width="1.6"/>`;

  let rowsSvg = '';
  rows.forEach((row, i) => {
    const y = padT + i * rowH;
    const cy = y + rowH / 2;
    const iconSize = 24;
    rowsSvg += moonIconSVG(row.key, iconSize).replace('<svg ', `<svg x="${leftPad}" y="${cy - iconSize / 2}" `);
    rowsSvg += `<text x="${leftPad + iconColW}" y="${cy + 4}" font-size="11.5" fill="#464038">${row.label}</text>`;

    if (row.avg === null) {
      rowsSvg += `<text x="${chartLeft + 6}" y="${cy + 4}" font-size="11" fill="#a8a196">No data</text>`;
      return;
    }

    const barH = 18, barY = cy - barH / 2;
    const barW = Math.max(3, xFor(row.avg) - chartLeft);
    const path = roundedRightPath(chartLeft, barY, barW, barH, barH / 2);
    const display = Number.isInteger(row.avg) ? String(row.avg) : row.avg.toFixed(1);
    rowsSvg += `<path class="moon-bar" data-idx="${i}" d="${path}" fill="${MOON_BAR_COLOR}" style="cursor:pointer"/>`;
    rowsSvg += barW > 26
      ? `<text x="${chartLeft + barW - 8}" y="${cy + 4}" font-size="12" fill="#fff" text-anchor="end" style="pointer-events:none">${display}</text>`
      : `<text x="${chartLeft + barW + 6}" y="${cy + 4}" font-size="11" fill="#464038" style="pointer-events:none">${display}</text>`;
  });

  container.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${gridSvg}${rowsSvg}</svg>`;

  container.querySelectorAll('.moon-bar').forEach(el => {
    const row = rows[parseInt(el.dataset.idx, 10)];
    el.addEventListener('mousemove', (e) => {
      const fmt = (list) => list.map(a => `${a.name} (${a.avg.toFixed(1)})`).join(', ') || '-';
      showTip(e, `<strong>${row.label}</strong><br>Avg: ${row.avg.toFixed(2)} / 4 (n=${row.count})`
        + `<br>Top asanas: ${fmt(row.top3)}`
        + `<br>Low asanas: ${fmt(row.bottom3)}`);
    });
    el.addEventListener('mouseleave', hideTip);
  });
}

// ---------- "Trikala Sandhya" box: Morning/Evening asana-count pie charts ----------
// 1-1.5 -> 1, 1.5-2.5 -> 2, 2.5-3.5 -> 3, above 3.5 -> 4.
function scoreBucketFromAvg(avg) {
  if (avg <= 1.5) return 1;
  if (avg <= 2.5) return 2;
  if (avg <= 3.5) return 3;
  return 4;
}

// Groups all 24 asanas into the four rating buckets (plus a 5th "no data"
// bucket, so counts always sum to 24) by each asana's own average rating,
// within one session only - morning ratings never influence the evening pie
// and vice versa - over whichever entries are passed in (a 30-day or 7-day
// slice, picked by the caller).
function computeSessionAsanaBuckets(entries, session) {
  const totals = {};
  ASANAS.forEach(a => { totals[a.key] = { sum: 0, count: 0 }; });
  entries.forEach(entry => {
    const ratings = entry.asanaRatings && entry.asanaRatings[session];
    if (!ratings) return;
    Object.entries(ratings).forEach(([key, val]) => {
      if (!totals[key]) return;
      totals[key].sum += val; totals[key].count += 1;
    });
  });
  const buckets = { 1: [], 2: [], 3: [], 4: [], none: [] };
  ASANAS.forEach(a => {
    const t = totals[a.key];
    if (!t.count) { buckets.none.push({ name: a.name, avg: null }); return; }
    const avg = t.sum / t.count;
    buckets[scoreBucketFromAvg(avg)].push({ name: a.name, avg });
  });
  [1, 2, 3, 4].forEach(k => buckets[k].sort((a, b) => b.avg - a.avg));
  return buckets;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: Math.round((cx + r * Math.cos(rad)) * 100) / 100, y: Math.round((cy + r * Math.sin(rad)) * 100) / 100 };
}
function pieSlicePath(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 359.999) {
    // A full circle has no distinct start/end point for a single arc command
    // - draw it as two half-circle arcs instead.
    const mid = polarToCartesian(cx, cy, r, startAngle + 180);
    const start = polarToCartesian(cx, cy, r, startAngle);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${mid.x} ${mid.y} A ${r} ${r} 0 1 1 ${start.x} ${start.y} Z`;
  }
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

const NO_DATA_SLICE_COLOR = '#d7d2c9';
let _pieSeq = 0;

// Just the pie itself (no legend - the count already sits inside each
// slice). Hovering a wedge or its count label shows that bucket's asanas,
// ranked highest-average first.
function renderAsanaScorePie(container, buckets, tooltipRangeLabel) {
  const total = 24;
  const r = 56, cx = 60, cy = 60, size = 120;
  const order = [1, 2, 3, 4]; // ascending, drawn clockwise from 12 o'clock
  let angleCursor = 0;
  let svg = '';
  const pieId = 'pie' + (_pieSeq++);

  order.forEach(score => {
    const count = buckets[score].length;
    if (!count) return;
    const color = ASANA_BAR_RAMP[score - 1];
    const sweep = count / total * 360;
    const path = pieSlicePath(cx, cy, r, angleCursor, angleCursor + sweep);
    const labelPos = polarToCartesian(cx, cy, r * 0.6, angleCursor + sweep / 2);
    svg += `<path class="asana-pie-slice" data-pie="${pieId}" data-bucket="${score}" d="${path}" fill="${color}" style="cursor:pointer"/>`;
    svg += `<text class="asana-pie-count" data-pie="${pieId}" data-bucket="${score}" x="${labelPos.x}" y="${labelPos.y + 5}" font-size="14" font-weight="600" fill="#fff" text-anchor="middle" style="cursor:pointer">${count}</text>`;
    angleCursor += sweep;
  });

  const noneCount = buckets.none.length;
  if (noneCount) {
    const sweep = noneCount / total * 360;
    const path = pieSlicePath(cx, cy, r, angleCursor, angleCursor + sweep);
    const labelPos = polarToCartesian(cx, cy, r * 0.6, angleCursor + sweep / 2);
    svg += `<path class="asana-pie-slice" data-pie="${pieId}" data-bucket="none" d="${path}" fill="${NO_DATA_SLICE_COLOR}" style="cursor:pointer"/>`;
    svg += `<text class="asana-pie-count" data-pie="${pieId}" data-bucket="none" x="${labelPos.x}" y="${labelPos.y + 5}" font-size="14" font-weight="600" fill="#464038" text-anchor="middle" style="cursor:pointer">${noneCount}</text>`;
  }

  container.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svg}</svg>`;

  container.querySelectorAll(`[data-pie="${pieId}"]`).forEach(el => {
    const score = el.dataset.bucket;
    const items = score === 'none' ? buckets.none : buckets[score];
    el.addEventListener('mousemove', (e) => {
      const heading = score === 'none'
        ? `No data in the ${tooltipRangeLabel}`
        : `${(RATING_SCALE.find(r2 => r2.value === Number(score)) || {}).label} (score ${score})`;
      const names = items.map(a => a.avg === null ? a.name : `${a.name} (${a.avg.toFixed(1)})`).join(', ') || '-';
      showTip(e, `<strong>${heading}</strong><br>${items.length} of 24 asanas - ${tooltipRangeLabel}<br>${names}`);
    });
    el.addEventListener('mouseleave', hideTip);
  });
}

const TRIKALA_SESSIONS = [
  { key: 'morning', label: 'Morning (Pratah Sandhya)' },
  { key: 'evening', label: 'Evening (Sayam Sandhya)' },
];
const TRIKALA_RANGES = [
  { key: '30', days: 30, caption: 'Last 30 Days' },
  { key: '7', days: 7, caption: 'Last 7 Days' },
];

function renderTrikalaSandhyaBox(container, entriesMap) {
  const entriesByRange = {};
  TRIKALA_RANGES.forEach(rg => { entriesByRange[rg.key] = lastNDaysEntries(entriesMap, rg.days); });

  let html = '';
  TRIKALA_SESSIONS.forEach(s => {
    html += `<div class="sun-row-label">${s.label}</div><div class="sun-range-row">`;
    TRIKALA_RANGES.forEach(rg => {
      html += `<div class="sun-pie-col">`
        + `<div class="sun-pie-slot" data-slot="${s.key}-${rg.key}"></div>`
        + `<div class="sun-range-caption">${rg.caption}</div>`
        + `</div>`;
    });
    html += `</div>`;
  });
  html += `<p class="insight-sub shaping-footer">See how many and which Asanas you have enjoyed practising in the morning or evening. Simply hover over the relevant pie chart to explore your practice over the last 7 days or 30 days.</p>`;
  container.innerHTML = html;

  TRIKALA_SESSIONS.forEach(s => {
    TRIKALA_RANGES.forEach(rg => {
      const buckets = computeSessionAsanaBuckets(entriesByRange[rg.key], s.key);
      const slot = container.querySelector(`[data-slot="${s.key}-${rg.key}"]`);
      renderAsanaScorePie(slot, buckets, rg.caption.toLowerCase());
    });
  });
}

// ---------- "Fasting" box: influence of Recent Fasting around the last two Ekadashi ----------
// Ekadashi is traditionally a fasting day, so the window this box analyzes
// is bounded by the two most recent Ekadashi dates (inclusive), found by
// walking backward from today using the same lunar approximation as
// everywhere else in the app (js/moon.js's getLunarEvent).
function lastTwoEkadashiWindow() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const found = [];
  let d = todayStr;
  let guard = 0;
  while (found.length < 2 && guard < 120) {
    if (getLunarEvent(d).isEkadashi) found.push(d);
    d = addDays(d, -1);
    guard++;
  }
  if (found.length < 2) return null;
  return { start: found[1], end: found[0] }; // [older, newer]
}

function computeFastingBreakdown(entriesMap, window) {
  const buckets = {};
  FASTING_OPTIONS.forEach(o => { buckets[o.value] = { scores: [], asanaTotals: {} }; });
  Object.values(entriesMap).forEach(entry => {
    if (entry.date < window.start || entry.date > window.end) return;
    const score = entryAvgScore(entry);
    if (score === null) return;
    const b = buckets[entry.fasting];
    if (!b) return;
    b.scores.push(score);
    flattenAsanaEntries(entry.asanaRatings).forEach(([key, val]) => {
      const t = b.asanaTotals[key] || (b.asanaTotals[key] = { sum: 0, count: 0 });
      t.sum += val; t.count += 1;
    });
  });
  return FASTING_OPTIONS.map(o => {
    const b = buckets[o.value];
    const avg = b.scores.length ? b.scores.reduce((a, c) => a + c, 0) / b.scores.length : null;
    const asanaAverages = Object.entries(b.asanaTotals).map(([key, t]) => ({
      name: (ASANAS.find(a => a.key === key) || {}).name || key,
      avg: t.sum / t.count,
    })).sort((a, b2) => b2.avg - a.avg);
    return {
      value: o.value, label: o.label, avg, count: b.scores.length,
      top3: asanaAverages.slice(0, 3), bottom3: asanaAverages.slice(-3).reverse(),
    };
  });
}

const FASTING_BAR_COLOR = MOON_BAR_COLOR;

// Same visual language as the Moon Phase bars (zoomed axis, value drawn
// inside the bar), just 3 fixed rows and no row icon.
function renderFastingChart(container, rows, rangeLabel) {
  const withData = rows.filter(r => r.avg !== null);
  if (!withData.length) {
    container.innerHTML = '<div class="empty-state">No entries logged in this window yet.</div>';
    return;
  }
  const vals = withData.map(r => r.avg);
  let domainMin = Math.round((Math.floor(Math.min(...vals) * 10) / 10 - 0.1) * 100) / 100;
  let domainMax = Math.round((Math.ceil(Math.max(...vals) * 10) / 10) * 100) / 100;
  domainMin = Math.max(1, domainMin);
  if (domainMax - domainMin < 0.4) domainMax = domainMin + 0.4;
  domainMax = Math.min(4, domainMax);
  if (domainMax - domainMin < 0.1) domainMin = Math.max(1, domainMax - 0.4);

  const w = container.clientWidth || 440;
  const rowH = 34, padT = 10, padB = 26;
  const labelW = 118, leftPad = 10, rightPad = 14;
  const chartLeft = leftPad + labelW;
  const chartRight = w - rightPad;
  const barMax = Math.max(20, chartRight - chartLeft);
  const h = padT + rows.length * rowH + padB;
  const xFor = (v) => Math.round((chartLeft + (v - domainMin) / (domainMax - domainMin) * barMax) * 100) / 100;

  let gridSvg = '';
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const t = domainMin + (domainMax - domainMin) * i / tickCount;
    const x = xFor(t);
    gridSvg += `<line x1="${x}" x2="${x}" y1="${padT}" y2="${h - padB}" stroke="#e6dcd0" stroke-width="1"/>`;
    gridSvg += `<text x="${x}" y="${h - padB + 16}" font-size="10" fill="#464038" text-anchor="middle">${Math.round(t * 100) / 100}</text>`;
  }
  gridSvg += `<line x1="${chartLeft}" x2="${chartLeft}" y1="${padT}" y2="${h - padB}" stroke="#1a1a1a" stroke-width="1.6"/>`;

  let rowsSvg = '';
  const chartId = 'fast' + (_pieSeq++);
  rows.forEach((row, i) => {
    const y = padT + i * rowH;
    const cy = y + rowH / 2;
    rowsSvg += `<text x="${leftPad}" y="${cy + 4}" font-size="11.5" fill="#464038">${row.label}</text>`;
    if (row.avg === null) {
      rowsSvg += `<text x="${chartLeft + 6}" y="${cy + 4}" font-size="11" fill="#a8a196">No data</text>`;
      return;
    }
    const barH = 18, barY = cy - barH / 2;
    const barW = Math.max(3, xFor(row.avg) - chartLeft);
    const path = roundedRightPath(chartLeft, barY, barW, barH, barH / 2);
    const display = Number.isInteger(row.avg) ? String(row.avg) : row.avg.toFixed(1);
    rowsSvg += `<path class="fasting-bar" data-chart="${chartId}" data-idx="${i}" d="${path}" fill="${FASTING_BAR_COLOR}" style="cursor:pointer"/>`;
    rowsSvg += barW > 26
      ? `<text x="${chartLeft + barW - 8}" y="${cy + 4}" font-size="12" fill="#fff" text-anchor="end" style="pointer-events:none">${display}</text>`
      : `<text x="${chartLeft + barW + 6}" y="${cy + 4}" font-size="11" fill="#464038" style="pointer-events:none">${display}</text>`;
  });

  container.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${gridSvg}${rowsSvg}</svg>`;

  container.querySelectorAll(`.fasting-bar[data-chart="${chartId}"]`).forEach(el => {
    const row = rows[parseInt(el.dataset.idx, 10)];
    el.addEventListener('mousemove', (e) => {
      const fmt = (list) => list.map(a => `${a.name} (${a.avg.toFixed(1)})`).join(', ') || '-';
      showTip(e, `<strong>${row.label}</strong><br>Avg: ${row.avg.toFixed(2)} / 4 (n=${row.count}) - ${rangeLabel}`
        + `<br>Top asanas: ${fmt(row.top3)}`
        + `<br>Low asanas: ${fmt(row.bottom3)}`);
    });
    el.addEventListener('mouseleave', hideTip);
  });
}

function fastingFindingSentence(rows, rangeLabel) {
  const withData = rows.filter(r => r.avg !== null).sort((a, b) => b.avg - a.avg);
  if (!withData.length) return `No entries logged between the last two Ekadashi (${rangeLabel}) yet.`;
  if (withData.length < 2) return `Only "${withData[0].label}" was logged between the last two Ekadashi (${rangeLabel}) - not enough variety yet to compare fasting levels.`;
  const best = withData[0], worst = withData[withData.length - 1];
  if (best.avg - worst.avg < 0.05) return `Fasting level made little difference between the last two Ekadashi (${rangeLabel}) - scores were close across the board.`;
  return `Between the last two Ekadashi (${rangeLabel}), "${best.label}" read easiest (avg ${best.avg.toFixed(1)}/4, n=${best.count}) versus "${worst.label}" (avg ${worst.avg.toFixed(1)}/4, n=${worst.count}).`;
}

function renderFastingBox(container, entriesMap) {
  const window = lastTwoEkadashiWindow();
  if (!window) {
    container.innerHTML = '<div class="empty-state">Could not determine the last two Ekadashi dates yet.</div>';
    return;
  }
  const rangeLabel = `${formatDDMMM(window.start)} to ${formatDDMMM(window.end)}`;
  const rows = computeFastingBreakdown(entriesMap, window);

  const caption = document.createElement('p');
  caption.className = 'shaping-caption';
  caption.textContent = `Based on the last two Ekadashi (${rangeLabel}).`;
  container.appendChild(caption);

  const chartDiv = document.createElement('div');
  container.appendChild(chartDiv);
  renderFastingChart(chartDiv, rows, rangeLabel);

  const finding = document.createElement('p');
  finding.className = 'insight-sub shaping-footer';
  finding.textContent = fastingFindingSentence(rows, rangeLabel);
  container.appendChild(finding);
}

// ---------- "Showering" box: dumbbell chart of showered vs. not, per session ----------
// One dot per group (showered / did not shower) rather than a bar, so this
// reads differently from the Moon Phase / Fasting bar charts and the
// Trikala Sandhya pies - deliberately a different chart type for the same
// underlying "avg score by category" idea.
function computeShowerSessionStats(entries, session) {
  const groups = { yes: { scores: [], asanaTotals: {} }, no: { scores: [], asanaTotals: {} } };
  entries.forEach(entry => {
    const showered = entry.showeredBeforeAsanas && entry.showeredBeforeAsanas[session];
    if (showered !== true && showered !== false) return; // unanswered - excluded from both groups
    const ratings = entry.asanaRatings && entry.asanaRatings[session];
    const keys = ratings ? Object.keys(ratings) : [];
    if (!keys.length) return; // session wasn't practiced that day - no performance to attribute
    const vals = keys.map(k => ratings[k]);
    const score = vals.reduce((a, b) => a + b, 0) / vals.length;
    const g = groups[showered ? 'yes' : 'no'];
    g.scores.push(score);
    keys.forEach(key => {
      const t = g.asanaTotals[key] || (g.asanaTotals[key] = { sum: 0, count: 0 });
      t.sum += ratings[key]; t.count += 1;
    });
  });
  const build = (g) => {
    const avg = g.scores.length ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : null;
    const asanaAverages = Object.entries(g.asanaTotals).map(([key, t]) => ({
      name: (ASANAS.find(a => a.key === key) || {}).name || key,
      avg: t.sum / t.count,
    })).sort((a, b) => b.avg - a.avg);
    return { avg, count: g.scores.length, top3: asanaAverages.slice(0, 3), bottom3: asanaAverages.slice(-3).reverse() };
  };
  return { yes: build(groups.yes), no: build(groups.no) };
}

const SHOWER_SESSIONS = [
  { key: 'morning', label: 'Morning (Pratah Sandhya)', line1: 'Morning', line2: '(Pratah Sandhya)' },
  { key: 'evening', label: 'Evening (Sayam Sandhya)', line1: 'Evening', line2: '(Sayam Sandhya)' },
];
const SHOWER_YES_COLOR = '#4CAF50';
const SHOWER_NO_COLOR = '#a8a196';

function renderShowerDumbbellChart(container, sessionStats, rangeLabel) {
  const allVals = [];
  SHOWER_SESSIONS.forEach(s => {
    const st = sessionStats[s.key];
    if (st.yes.avg !== null) allVals.push(st.yes.avg);
    if (st.no.avg !== null) allVals.push(st.no.avg);
  });
  if (!allVals.length) {
    container.innerHTML = '<div class="empty-state">Not enough shower data logged in the last 30 days yet.</div>';
    return;
  }
  let domainMin = Math.round((Math.floor(Math.min(...allVals) * 10) / 10 - 0.1) * 100) / 100;
  let domainMax = Math.round((Math.ceil(Math.max(...allVals) * 10) / 10) * 100) / 100;
  domainMin = Math.max(1, domainMin);
  if (domainMax - domainMin < 0.4) domainMax = domainMin + 0.4;
  domainMax = Math.min(4, domainMax);
  if (domainMax - domainMin < 0.1) domainMin = Math.max(1, domainMax - 0.4);

  const w = container.clientWidth || 440;
  const rowH = 66, padT = 16, padB = 30;
  const labelW = 138, leftPad = 10, rightPad = 20;
  const chartLeft = leftPad + labelW;
  const chartRight = w - rightPad;
  const trackW = Math.max(20, chartRight - chartLeft);
  const h = padT + SHOWER_SESSIONS.length * rowH + padB;
  const xFor = (v) => Math.round((chartLeft + (v - domainMin) / (domainMax - domainMin) * trackW) * 100) / 100;

  let gridSvg = '';
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const t = domainMin + (domainMax - domainMin) * i / tickCount;
    const x = xFor(t);
    gridSvg += `<line x1="${x}" x2="${x}" y1="${padT}" y2="${h - padB}" stroke="#e6dcd0" stroke-width="1"/>`;
    gridSvg += `<text x="${x}" y="${h - padB + 16}" font-size="10" fill="#464038" text-anchor="middle">${Math.round(t * 100) / 100}</text>`;
  }
  gridSvg += `<line x1="${chartLeft}" x2="${chartLeft}" y1="${padT}" y2="${h - padB}" stroke="#1a1a1a" stroke-width="1.6"/>`;

  const chartId = 'shower' + (_pieSeq++);
  let rowsSvg = '';
  SHOWER_SESSIONS.forEach((s, i) => {
    const y = padT + i * rowH;
    const cy = y + rowH / 2;
    rowsSvg += `<text x="${leftPad}" y="${cy - 3}" font-size="11.5" fill="#464038">${s.line1}</text>`;
    rowsSvg += `<text x="${leftPad}" y="${cy + 11}" font-size="10" fill="#464038">${s.line2}</text>`;
    const st = sessionStats[s.key];
    if (st.yes.avg === null && st.no.avg === null) {
      rowsSvg += `<text x="${chartLeft + 6}" y="${cy + 4}" font-size="11" fill="#a8a196">No data</text>`;
      return;
    }
    const noX = st.no.avg !== null ? xFor(st.no.avg) : null;
    const yesX = st.yes.avg !== null ? xFor(st.yes.avg) : null;
    // The two averages can land within a couple pixels of each other (or
    // exactly on top) - nudge the dots apart vertically so both stay visible
    // and their value labels don't collide, instead of silently hiding one
    // underneath the other.
    const overlapping = noX !== null && yesX !== null && Math.abs(noX - yesX) < 16;
    const noCy = overlapping ? cy - 8 : cy;
    const yesCy = overlapping ? cy + 8 : cy;
    if (noX !== null && yesX !== null) {
      rowsSvg += `<line x1="${noX}" x2="${yesX}" y1="${noCy}" y2="${yesCy}" stroke="#c9c2b4" stroke-width="2"/>`;
    }
    if (noX !== null) {
      rowsSvg += `<circle class="shower-dot" data-chart="${chartId}" data-session="${s.key}" data-group="no" cx="${noX}" cy="${noCy}" r="7" fill="${SHOWER_NO_COLOR}" stroke="#fffdfa" stroke-width="1.5" style="cursor:pointer"/>`;
      rowsSvg += `<text x="${noX}" y="${noCy - 13}" font-size="10.5" font-weight="600" fill="#464038" text-anchor="middle" style="pointer-events:none">${st.no.avg.toFixed(1)}</text>`;
    }
    if (yesX !== null) {
      rowsSvg += `<circle class="shower-dot" data-chart="${chartId}" data-session="${s.key}" data-group="yes" cx="${yesX}" cy="${yesCy}" r="7" fill="${SHOWER_YES_COLOR}" stroke="#fffdfa" stroke-width="1.5" style="cursor:pointer"/>`;
      rowsSvg += `<text x="${yesX}" y="${yesCy + 22}" font-size="10.5" font-weight="600" fill="#464038" text-anchor="middle" style="pointer-events:none">${st.yes.avg.toFixed(1)}</text>`;
    }
  });

  container.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${gridSvg}${rowsSvg}</svg>`
    + `<div class="shower-legend">`
    + `<span class="shower-legend-item"><span class="shower-legend-dot" style="background:${SHOWER_NO_COLOR}"></span>No shower</span>`
    + `<span class="shower-legend-item"><span class="shower-legend-dot" style="background:${SHOWER_YES_COLOR}"></span>Showered</span>`
    + `</div>`;

  container.querySelectorAll(`.shower-dot[data-chart="${chartId}"]`).forEach(el => {
    const session = el.dataset.session, group = el.dataset.group;
    const stats = sessionStats[session][group];
    el.addEventListener('mousemove', (e) => {
      const fmt = (list) => list.map(a => `${a.name} (${a.avg.toFixed(1)})`).join(', ') || '-';
      const sessLabel = (SHOWER_SESSIONS.find(s => s.key === session) || {}).label;
      const groupLabel = group === 'yes' ? 'Showered before asanas' : 'Did not shower before asanas';
      showTip(e, `<strong>${sessLabel} - ${groupLabel}</strong><br>Avg: ${stats.avg.toFixed(2)} / 4 (n=${stats.count}) - ${rangeLabel}`
        + `<br>Top asanas: ${fmt(stats.top3)}`
        + `<br>Low asanas: ${fmt(stats.bottom3)}`);
    });
    el.addEventListener('mouseleave', hideTip);
  });
}

function showerFindingSentence(sessionStats, rangeLabel) {
  const parts = [];
  SHOWER_SESSIONS.forEach(s => {
    const st = sessionStats[s.key];
    if (st.yes.avg === null || st.no.avg === null) return;
    const diff = st.yes.avg - st.no.avg;
    if (Math.abs(diff) < 0.05) return;
    const better = diff > 0 ? 'Showering before practice' : 'Not showering first';
    parts.push(`${s.label.split(' ')[0]}: ${better} read easier (${st.yes.avg.toFixed(1)} showered vs ${st.no.avg.toFixed(1)} not, n=${st.yes.count}/${st.no.count}).`);
  });
  if (!parts.length) return `Showering made little difference to practice over the ${rangeLabel} - scores were close either way.`;
  return parts.join(' ');
}

function renderShowerBox(container, entriesMap) {
  const entries = lastNDaysEntries(entriesMap, SHAPING_WINDOW_DAYS);
  const sessionStats = {
    morning: computeShowerSessionStats(entries, 'morning'),
    evening: computeShowerSessionStats(entries, 'evening'),
  };

  const caption = document.createElement('p');
  caption.className = 'shaping-caption';
  caption.textContent = 'Based on the last 30 days.';
  container.appendChild(caption);

  const chartDiv = document.createElement('div');
  container.appendChild(chartDiv);
  renderShowerDumbbellChart(chartDiv, sessionStats, 'last 30 days');

  const finding = document.createElement('p');
  finding.className = 'insight-sub shaping-footer';
  finding.textContent = showerFindingSentence(sessionStats, 'last 30 days');
  container.appendChild(finding);
}

// ---------- "Kriyas and Sadhanas" box: diverging influence chart ----------
// One bar per kriya/sadhana, sized by (avg score on days it was done) minus
// (avg score on days it wasn't) - a genuinely different chart shape from
// the value bars, pies and dumbbell used elsewhere: signed, zero-centered,
// ranked by influence rather than by raw value.
function computeKriyaBreakdown(entries, isActivatedFn) {
  return KRIYA_SADHANA_ITEMS.map(item => {
    // Kriyas requiring initiation that the user hasn't activated yet are
    // excluded from the influence computation entirely (not just hidden) -
    // shown as "(N/I)" rather than a computed (and misleading) delta.
    if (isActivatedFn && !isActivatedFn(item.key)) {
      const empty = { avg: null, count: 0, top3: [], bottom3: [] };
      return { key: item.key, name: `${item.name} (N/I)`, done: empty, notDone: empty, delta: null, activated: false };
    }
    const done = { scores: [], asanaTotals: {} };
    const notDone = { scores: [], asanaTotals: {} };
    entries.forEach(entry => {
      const val = entry.kriyaSadhana && entry.kriyaSadhana[item.key];
      if (val !== true && val !== false) return; // unanswered
      const score = entryAvgScore(entry);
      if (score === null) return;
      const g = val ? done : notDone;
      g.scores.push(score);
      flattenAsanaEntries(entry.asanaRatings).forEach(([key, v]) => {
        const t = g.asanaTotals[key] || (g.asanaTotals[key] = { sum: 0, count: 0 });
        t.sum += v; t.count += 1;
      });
    });
    const build = (g) => {
      const avg = g.scores.length ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : null;
      const asanaAverages = Object.entries(g.asanaTotals).map(([key, t]) => ({
        name: (ASANAS.find(a => a.key === key) || {}).name || key,
        avg: t.sum / t.count,
      })).sort((a, b) => b.avg - a.avg);
      return { avg, count: g.scores.length, top3: asanaAverages.slice(0, 3), bottom3: asanaAverages.slice(-3).reverse() };
    };
    const doneStats = build(done), notDoneStats = build(notDone);
    const delta = (doneStats.avg !== null && notDoneStats.avg !== null) ? doneStats.avg - notDoneStats.avg : null;
    return { key: item.key, name: item.name, done: doneStats, notDone: notDoneStats, delta, activated: true };
  });
}

const KRIYA_POSITIVE_COLOR = '#4CAF50';
const KRIYA_NEGATIVE_COLOR = '#E5352B';

function roundedLeftPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width, height / 2));
  return `M${x + r},${y} L${x + width},${y} L${x + width},${y + height} L${x + r},${y + height} `
    + `Q${x},${y + height} ${x},${y + height - r} L${x},${y + r} Q${x},${y} ${x + r},${y} Z`;
}

function renderKriyaDivergingChart(container, rowsIn, rangeLabel) {
  const rows = rowsIn.filter(r => r.delta !== null).sort((a, b) => b.delta - a.delta)
    .concat(rowsIn.filter(r => r.delta === null));
  const withDelta = rows.filter(r => r.delta !== null);
  if (!withDelta.length) {
    container.innerHTML = '<div class="empty-state">Not enough kriya/sadhana variety logged in the last 30 days yet.</div>';
    return;
  }
  let domainMax = Math.max(...withDelta.map(r => Math.abs(r.delta)));
  domainMax = Math.ceil((domainMax + 0.05) * 10) / 10;
  if (domainMax < 0.2) domainMax = 0.2;

  const w = container.clientWidth || 440;
  const rowH = 30, padT = 10, padB = 10;
  const labelW = 180, leftPad = 10, rightPad = 42;
  const chartLeft = leftPad + labelW;
  const chartRight = w - rightPad;
  const trackW = Math.max(40, chartRight - chartLeft);
  const zeroX = chartLeft + trackW / 2;
  const halfW = trackW / 2;
  const h = padT + rows.length * rowH + padB;
  const xFor = (delta) => Math.round((zeroX + (delta / domainMax) * halfW) * 100) / 100;

  let rowsSvg = `<line x1="${zeroX}" x2="${zeroX}" y1="${padT}" y2="${h - padB}" stroke="#1a1a1a" stroke-width="1.6"/>`;
  const chartId = 'kriya' + (_pieSeq++);

  rows.forEach((row, i) => {
    const y = padT + i * rowH;
    const cy = y + rowH / 2;
    const label = row.name.length > 32 ? row.name.slice(0, 31) + '…' : row.name;
    rowsSvg += `<text x="${leftPad}" y="${cy + 4}" font-size="10.5" fill="#464038">${label}</text>`;
    if (row.delta === null) {
      const naText = row.activated === false ? 'Not Initiated' : 'No data';
      rowsSvg += `<text x="${zeroX + 6}" y="${cy + 4}" font-size="10.5" fill="#a8a196">${naText}</text>`;
      return;
    }
    const barH = 14, barY = cy - barH / 2;
    const x = xFor(row.delta);
    const display = (row.delta >= 0 ? '+' : '') + row.delta.toFixed(2);
    if (row.delta >= 0) {
      const barW = Math.max(2, x - zeroX);
      const path = roundedRightPath(zeroX, barY, barW, barH, barH / 2);
      rowsSvg += `<path class="kriya-bar" data-chart="${chartId}" data-idx="${i}" d="${path}" fill="${KRIYA_POSITIVE_COLOR}" style="cursor:pointer"/>`;
      rowsSvg += `<text x="${zeroX + barW + 6}" y="${cy + 4}" font-size="10.5" fill="#464038" style="pointer-events:none">${display}</text>`;
    } else {
      const barW = Math.max(2, zeroX - x);
      const path = roundedLeftPath(x, barY, barW, barH, barH / 2);
      rowsSvg += `<path class="kriya-bar" data-chart="${chartId}" data-idx="${i}" d="${path}" fill="${KRIYA_NEGATIVE_COLOR}" style="cursor:pointer"/>`;
      rowsSvg += `<text x="${x - 6}" y="${cy + 4}" font-size="10.5" fill="#464038" text-anchor="end" style="pointer-events:none">${display}</text>`;
    }
  });

  container.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rowsSvg}</svg>`
    + `<div class="kriya-legend">`
    + `<span class="kriya-legend-item"><span class="kriya-legend-swatch" style="background:${KRIYA_POSITIVE_COLOR}"></span>Higher score when done</span>`
    + `<span class="kriya-legend-item"><span class="kriya-legend-swatch" style="background:${KRIYA_NEGATIVE_COLOR}"></span>Lower score when done</span>`
    + `</div>`;

  container.querySelectorAll(`.kriya-bar[data-chart="${chartId}"]`).forEach(el => {
    const row = rows[parseInt(el.dataset.idx, 10)];
    el.addEventListener('mousemove', (e) => {
      const fmt = (list) => list.map(a => `${a.name} (${a.avg.toFixed(1)})`).join(', ') || '-';
      showTip(e, `<strong>${row.name}</strong><br>Done: avg ${row.done.avg.toFixed(2)}/4 (n=${row.done.count}) - ${rangeLabel}`
        + `<br>Not done: avg ${row.notDone.avg.toFixed(2)}/4 (n=${row.notDone.count})`
        + `<br>Top asanas when done: ${fmt(row.done.top3)}`
        + `<br>Low asanas when done: ${fmt(row.done.bottom3)}`);
    });
    el.addEventListener('mouseleave', hideTip);
  });
}

function kriyaFindingSentence(rowsIn, rangeLabel) {
  const withDelta = rowsIn.filter(r => r.delta !== null);
  if (!withDelta.length) return `Not enough kriya/sadhana variety logged over the ${rangeLabel} yet to compare.`;
  const sorted = withDelta.slice().sort((a, b) => b.delta - a.delta);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const parts = [];
  if (best.delta > 0.05) parts.push(`Days with "${best.name}" done read easiest (+${best.delta.toFixed(2)}/4 vs. not done, n=${best.done.count}/${best.notDone.count}).`);
  if (worst.delta < -0.05 && worst.key !== best.key) parts.push(`Days without "${worst.name}" read easier than days with it (${worst.delta.toFixed(2)}/4, n=${worst.done.count}/${worst.notDone.count}).`);
  if (!parts.length) return `None of the kriyas/sadhanas showed a clear influence over the ${rangeLabel} - scores were close either way.`;
  return parts.join(' ');
}

function renderKriyaBox(container, entriesMap, isActivatedFn) {
  const entries = lastNDaysEntries(entriesMap, SHAPING_WINDOW_DAYS);
  const rows = computeKriyaBreakdown(entries, isActivatedFn);

  const caption = document.createElement('p');
  caption.className = 'shaping-caption';
  caption.textContent = 'Based on the last 30 days.';
  container.appendChild(caption);

  const chartDiv = document.createElement('div');
  container.appendChild(chartDiv);
  renderKriyaDivergingChart(chartDiv, rows, 'last 30 days');

  const finding = document.createElement('p');
  finding.className = 'insight-sub shaping-footer';
  finding.textContent = kriyaFindingSentence(rows, 'last 30 days');
  container.appendChild(finding);
}

function renderShapingSection(container, entriesMap, isKriyaActivatedFn) {
  container.innerHTML = '';
  const entries = lastNDaysEntries(entriesMap, SHAPING_WINDOW_DAYS);
  const hasFemale = Object.values(entriesMap).some(e => e.sex === 'female');
  const topics = SHAPING_TOPICS.filter(t => t.key !== 'menstrual' || hasFemale);

  topics.forEach(topic => {
    const cell = document.createElement('div');
    cell.className = 'factor-cell shaping-cell';
    cell.dataset.topic = topic.key;
    cell.innerHTML = `<h3>${topic.title}</h3>`
      + (topic.caption ? `<p class="shaping-caption">${topic.caption}</p>` : '')
      + `<div class="shaping-body"></div>`
      + (topic.footer ? `<p class="insight-sub shaping-footer">${topic.footer}</p>` : '');
    container.appendChild(cell);
    const body = cell.querySelector('.shaping-body');
    if (topic.key === 'moon') {
      renderMoonPhaseChart(body, entries);
    } else if (topic.key === 'sun') {
      renderTrikalaSandhyaBox(body, entriesMap);
    } else if (topic.key === 'fasting') {
      renderFastingBox(body, entriesMap);
    } else if (topic.key === 'showering') {
      renderShowerBox(body, entriesMap);
    } else if (topic.key === 'kriyas') {
      renderKriyaBox(body, entriesMap, isKriyaActivatedFn);
    } else {
      body.innerHTML = '<div class="empty-state">Coming soon.</div>';
    }
  });
}

// ---------- 24 per-asana mini charts (last 7 days) ----------
// Bars are deliberately narrow (~40% of their slot) with room around them,
// so both the bar and the date label underneath stay legible at this small
// size. Color always exactly matches one of the four rating smileys (see
// discreteAsanaColor above) rather than a blended gradient.
function roundedTopPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} `
    + `L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

function renderMiniBarChart(container, points, todayStr) {
  const w = 220, h = 84, padL = 8, padR = 8, padT = 8, padB = 16;
  const slotW = (w - padL - padR) / points.length;
  const barW = slotW * 0.42;
  const noDataHeight = 10;
  const baselineY = h - padB;
  const yFor = (v) => padT + (4 - v) / 3 * (baselineY - padT);
  const svg = svgEl('svg', { width: '100%', height: h, viewBox: `0 0 ${w} ${h}` });

  // Thin x-axis line, drawn once under every bar.
  svg.appendChild(svgEl('line', { x1: padL, x2: w - padR, y1: baselineY, y2: baselineY, stroke: '#c9c2b4', 'stroke-width': 1 }));

  points.forEach((p, i) => {
    const slotCenter = padL + i * slotW + slotW / 2;
    const x = slotCenter - barW / 2;
    const isFuture = p.date >= todayStr;

    if (p.value !== undefined && p.value !== null) {
      const yTop = yFor(p.value);
      const barH = Math.max(2, baselineY - yTop);
      const bar = svgEl('path', { d: roundedTopPath(x, yTop, barW, barH, barW / 2), fill: discreteAsanaColor(p.value) });
      bar.style.cursor = 'pointer';
      bar.addEventListener('mousemove', (e) => showTip(e, `<strong>${formatDDMM(p.date)}</strong><br>${p.value.toFixed(1)} / 4`));
      bar.addEventListener('mouseleave', hideTip);
      svg.appendChild(bar);
    } else if (!isFuture) {
      // Grey "no data" only applies to past days that were skipped - today
      // and any day still to come just haven't happened yet, so they're
      // left blank rather than flagged.
      const bar = svgEl('path', { d: roundedTopPath(x, baselineY - noDataHeight, barW, noDataHeight, barW / 2), fill: '#d7d2c9' });
      bar.style.cursor = 'pointer';
      bar.addEventListener('mousemove', (e) => showTip(e, `<strong>${formatDDMM(p.date)}</strong><br>No data`));
      bar.addEventListener('mouseleave', hideTip);
      svg.appendChild(bar);
    }

    const label = svgEl('text', { x: slotCenter, y: h - 4, 'font-size': 9, fill: '#464038', 'text-anchor': 'middle' });
    label.textContent = formatDDMM(p.date);
    svg.appendChild(label);
  });

  container.innerHTML = '';
  container.appendChild(svg);
}

// Overall = Morning+Evening averaged per day (asanaValueForDay); Morning and
// Evening tabs each show that single session's own rating only, which is
// always a whole number - see asanaValueForDayMode.
let miniChartMode = 'overall';
const MINI_CHART_TABS = [
  { mode: 'overall', label: 'Overall' },
  { mode: 'morning', label: 'Morning' },
  { mode: 'evening', label: 'Evening' },
];

function renderMiniAsanaCharts(tabsContainer, gridContainer, entriesMap, weekDates, todayStr) {
  tabsContainer.innerHTML = MINI_CHART_TABS.map(t =>
    `<button type="button" class="mini-chart-tab-btn${t.mode === miniChartMode ? ' active' : ''}" data-mode="${t.mode}">${t.label}</button>`
  ).join('');
  tabsContainer.querySelectorAll('.mini-chart-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === miniChartMode) return;
      miniChartMode = btn.dataset.mode;
      renderMiniAsanaCharts(tabsContainer, gridContainer, entriesMap, weekDates, todayStr);
    });
  });

  gridContainer.innerHTML = '';
  ASANAS.forEach(asana => {
    const card = document.createElement('div');
    card.className = 'mini-chart-card';
    card.innerHTML = `<div class="mini-chart-title">${MINI_CHART_ICON}<span>${asana.name}</span></div>`;
    const chartDiv = document.createElement('div');
    card.appendChild(chartDiv);
    gridContainer.appendChild(card);
    renderMiniBarChart(chartDiv, weekDates.map(d => ({ date: d, value: asanaValueForDayMode(entriesMap[d], asana.key, miniChartMode) })), todayStr);
  });
}

function weekRangeBack(weeksBack, todayStr) {
  const monday = addDays(mondayOf(todayStr), -7 * weeksBack);
  return weekRange(monday);
}

function weeksBetweenMondays(fromDateStr, toDateStr) {
  const fromMonday = mondayOf(fromDateStr);
  const toMonday = mondayOf(toDateStr);
  const diffDays = (new Date(toMonday + 'T00:00:00Z') - new Date(fromMonday + 'T00:00:00Z')) / (24 * 60 * 60 * 1000);
  return Math.round(diffDays / 7);
}

// 0 = current calendar week (Mon-Sun, progressive - days after today just
// haven't happened yet); N>0 = N calendar weeks back. Mirrors
// renderTrendSection's month-paging pattern, just at week granularity, and
// stops at the week of the very first entry ever logged.
let miniChartWeeksBack = 0;

function renderMiniChartSection(navContainer, weekLabelEl, tabsContainer, gridContainer, entriesMap, allDates) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxWeeksBack = allDates.length ? weeksBetweenMondays(allDates[0], todayStr) : 0;
  const canGoBack = miniChartWeeksBack < maxWeeksBack;

  navContainer.innerHTML = `
    <button type="button" class="trend-nav-arrow" id="mini-prev-btn" aria-label="Previous week" ${canGoBack ? '' : 'disabled'}>&lsaquo;</button>
    <button type="button" class="trend-nav-current ${miniChartWeeksBack === 0 ? 'active' : ''}" id="mini-current-btn">Current Week</button>
  `;
  navContainer.querySelector('#mini-prev-btn').addEventListener('click', () => {
    if (miniChartWeeksBack >= maxWeeksBack) return;
    miniChartWeeksBack += 1;
    renderMiniChartSection(navContainer, weekLabelEl, tabsContainer, gridContainer, entriesMap, allDates);
  });
  navContainer.querySelector('#mini-current-btn').addEventListener('click', () => {
    miniChartWeeksBack = 0;
    renderMiniChartSection(navContainer, weekLabelEl, tabsContainer, gridContainer, entriesMap, allDates);
  });

  const range = weekRangeBack(miniChartWeeksBack, todayStr);
  const weekWord = miniChartWeeksBack === 0 ? 'Current Week'
    : miniChartWeeksBack === 1 ? 'Previous Week'
    : `${miniChartWeeksBack} Weeks Back`;
  if (weekLabelEl) weekLabelEl.textContent = `${weekWord} (Mon, ${formatDDMMM(range.start)} to Sun, ${formatDDMMM(range.end)})`;

  const weekDates = [];
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) weekDates.push(d);

  renderMiniAsanaCharts(tabsContainer, gridContainer, entriesMap, weekDates, todayStr);
}
