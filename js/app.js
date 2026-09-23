let CURRENT_USER = null;
let SELECTED_DATE = new Date().toISOString().slice(0, 10);
let DRAFT = null; // in-memory entry being edited
let dateEditMode = false; // false = show the "Today" badge, true = show the calendar input
let activeSession = new Date().getHours() < 12 ? 'morning' : 'evening'; // which Yogasanas tab is showing

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTimeStr() { return new Date().toTimeString().slice(0, 5); }
function formatFullDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${MONTH_ABBR[parseInt(m, 10) - 1]}-${y}`;
}

// Sex is a one-time choice, locked after the first pick (see the sex-picker
// UI in renderEntryForm), stored at the account level rather than per day.
function getLockedSex() {
  const s = Storage.getSettings(CURRENT_USER.email);
  return s.sexLocked ? s.lockedSex : null;
}
function lockSex(value) {
  const s = Storage.getSettings(CURRENT_USER.email);
  s.sexLocked = true;
  s.lockedSex = value;
  Storage.saveSettings(CURRENT_USER.email, s);
}

// Kriyas that require initiation are locked (greyed with an "Activate" gate)
// until the user confirms they've been initiated - an account-level choice,
// same storage pattern as the locked sex. Shambhavi Mahamudra Kriya is never
// locked (see js/poses.js / the reference mockup - it's the one item shown
// already active).
const KRIYA_NO_LOCK_KEY = 'shambhavi-mahamudra';
function isKriyaActivated(key) {
  if (key === KRIYA_NO_LOCK_KEY) return true;
  const s = Storage.getSettings(CURRENT_USER.email);
  return !!(s.activatedKriyas && s.activatedKriyas[key]);
}
function activateKriya(key) {
  const s = Storage.getSettings(CURRENT_USER.email);
  if (!s.activatedKriyas) s.activatedKriyas = {};
  s.activatedKriyas[key] = true;
  Storage.saveSettings(CURRENT_USER.email, s);
}

function blankEntry(date) {
  return {
    date,
    practiceTime: date === todayStr() ? nowTimeStr() : '06:00',
    generalNotes: '',
    mealStatus: MEAL_STATUS_OPTIONS[0].value,
    mealTime: '',
    fasting: 'none',
    sex: getLockedSex(),
    menstrualCycle: null, // null = unanswered, required before saving when sex is Female
    ekadashiFast: 'none', // defaults to "No Fast" (unlike the mandatory menstrual-cycle question, this isn't required)
    kriyaSadhana: {},
    asanaRatings: { morning: {}, evening: {} },
    showeredBeforeAsanas: { morning: null, evening: null }, // per-session, like asanaRatings; null = unanswered
  };
}

// Older saved entries have a flat { asanaKey: value } shape from before
// Morning/Evening sessions existed. Treat that as the Morning session so
// nothing crashes or silently loses data when reopening an old date.
function normalizeAsanaRatings(ratings) {
  if (!ratings) return { morning: {}, evening: {} };
  if (ratings.morning || ratings.evening) {
    return { morning: ratings.morning || {}, evening: ratings.evening || {} };
  }
  return { morning: { ...ratings }, evening: {} };
}

function init() {
  CURRENT_USER = Storage.getUser();
  if (!CURRENT_USER) { window.location.href = 'index.html'; return; }

  document.getElementById('user-name').textContent = CURRENT_USER.name;
  document.getElementById('sign-out-btn').addEventListener('click', () => {
    Storage.clearUser();
    window.location.href = 'index.html';
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  loadDraftForDate(SELECTED_DATE);
  renderEntryForm();
  renderSettingsTab();
  startReminderLoop();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'insights') renderInsightsTab();
  // Re-render on return too - e.g. whether "Change" (sex) should still show
  // depends on whether an entry now exists, which may have changed since
  // this tab was last shown.
  if (tab === 'entry') renderEntryForm();
}

function loadDraftForDate(date) {
  const existing = Storage.getEntry(CURRENT_USER.email, date);
  DRAFT = existing ? JSON.parse(JSON.stringify(existing)) : blankEntry(date);
  // Backfill fields added after this entry may have been saved, so opening an
  // older saved date never crashes the render just because a newer field is
  // missing from it.
  if (!DRAFT.kriyaSadhana) DRAFT.kriyaSadhana = {};
  DRAFT.asanaRatings = normalizeAsanaRatings(DRAFT.asanaRatings);
  if (!DRAFT.showeredBeforeAsanas) DRAFT.showeredBeforeAsanas = { morning: null, evening: null };
  // Sex is a fixed, one-time account choice - once locked, every day reflects
  // that same value rather than whatever happened to be saved for this date.
  const locked = getLockedSex();
  DRAFT.sex = locked || null;
  // Missing entirely (older saved entry) means genuinely unanswered - null,
  // not false, so it isn't silently treated as an already-answered "No".
  if (DRAFT.menstrualCycle === undefined) DRAFT.menstrualCycle = null;
  if (!DRAFT.ekadashiFast) DRAFT.ekadashiFast = 'none';
}

// ---------- Entry form ----------
function renderEntryForm() {
  const root = document.getElementById('entry-form-root');
  const moon = getMoonPhase(SELECTED_DATE);
  const isEkadashiDay = getLunarEvent(SELECTED_DATE).isEkadashi;

  const lockedSexVal = getLockedSex();
  const sexColHtml = lockedSexVal
    ? `
      <div class="sex-locked">
        <div class="avatar-frame locked">${avatarSVG(lockedSexVal, '#a8a196', 56)}</div>
        <div class="sex-locked-label">${(SEX_OPTIONS.find(o => o.value === lockedSexVal) || {}).label || ''}</div>
        <button type="button" class="link-btn" id="edit-sex-btn">Change</button>
        ${lockedSexVal === 'female' ? `
          <div class="field" id="f-menstrual-field">
            <label>Currently in menstrual cycle? <span class="required-mark">*</span></label>
            <div class="yesno-row">
              <button type="button" class="yesno-btn ${DRAFT.menstrualCycle === true ? 'selected' : ''}" data-menstrual="yes">Yes</button>
              <button type="button" class="yesno-btn ${DRAFT.menstrualCycle === false ? 'selected' : ''}" data-menstrual="no">No</button>
            </div>
          </div>` : ''}
      </div>`
    : `
      <div class="sex-picker">
        <label>About me</label>
        <div class="avatar-choice-row">
          <button type="button" class="avatar-btn" data-sex="male">${avatarSVG('male', '#464038', 52)}<span>Male</span></button>
          <button type="button" class="avatar-btn" data-sex="female">${avatarSVG('female', '#464038', 52)}<span>Female</span></button>
        </div>
        <button type="button" class="link-btn" id="prefer-not-say-btn">Prefer not to say</button>
      </div>`;

  root.innerHTML = `
    <div class="card">
      <h2>My Daily Well-being Tracker</h2>
      <div class="wellbeing-top">
        <div class="field wellbeing-date-col">
          <label>Date</label>
          ${(dateEditMode || SELECTED_DATE !== todayStr())
            ? `<input type="date" id="f-date" value="${SELECTED_DATE}" max="${todayStr()}">`
            : `<div class="today-row">
                 <span class="readonly-pill">Today</span>
                 <span class="or-text">OR</span>
                 <button type="button" class="link-btn" id="pick-date-btn">Choose a date</button>
               </div>`
          }
          <span class="readonly-pill moon-pill">🌕 Moon: ${moon.label}</span>
          <div class="moon-stage-row">
            ${MOON_PHASES.map(p => `
              <span class="moon-stage-item ${p.key === moon.key ? 'current' : ''}" title="${p.label}">
                ${moonIconSVG(p.key, 38)}
              </span>`).join('')}
          </div>
        </div>
        <div class="wellbeing-sex-col">${sexColHtml}</div>
      </div>
      <div class="field ekadashi-field">
        <label>${isEkadashiDay ? '<strong class="ekadashi-word">Ekadashi</strong> fast' : 'Normal day fast'}</label>
        <div class="fast-choice-row">
          ${EKADASHI_FAST_OPTIONS.map(o => `<button type="button" class="fast-btn ${DRAFT.ekadashiFast === o.value ? 'selected' : ''}" data-fast="${o.value}">${o.label}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Yogasanas - My experience today</h2>
      <div class="session-tabs">
        ${renderSessionTab('morning', 'Morning Session')}
        ${renderSessionTab('evening', 'Evening Session')}
      </div>
      <div class="pose-grid">
        ${ASANAS.map(a => renderPoseTile(a)).join('')}
      </div>
      <div class="save-bar">
        <button type="button" class="action-btn" id="reset-asanas-btn">Reset</button>
      </div>
    </div>

    <div class="card">
      <h2>Kriyas and Sadhanas done today</h2>
      <div class="kriya-sadhana-grid">
        ${KRIYA_SADHANA_ITEMS.map(item => renderKriyaSadhanaTile(item)).join('')}
      </div>
      <div class="save-bar">
        <button type="button" class="action-btn" id="reset-kriya-sadhana-btn">Reset</button>
      </div>
    </div>

    <div class="card">
      <h2>General notes</h2>
      <div class="field">
        <textarea id="f-notes" rows="3" placeholder="Anything worth remembering about today...">${DRAFT.generalNotes || ''}</textarea>
      </div>
    </div>

    <div class="save-bar">
      <button class="action-btn" id="save-entry-btn">Submit</button>
    </div>
  `;

  const dateInput = document.getElementById('f-date');
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      SELECTED_DATE = e.target.value;
      loadDraftForDate(SELECTED_DATE);
      renderEntryForm();
    });
  }
  const pickDateBtn = document.getElementById('pick-date-btn');
  if (pickDateBtn) {
    pickDateBtn.addEventListener('click', () => {
      dateEditMode = true;
      renderEntryForm();
    });
  }
  document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      lockSex(btn.dataset.sex);
      DRAFT.sex = btn.dataset.sex;
      renderEntryForm();
    });
  });
  const preferNotSayBtn = document.getElementById('prefer-not-say-btn');
  if (preferNotSayBtn) {
    preferNotSayBtn.addEventListener('click', () => {
      lockSex('prefer-not-to-say');
      DRAFT.sex = 'prefer-not-to-say';
      renderEntryForm();
    });
  }
  const editSexBtn = document.getElementById('edit-sex-btn');
  if (editSexBtn) {
    editSexBtn.addEventListener('click', () => {
      if (confirm('Change your sex selection? This updates it everywhere, not just today.')) {
        const s = Storage.getSettings(CURRENT_USER.email);
        s.sexLocked = false;
        Storage.saveSettings(CURRENT_USER.email, s);
        DRAFT.sex = null;
        renderEntryForm();
      }
    });
  }
  document.querySelectorAll('#f-menstrual-field .yesno-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      DRAFT.menstrualCycle = btn.dataset.menstrual === 'yes';
      renderEntryForm();
    });
  });
  document.querySelectorAll('.fast-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      DRAFT.ekadashiFast = btn.dataset.fast;
      renderEntryForm();
    });
  });
  document.getElementById('f-notes').addEventListener('input', (e) => DRAFT.generalNotes = e.target.value);

  wireSmileyButtons(document);
  wireKriyaActivateButtons(document);

  document.querySelectorAll('.session-tab-label').forEach(el => {
    el.addEventListener('click', () => {
      activeSession = el.dataset.session;
      renderEntryForm();
    });
  });
  document.querySelectorAll('.session-shower-row .yesno-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      DRAFT.showeredBeforeAsanas[btn.dataset.showeredSession] = btn.dataset.showered === 'yes';
      renderEntryForm();
    });
  });

  document.getElementById('reset-asanas-btn').addEventListener('click', () => {
    const sessionLabel = activeSession === 'morning' ? 'Morning' : 'Evening';
    if (Object.keys(DRAFT.asanaRatings[activeSession]).length === 0) return;
    if (confirm(`Reset all of today's ${sessionLabel} Session yogasana ratings? This can't be undone.`)) {
      DRAFT.asanaRatings[activeSession] = {};
      renderEntryForm();
    }
  });

  document.getElementById('reset-kriya-sadhana-btn').addEventListener('click', () => {
    if (Object.keys(DRAFT.kriyaSadhana).length === 0) return;
    if (confirm("Reset all of today's Kriyas and Sadhanas responses? This can't be undone.")) {
      DRAFT.kriyaSadhana = {};
      renderEntryForm();
    }
  });

  document.getElementById('save-entry-btn').addEventListener('click', saveEntry);
}

