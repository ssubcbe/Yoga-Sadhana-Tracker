// Generates randomized-but-plausible demo data for the last 30 days, with a
// few mild built-in patterns (morning practice scores slightly higher, full/new
// moon days slightly harder) purely so the Insights tab has something to show
// in a demo. These are synthetic patterns for demonstration, not a claim about
// real yogic effects.
function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clampScore(v) { return Math.max(1, Math.min(4, Math.round(v))); }

function generateSeedEntries(days = 30) {
  const entries = {};
  const today = new Date().toISOString().slice(0, 10);
  const times = ['05:30', '06:00', '06:30', '07:00', '17:30', '18:30', '20:00'];
  const meals = MEAL_STATUS_OPTIONS.map(o => o.value);
  const fasts = ['none', 'none', 'none', 'half-day', 'full-day'];
  const notes = ['', '', '', 'Felt low energy today.', 'Great focus this session.', 'Body felt stiff.', 'Very calm practice.'];
  const demoSex = Math.random() < 0.4 ? 'female' : (Math.random() < 0.5 ? 'male' : 'prefer-not-to-say');

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const practiceTime = randChoice(times);
    const bucket = timeBucket(practiceTime);
    const moon = getMoonPhase(date).key;
    const mealStatus = randChoice(meals);
    const fasting = randChoice(fasts);
    const menstrualCycle = demoSex === 'female' ? Math.random() < 0.25 : false;

    const kriyaSadhana = {};
    KRIYA_SADHANA_ITEMS.forEach(item => { kriyaSadhana[item.key] = Math.random() > 0.4; });
    const balancingDone = kriyaSadhana['suka-kriya-aum'];

    let base = 2.2 + (days - i) * (1.0 / days); // gentle upward trend over the month
    if (bucket === 'Morning') base += 0.4;
    if (moon === 'full' || moon === 'new') base -= 0.3;
    if (fasting === 'half-day') base += 0.15;
    if (balancingDone) base += 0.2;
    if (menstrualCycle) base -= 0.2;

    // Morning is logged most days; an evening session is optional, shown on
    // roughly half the days to demonstrate the twice-a-day feature.
    const morningRatings = {};
    ASANAS.forEach(a => { morningRatings[a.key] = clampScore(base + (Math.random() - 0.5) * 1.4); });
    const eveningRatings = {};
    if (Math.random() > 0.5) {
      ASANAS.forEach(a => { eveningRatings[a.key] = clampScore(base + (Math.random() - 0.5) * 1.4 + 0.1); });
    }
    const asanaRatings = { morning: morningRatings, evening: eveningRatings };

    entries[date] = {
      date,
      practiceTime,
      generalNotes: randChoice(notes),
      mealStatus,
      mealTime: randChoice(times),
      fasting,
      sex: demoSex,
      menstrualCycle,
      kriyaSadhana,
      asanaRatings,
      seeded: true,
    };
  }
  return entries;
}

function loadSeedData(userId) {
  const generated = generateSeedEntries(30);
  const existing = Storage.getAllEntries(userId);
  const merged = { ...existing, ...generated };
  localStorage.setItem(Storage._entriesKey(userId), JSON.stringify(merged));
}
