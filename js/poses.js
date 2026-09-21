// Practice data model, adapted from the Sadhanapada Yogasana tracking form.
// Rating scale matches the source form's language exactly.
const RATING_SCALE = [
  { value: 1, label: 'Very difficult' },
  { value: 2, label: 'Difficult' },
  { value: 3, label: 'Easy' },
  { value: 4, label: 'Pleasure' },
];

// icon keys reference ICONS in icons.js. Icons are grouped by pose family
// (standing / prone-backbend / seated-forward / seated-twist / inverted / other)
// rather than one bespoke drawing per asana, to keep the style consistent
// within a 48-hour build. Swap in per-pose art later if desired.
const ASANAS = [
  { key: 'nadi-vibhajan', name: 'Nadi Vibhajan', icon: 'nadiVibhajan', note: 'Warm-up. Aim: steady posture, hold ~15s, forehead to shins.' },
  { key: 'padahastasana', name: 'Padahastasana', icon: 'standingForwardBend' },
  { key: 'konasana', name: 'Konasana', icon: 'standingTriangle' },
  { key: 'trikonasana', name: 'Trikonasana', icon: 'standingTriangle' },
  { key: 'vrikshasana', name: 'Vrikshasana', icon: 'standingTree' },
  { key: 'utthanpadasana', name: 'Ekapada & Dwipada Utthanpadasana', icon: 'boatPose' },
  { key: 'shalabhasana', name: 'Shalabhasana', icon: 'proneBackbend' },
  { key: 'makarasana', name: 'Makarasana', icon: 'proneBackbend' },
  { key: 'naukasana', name: 'Naukasana', icon: 'boatPose' },
  { key: 'bhujangasana', name: 'Bhujangasana', icon: 'proneBackbend' },
  { key: 'dhanurasana', name: 'Dhanurasana', icon: 'proneBackbend' },
  { key: 'paschimottanasana', name: 'Paschimottanasana', icon: 'seatedForwardBend' },
  { key: 'janu-shirasasana', name: 'Janu Shirasasana', icon: 'seatedForwardBend' },
  { key: 'matsyendrasana', name: 'Matsyendrasana', icon: 'seatedTwist' },
  { key: 'sarvangasana', name: 'Sarvangasana (4-step sequence)', icon: 'invertedShoulder' },
  { key: 'ardhamatsyendrasana', name: 'Ardhamatsyasana', icon: 'seatedTwist' },
  { key: 'spinal-twist', name: 'Spinal Twist (3 variations)', icon: 'seatedTwist' },
  { key: 'mandukasana', name: 'Mandukasana', icon: 'seatedForwardBend' },
  { key: 'sushanti', name: 'Sushanti Meditation', icon: 'seatedMeditation' },
  { key: 'patangasana', name: 'Patangasana', icon: 'proneBackbend' },
  { key: 'shishupalasana', name: 'Shishupalasana', icon: 'proneBackbend' },
  { key: 'yoga-mudra', name: 'Yoga Mudra', icon: 'seatedForwardBend' },
  { key: 'lolasana', name: 'Lolasana', icon: 'boatPose' },
  { key: 'uddyana-bandha', name: 'Uddyana Bandha', icon: 'standingForwardBend' },
];

// Replaces the earlier separate Kriyas list + generic Balancing Sadhana
// placeholder checklist with the program's actual defined set of six daily
// practices, each answered with a simple done / not-done response.
const KRIYA_SADHANA_ITEMS = [
  { key: 'bhuta-shuddhi', name: 'Bhuta Shuddhi', icon: 'nadiVibhajan', description: 'Purification and balancing of the five elements within the system' },
  { key: 'surya-kriya', name: 'Surya Kriya', icon: 'energyFlow', description: 'A 21-step classical yogic process oriented toward alignment with the solar cycle' },
  { key: 'shambhavi-mahamudra', name: 'Shambhavi Mahamudra Kriya', icon: 'seatedMeditation', description: 'A 21-minute foundational practice involving body, breath, awareness and energy' },
  { key: 'shakti-chalana-kriya', name: 'Shakti Chalana Kriya', icon: 'energyFlow', description: 'Works with the vital energy / pranic system' },
  { key: 'suka-kriya-aum', name: 'Suka Kriya & AUM Chanting', icon: 'balanceScale', description: 'Balancing Sadhana' },
  { key: 'shoonya-meditation', name: 'Shoonya Meditation', icon: 'seatedMeditation', description: 'Conscious non-doing' },
];

const MEAL_STATUS_OPTIONS = [
  { value: 'before-meal', label: 'Before a meal (empty stomach)' },
  { value: 'after-snack', label: 'After a light snack' },
  { value: 'after-full-meal', label: 'After a full meal' },
];

const FASTING_OPTIONS = [
  { value: 'none', label: 'No recent fast' },
  { value: 'half-day', label: 'Half-day fast' },
  { value: 'full-day', label: 'Full-day fast' },
];

const SEX_OPTIONS = [
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const EKADASHI_FAST_OPTIONS = [
  { value: 'none', label: 'No Fast' },
  { value: 'half', label: 'Half Fast' },
  { value: 'full', label: 'Full Fast' },
];
