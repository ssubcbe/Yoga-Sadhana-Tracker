// Minimal CSV parser (handles quoted fields with embedded commas/quotes) plus
// the mapping back from this app's exported CSV format into entry objects.
// Moon phase is never read from the CSV - it's always recomputed from the
// date, same as everywhere else in the app, so it can't drift out of sync.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip, \n handles the line break */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function csvToEntries(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { entries: {}, skipped: [] };
  const headers = rows[0];
  const idx = (name) => headers.indexOf(name);
  if (idx('Date') === -1) {
    throw new Error('This file does not look like a Yoga Sadhana Tracker export - no "Date" column found.');
  }

  const mealByLabel = {}; MEAL_STATUS_OPTIONS.forEach(o => mealByLabel[o.label] = o.value);
  const fastByLabel = {}; FASTING_OPTIONS.forEach(o => fastByLabel[o.label] = o.value);
  const ekadashiFastByLabel = {}; EKADASHI_FAST_OPTIONS.forEach(o => ekadashiFastByLabel[o.label] = o.value);
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  const entries = {};
  const skipped = [];
  rows.slice(1).forEach((cols) => {
    const date = (cols[idx('Date')] || '').trim();
    if (!dateRe.test(date)) { if (date) skipped.push(date); return; }

    const kriyaSadhana = {};
    KRIYA_SADHANA_ITEMS.forEach(item => {
      const col = idx(item.name + ' Done');
      if (col > -1 && cols[col]) kriyaSadhana[item.key] = (cols[col] || '').trim().toLowerCase() === 'yes';
    });

    // Accepts explicit "(Morning)"/"(Evening)" columns if present; otherwise
    // treats a plain asana-name column as the Morning session, for backward
    // compatibility with CSVs exported before Morning/Evening sessions existed.
    const asanaRatings = { morning: {}, evening: {} };
    ASANAS.forEach(a => {
      const morningCol = idx(a.name + ' (Morning)') > -1 ? idx(a.name + ' (Morning)') : idx(a.name);
      const eveningCol = idx(a.name + ' (Evening)');
      const mv = morningCol > -1 ? parseInt(cols[morningCol], 10) : NaN;
      const ev = eveningCol > -1 ? parseInt(cols[eveningCol], 10) : NaN;
      if (!isNaN(mv) && mv >= 1 && mv <= 4) asanaRatings.morning[a.key] = mv;
      if (!isNaN(ev) && ev >= 1 && ev <= 4) asanaRatings.evening[a.key] = ev;
    });

    const mealLabel = idx('Meal Status') > -1 ? cols[idx('Meal Status')] : '';
    const fastLabel = idx('Recent Fasting') > -1 ? cols[idx('Recent Fasting')] : '';
    const ekadashiFastLabel = idx('Ekadashi Fast') > -1 ? cols[idx('Ekadashi Fast')] : '';
    const ekadashiFast = ekadashiFastByLabel[ekadashiFastLabel] || 'none';
    const sexLabel = (idx('Sex') > -1 && (cols[idx('Sex')] || '').trim().toLowerCase()) || '';
    const sex = (SEX_OPTIONS.find(o => o.label.toLowerCase() === sexLabel || o.value === sexLabel) || SEX_OPTIONS[0]).value;
    const menstrualCol = idx('Menstrual Cycle');
    const menstrualCycle = menstrualCol > -1 && (cols[menstrualCol] || '').trim().toLowerCase() === 'yes';

    // Yes/No/blank per session, same "null = unanswered" convention as the
    // live form (see showeredBeforeAsanas in js/app.js) rather than defaulting
    // an absent column to a false "No".
    const showerVal = (colName) => {
      const col = idx(colName);
      if (col === -1 || !cols[col]) return null;
      return cols[col].trim().toLowerCase() === 'yes';
    };
    const showeredBeforeAsanas = {
      morning: showerVal('Showered Before Asanas (Morning)'),
      evening: showerVal('Showered Before Asanas (Evening)'),
    };

    entries[date] = {
      date,
      practiceTime: (idx('Time of Practice') > -1 && cols[idx('Time of Practice')]) || '06:00',
      generalNotes: (idx('General Notes') > -1 && cols[idx('General Notes')]) || '',
      mealStatus: mealByLabel[mealLabel] || MEAL_STATUS_OPTIONS[0].value,
      mealTime: (idx('Time of Last Meal') > -1 && cols[idx('Time of Last Meal')]) || '',
      fasting: fastByLabel[fastLabel] || 'none',
      ekadashiFast,
      sex,
      menstrualCycle,
      kriyaSadhana,
      asanaRatings,
      showeredBeforeAsanas,
      imported: true,
    };
  });

  return { entries, skipped };
}