// Immediate (no browser-default delay) hover tooltip, reusing the same
// tooltip element the Insights charts use. Shared by the asana rating tiles
// (4 smileys) and the Kriyas/Sadhanas tiles (tick/cross) - both render a
// `.smiley-btn` row, differing only in which tile wrapper they're in.
function wireSmileyButtons(root) {
  root.querySelectorAll('.smiley-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Kriya/Sadhana tiles also carry the .pose-tile class (style reuse), so
      // check the more specific selector first.
      const kriyaTile = btn.closest('.kriya-sadhana-tile');
      if (kriyaTile) {
        DRAFT.kriyaSadhana[kriyaTile.dataset.kriyaKey] = btn.dataset.value === 'yes';
        refreshKriyaSadhanaTile(kriyaTile.dataset.kriyaKey);
        return;
      }
      const poseTile = btn.closest('.pose-tile');
      if (poseTile) {
        DRAFT.asanaRatings[activeSession][poseTile.dataset.poseKey] = parseInt(btn.dataset.value, 10);
        refreshPoseTile(poseTile.dataset.poseKey);
      }
    });
    btn.addEventListener('mouseenter', (e) => {
      // Pose tiles (the 24 Yogasana boxes): anchor below that tile's icon,
      // not the cursor, so the tooltip lands in the same spot regardless of
      // which of the 4 smileys is hovered. Kriya/Sadhana tiles keep the
      // cursor-following behavior.
      const poseTile = btn.closest('.pose-tile:not(.kriya-sadhana-tile)');
      if (poseTile) {
        const icon = poseTile.querySelector('svg');
        showTipBelowElement(icon || poseTile, btn.dataset.label);
      } else {
        showTip(e, btn.dataset.label);
      }
    });
    btn.addEventListener('mouseleave', hideTip);
  });
}

