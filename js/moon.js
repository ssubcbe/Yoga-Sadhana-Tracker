// Pure-math moon phase lookup - no external API/network call needed.
// Reference new moon: 2000-01-06 18:14 UTC. Synodic month: 29.53058867 days.
const REF_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_MONTH_DAYS = 29.53058867;

const MOON_PHASES = [
  { key: 'new', label: 'New Moon (Amavasya)' },
  { key: 'waxing-crescent', label: 'Waxing Crescent' },
  { key: 'first-quarter', label: 'First Quarter' },
  { key: 'waxing-gibbous', label: 'Waxing Gibbous' },
  { key: 'full', label: 'Full Moon (Pournami)' },
  { key: 'waning-gibbous', label: 'Waning Gibbous' },
  { key: 'last-quarter', label: 'Last Quarter' },
  { key: 'waning-crescent', label: 'Waning Crescent' },
];

// Days elapsed since the reference new moon, folded into one 0..29.53 cycle.
// 0 = new moon, ~14.77 = full moon.
function getLunarDayOffset(dateStr) {
  const target = new Date(dateStr + 'T12:00:00Z').getTime();
  const daysSince = (target - REF_NEW_MOON_MS) / (24 * 60 * 60 * 1000);
  let offset = daysSince % SYNODIC_MONTH_DAYS;
  if (offset < 0) offset += SYNODIC_MONTH_DAYS;
  return offset;
}

function getMoonPhase(dateStr) {
  const fraction = getLunarDayOffset(dateStr) / SYNODIC_MONTH_DAYS;
  const index = Math.floor(fraction * 8 + 0.5) % 8;
  return MOON_PHASES[index];
}

function cyclicDistance(a, b, mod) {
  const d = Math.abs(a - b) % mod;
  return Math.min(d, mod - d);
}

// Ekadashi: approximated as the 11th day after each new moon and each full
// moon (the two Ekadashis of a lunar month, ~twice a month). This is a
// day-count approximation for the prototype, not a tithi-accurate Panchang
// calculation.
function getLunarEvent(dateStr) {
  const offset = getLunarDayOffset(dateStr);
  const half = SYNODIC_MONTH_DAYS / 2;
  // Half-day tolerance: with 1-day-spaced calendar samples, a window this
  // narrow matches at most one calendar day per event (a wider window was
  // matching two consecutive days per cycle and doubling the count).
  return {
    isNewMoon: cyclicDistance(offset, 0, SYNODIC_MONTH_DAYS) < 0.5,
    isFullMoon: cyclicDistance(offset, half, SYNODIC_MONTH_DAYS) < 0.5,
    isEkadashi: cyclicDistance(offset, 11, SYNODIC_MONTH_DAYS) < 0.5
      || cyclicDistance(offset, half + 11, SYNODIC_MONTH_DAYS) < 0.5,
  };
}