// Each session box is its own tab (click the label to switch which pose grid
// shows) AND carries its own "Showered before Asanas?" answer, so both
// Morning's and Evening's answers are visible and editable at the same time,
// not just whichever session is currently active.
function renderSessionTab(session, title) {
  const isActive = activeSession === session;
  const showered = DRAFT.showeredBeforeAsanas[session];
  return `
    <div class="session-tab ${isActive ? 'active' : ''}">
      <div class="session-tab-label" data-session="${session}">${title}</div>
      <div class="session-shower-row" data-session="${session}">
        <span class="session-shower-label">Showered before Asanas? <span class="required-mark">*</span></span>
        <div class="yesno-row">
          <button type="button" class="yesno-btn ${showered === true ? 'selected' : ''}" data-showered-session="${session}" data-showered="yes">Yes</button>
          <button type="button" class="yesno-btn ${showered === false ? 'selected' : ''}" data-showered-session="${session}" data-showered="no">No</button>
        </div>
      </div>
    </div>`;
}

function renderPoseTile(asana) {
  const selected = DRAFT.asanaRatings[activeSession][asana.key];
  return `
    <div class="pose-tile ${selected ? 'rated' : ''}" data-pose-key="${asana.key}">
      ${ICONS[asana.icon]}
      <div class="pose-name">${asana.name}</div>
      <div class="smiley-row">
        ${RATING_SCALE.map(r => `
          <button type="button" data-value="${r.value}" data-label="${r.label}" class="smiley-btn ${selected === r.value ? 'selected' : ''}" aria-label="${r.label}">
            ${SMILEY_ICONS[r.value]}
          </button>`).join('')}
      </div>
    </div>`;
}

function refreshPoseTile(key) {
  const asana = ASANAS.find(a => a.key === key);
  const tile = document.querySelector(`.pose-tile[data-pose-key="${key}"]`);
  tile.outerHTML = renderPoseTile(asana);
  wireSmileyButtons(document.querySelector(`.pose-tile[data-pose-key="${key}"]`));
}

function renderKriyaSadhanaTile(item) {
  if (!isKriyaActivated(item.key)) {
    return `
      <div class="pose-tile kriya-sadhana-tile locked" data-kriya-key="${item.key}">
        ${ICONS[item.icon]}
        <div class="pose-name">${item.name}</div>
        <div class="kriya-lock-panel">
          <p class="kriya-lock-text">If you have been initiated into this practice, please activate here.</p>
          <button type="button" class="action-btn kriya-activate-btn" data-activate-key="${item.key}">Activate</button>
        </div>
      </div>`;
  }
  const selected = DRAFT.kriyaSadhana[item.key]; // true, false, or undefined
  const answered = selected !== undefined;
  return `
    <div class="pose-tile kriya-sadhana-tile ${answered ? 'rated' : ''}" data-kriya-key="${item.key}">
      ${ICONS[item.icon]}
      <div class="pose-name">${item.name}</div>
      <div class="kriya-sadhana-desc">${item.description}</div>
      <div class="smiley-row">
        <button type="button" data-value="yes" data-label="Done" class="smiley-btn ${selected === true ? 'selected' : ''}" aria-label="Done">${RESPONSE_ICONS.yes}</button>
        <button type="button" data-value="no" data-label="Not done" class="smiley-btn ${selected === false ? 'selected' : ''}" aria-label="Not done">${RESPONSE_ICONS.no}</button>
      </div>
    </div>`;
}

function refreshKriyaSadhanaTile(key) {
  const item = KRIYA_SADHANA_ITEMS.find(i => i.key === key);
  const tile = document.querySelector(`.kriya-sadhana-tile[data-kriya-key="${key}"]`);
  tile.outerHTML = renderKriyaSadhanaTile(item);
  const refreshed = document.querySelector(`.kriya-sadhana-tile[data-kriya-key="${key}"]`);
  wireSmileyButtons(refreshed);
  wireKriyaActivateButtons(refreshed);
}

function wireKriyaActivateButtons(root) {
  root.querySelectorAll('.kriya-activate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activateKriya(btn.dataset.activateKey);
      refreshKriyaSadhanaTile(btn.dataset.activateKey);
    });
  });
}

function saveEntry() {
  if (DRAFT.sex === 'female' && DRAFT.menstrualCycle === null) {
    alert('Please answer "Currently in menstrual cycle?" before saving.');
    document.getElementById('f-menstrual-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  // Showered before Asanas? is mandatory for both sessions, regardless of
  // whether that session's asanas were actually rated.
  const missingShower = DRAFT.showeredBeforeAsanas.morning === null ? 'morning'
    : DRAFT.showeredBeforeAsanas.evening === null ? 'evening' : null;
  if (missingShower) {
    alert('Please answer "Showered before Asanas?" for both Morning and Evening before saving.');
    const row = document.querySelector(`.session-shower-row[data-session="${missingShower}"]`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  // A session with zero ratings just wasn't attempted (fine - sessions are
  // optional); one with SOME but not all 24 is what counts as "missing some".
  const sessionPartial = (ratings) => {
    const n = Object.keys(ratings).length;
    return n > 0 && n < ASANAS.length;
  };
  const missingSomeAsanas = sessionPartial(DRAFT.asanaRatings.morning) || sessionPartial(DRAFT.asanaRatings.evening);
  // Locked (not-yet-activated) kriyas have no way to answer them, so only
  // count activated items toward "did you answer everything?".
  const activatedKriyaCount = KRIYA_SADHANA_ITEMS.filter(i => isKriyaActivated(i.key)).length;
  const missingSomeKriyas = Object.keys(DRAFT.kriyaSadhana).length < activatedKriyaCount;
  if (missingSomeAsanas || missingSomeKriyas) {
    if (!confirm('You have not marked some of the Yoga asanas or Kriyas and Sadhanas. Are you ok to Save?')) return;
  }
  // No time field in the form anymore - capture the actual moment of saving
  // as the practice time when logging today (used by the time-of-day insight).
  if (SELECTED_DATE === todayStr()) DRAFT.practiceTime = nowTimeStr();
  Storage.saveEntry(CURRENT_USER.email, SELECTED_DATE, DRAFT);
  showToast(`Saved ${SELECTED_DATE}. Insights updated.`);
  // The save already persisted DRAFT to Storage, so it's safe to blank the
  // in-memory form now - returning to Daily Entry starts fresh instead of
  // showing what was just submitted. Reopening this same date via the date
  // picker still reloads the real saved entry, through loadDraftForDate.
  DRAFT = blankEntry(SELECTED_DATE);
  switchTab('insights');
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ---------- Insights tab ----------
function renderInsightsTab() {
  const entries = Storage.getAllEntries(CURRENT_USER.email);
  const stats = computeStats(entries);
  const root = document.getElementById('insights-root');

  if (stats.totalDaysLogged === 0) {
    root.innerHTML = `<div class="card"><div class="empty-state">No entries yet. Log today's practice to start building insights.</div></div>`;
    return;
  }

  // A continuous calendar range (not just the days that happen to have an
  // entry), so renderTrendChart can show a grey/zero marker for any gap day
  // within the window instead of silently skipping straight over it.
  const allDates = sortedDates(entries);
  const startedOn = allDates.length ? formatFullDate(allDates[0]) : '-';

  const thisMonday = mondayOf(todayStr());
  const currentWeekFull = weekRange(thisMonday); // Mon-Sun, for the heading label
  const currentWeekProgressive = { start: thisMonday, end: todayStr() }; // Mon-today, for the actual data
  const lastRange = weekRange(addDays(thisMonday, -7));
  const currentMsg = generateCurrentWeekMessage(entries, currentWeekProgressive, lastRange);
  const lastMsg = generateKeyMessage(entries, lastRange, 'last week');

  root.innerHTML = `
    <h2 class="insight-page-title">My Daily Well-being Insight</h2>
    <nav class="insight-nav">
      <a class="insight-nav-item" href="#insight-statistics">${INSIGHT_NAV_ICONS.statistics}<span>Statistics</span></a>
      <a class="insight-nav-item" href="#insight-key-messages">${INSIGHT_NAV_ICONS.messages}<span>Key Messages</span></a>
      <a class="insight-nav-item" href="#insight-trend">${INSIGHT_NAV_ICONS.trend}<span>30 Day Trend</span></a>
      <a class="insight-nav-item" href="#insight-shaping">${INSIGHT_NAV_ICONS.factors}<span>Factors shaping my Practice</span></a>
      <a class="insight-nav-item" href="#insight-mini-charts">${INSIGHT_NAV_ICONS.asana}<span>My Asana progress - 7 days</span></a>
    </nav>

    <div id="insight-statistics" class="stat-row">
      <div class="stat-tile"><div class="stat-value">${stats.todayScore !== null ? stats.todayScore.toFixed(1) + '/4' : '-'}</div><div class="stat-label">Today's avg</div></div>
      <div class="stat-tile"><div class="stat-value">${stats.avg7 !== null ? stats.avg7.toFixed(1) + '/4' : '-'}</div><div class="stat-label">7-day avg</div></div>
      <div class="stat-tile"><div class="stat-value">${stats.avg30 !== null ? stats.avg30.toFixed(1) + '/4' : '-'}</div><div class="stat-label">30-day avg</div></div>
      <div class="stat-tile"><div class="stat-value">${stats.streak}</div><div class="stat-label">Day streak</div></div>
      <div class="stat-tile stat-tile-summary">
        <div class="stat-summary-line"><span class="stat-summary-label">Started on</span><span class="stat-summary-value">${startedOn}</span></div>
        <div class="stat-summary-line"><span class="stat-summary-label">Days recorded</span><span class="stat-summary-value">${stats.totalDaysLogged}</span></div>
      </div>
    </div>
    <p class="stat-row-note">The above number indicates your overall Yoga Asana score. 1 - Low, 4 - High</p>

    <div id="insight-key-messages" class="week-message-grid">
      <div class="key-message-card">
        <h2 class="key-message-title">Current Week's Key Message</h2>
        <p class="key-message-range">(Mon, ${formatDDMMM(currentWeekFull.start)} - Sun, ${formatDDMMM(currentWeekFull.end)})</p>
        <p class="key-message-finding">${currentMsg.finding}</p>
        ${currentMsg.improvement ? `<p class="key-message-improvement">${currentMsg.improvement}</p>` : ''}
        ${currentMsg.advice ? `<p class="key-message-advice">${currentMsg.advice}</p>` : ''}
      </div>

      <div class="key-message-card">
        <h2 class="key-message-title">Last Week's Key Message</h2>
        <p class="key-message-range">(Mon, ${formatDDMMM(lastRange.start)} - Sun, ${formatDDMMM(lastRange.end)})</p>
        <p class="key-message-finding">${lastMsg.finding}</p>
        ${lastMsg.improvement ? `<p class="key-message-improvement">${lastMsg.improvement}</p>` : ''}
      </div>
    </div>

    <div id="insight-trend" class="card">
      <div class="trend-header">
        <h2 class="trend-title">30-Day Overall Yoga Asanas Trend</h2>
        <span id="trend-arrow" class="trend-arrow"></span>
      </div>
      <div id="trend-chart"></div>
      <div id="trend-legend" class="legend-row"></div>
      <p class="insight-sub">Score is the equal-weighted average across all rated asanas that day (0 = No data available, 1 = Very difficult ... 4 = Pleasure). Hover a point for that day's top high and low performed asanas.</p>
    </div>

    <div id="insight-shaping" class="card">
      <h2 class="shaping-title">What's shaping your practice</h2>
      <div id="shaping-grid" class="factor-grid"></div>
    </div>

    <div id="insight-mini-charts" class="card">
      <h2 class="trend-title">My Asana Progress — Last 7 Days</h2>
      <div id="mini-chart-tabs" class="mini-chart-tabs"></div>
      <div id="mini-chart-grid" class="mini-chart-grid"></div>
    </div>
  `;
  const trendStart = stats.last30Dates.length ? stats.last30Dates[0] : allDates[0];
  const trendDates = [];
  if (trendStart) {
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let d = trendStart; d <= todayStr; d = addDays(d, 1)) trendDates.push(d);
  }
  renderTrendChart(
    document.getElementById('trend-chart'), entries, trendDates,
    document.getElementById('trend-legend'), document.getElementById('trend-arrow')
  );
  renderShapingSection(document.getElementById('shaping-grid'), entries, isKriyaActivated);
  renderMiniAsanaCharts(document.getElementById('mini-chart-tabs'), document.getElementById('mini-chart-grid'), entries);
}

// ---------- Settings tab ----------
function renderSettingsTab() {
  const settings = Storage.getSettings(CURRENT_USER.email);
  const root = document.getElementById('settings-root');
  root.innerHTML = `
    <div class="card">
      <h2>Daily reminder</h2>
      <div class="settings-row">
        <label for="reminder-time">Remind me at</label>
        <input type="time" id="reminder-time" value="${settings.reminderTime}">
        <label style="display:flex;align-items:center;gap:6px;">
          <input type="checkbox" id="reminder-enabled" ${settings.reminderEnabled ? 'checked' : ''}>
          Enable while this tab is open
        </label>
      </div>
      <p class="insight-sub">Browser reminders only fire while this tab is open. For a reminder that works even when it's closed, download a daily calendar alert instead:</p>
      <button class="secondary-btn" id="ics-btn">Download calendar reminder (.ics)</button>
    </div>

    <div class="card">
      <h2>Demo data</h2>
      <p class="insight-sub">Populate the last 30 days with randomized sample entries so Insights has something to show.</p>
      <button class="secondary-btn" id="seed-btn">Load 30 days of sample data</button>
    </div>

    <div class="card">
      <h2>Import from CSV</h2>
      <p class="insight-sub">Load entries in bulk from a CSV file in this app's export format (see <code>sample-data/last-30-days-sample.csv</code>). Matching dates already in your log will be overwritten.</p>
      <div class="settings-row">
        <input type="file" id="csv-file-input" accept=".csv,text/csv">
        <button class="secondary-btn" id="import-csv-btn">Import CSV</button>
      </div>
      <p id="csv-import-status" class="insight-sub"></p>
    </div>

    <div class="card">
      <h2>Your data</h2>
      <p class="insight-sub">Signed in as ${CURRENT_USER.email}. Only your name and email are stored, on this device.</p>
      <button class="secondary-btn" id="clear-btn">Clear all my entries</button>
    </div>
  `;

  document.getElementById('reminder-time').addEventListener('change', (e) => {
    const s = Storage.getSettings(CURRENT_USER.email);
    s.reminderTime = e.target.value;
    Storage.saveSettings(CURRENT_USER.email, s);
  });
  document.getElementById('reminder-enabled').addEventListener('change', (e) => {
    const s = Storage.getSettings(CURRENT_USER.email);
    s.reminderEnabled = e.target.checked;
    Storage.saveSettings(CURRENT_USER.email, s);
    if (e.target.checked && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  });
  document.getElementById('ics-btn').addEventListener('click', downloadIcsReminder);
  document.getElementById('seed-btn').addEventListener('click', () => {
    if (confirm('This adds/overwrites the last 30 days of entries for your account with sample data. Continue?')) {
      loadSeedData(CURRENT_USER.email);
      loadDraftForDate(SELECTED_DATE);
      renderEntryForm();
      showToast('Sample data loaded.');
      switchTab('insights');
    }
  });
  document.getElementById('import-csv-btn').addEventListener('click', importCsvFile);
  document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('This permanently deletes all your logged entries on this device. Continue?')) {
      localStorage.removeItem(Storage._entriesKey(CURRENT_USER.email));
      loadDraftForDate(SELECTED_DATE);
      renderEntryForm();
      showToast('All entries cleared.');
    }
  });
}

function importCsvFile() {
  const input = document.getElementById('csv-file-input');
  const status = document.getElementById('csv-import-status');
  const file = input.files && input.files[0];
  if (!file) { status.textContent = 'Choose a .csv file first.'; return; }

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = csvToEntries(reader.result);
    } catch (e) {
      status.textContent = 'Could not import: ' + e.message;
      return;
    }
    const dates = Object.keys(parsed.entries);
    if (!dates.length) {
      status.textContent = 'No valid dated rows found in that file.';
      return;
    }
    const msg = `Import ${dates.length} day(s) (${dates[0]} to ${dates[dates.length - 1]})`
      + (parsed.skipped.length ? `, skipping ${parsed.skipped.length} row(s) with an unrecognized date` : '')
      + '? Matching dates already logged will be overwritten.';
    if (!confirm(msg)) return;

    const existing = Storage.getAllEntries(CURRENT_USER.email);
    const merged = { ...existing, ...parsed.entries };
    localStorage.setItem(Storage._entriesKey(CURRENT_USER.email), JSON.stringify(merged));

    loadDraftForDate(SELECTED_DATE);
    renderEntryForm();
    status.textContent = `Imported ${dates.length} day(s).`;
    showToast(`Imported ${dates.length} day(s) from CSV.`);
    switchTab('insights');
  };
  reader.readAsText(file);
}

function downloadIcsReminder() {
  const settings = Storage.getSettings(CURRENT_USER.email);
  const [hh, mm] = settings.reminderTime.split(':');
  const now = new Date();
  const dtStart = `${now.toISOString().slice(0, 10).replace(/-/g, '')}T${hh}${mm}00`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Yoga Sadhana Tracker//EN',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:Log today\'s yoga sadhana',
    'DESCRIPTION:Reminder to record today\'s yogasana practice in the Yoga Sadhana Tracker.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Log today\'s yoga sadhana', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'yoga-sadhana-reminder.ics';
  a.click();
}

function startReminderLoop() {
  setInterval(() => {
    const settings = Storage.getSettings(CURRENT_USER.email);
    if (!settings.reminderEnabled) return;
    const now = new Date();
    const current = now.toTimeString().slice(0, 5);
    if (current !== settings.reminderTime) return;
    if (settings.lastNotifiedDate === todayStr()) return;
    settings.lastNotifiedDate = todayStr();
    Storage.saveSettings(CURRENT_USER.email, settings);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Yoga Sadhana Tracker', { body: "Time to log today's practice." });
    } else {
      showToast("Reminder: log today's practice.");
    }
  }, 20000);
}

window.addEventListener('DOMContentLoaded', init);
