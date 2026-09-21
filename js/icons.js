// Simple, license-free black-line SVG icons, hand-constructed here (not sourced
// from any external image), one consistent style so the pose gallery looks unified.
// Each is a minimal stick-figure sketch that suggests the pose family, not an
// anatomically exact rendering of every asana.
const ICON_STYLE = 'fill="none" stroke="#464038" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  standingForwardBend: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="50" cy="18" r="8" fill="#464038" stroke="none"/><path d="M50 26 L50 55 M50 55 L30 85 M50 55 L70 85 M50 32 L20 55 M50 32 L80 55"/></svg>`,

  standingTriangle: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="62" cy="16" r="8" fill="#464038" stroke="none"/><path d="M62 24 L38 70 M38 70 L20 90 M38 70 L58 90 M62 24 L85 40 M62 30 L35 40"/></svg>`,

  standingTree: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="50" cy="14" r="8" fill="#464038" stroke="none"/><path d="M50 22 L50 65 M50 65 L45 92 M50 40 L28 20 M50 40 L72 55 M50 55 L65 55"/></svg>`,

  proneBackbend: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="22" cy="55" r="8" fill="#464038" stroke="none"/><path d="M28 52 Q50 20 78 45 M28 58 L15 78 M78 45 L88 30 M45 40 L60 30"/></svg>`,

  boatPose: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="30" cy="55" r="8" fill="#464038" stroke="none"/><path d="M36 55 Q55 75 30 88 M36 50 Q60 30 85 45"/></svg>`,

  seatedForwardBend: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="80" cy="30" r="8" fill="#464038" stroke="none"/><path d="M76 36 Q45 55 20 60 M76 36 Q60 60 22 62 M20 60 L20 40 M22 62 L20 78"/></svg>`,

  seatedTwist: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="50" cy="18" r="8" fill="#464038" stroke="none"/><path d="M50 26 L50 55 M50 55 L30 90 M50 55 L70 90 M50 34 L78 24 M50 40 L25 30"/></svg>`,

  invertedShoulder: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="30" cy="82" r="8" fill="#464038" stroke="none"/><path d="M30 74 L35 45 M35 45 L35 15 M35 45 L60 45 M35 45 L15 45"/></svg>`,

  seatedMeditation: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="50" cy="20" r="8" fill="#464038" stroke="none"/><path d="M50 28 L50 55 M50 55 L25 70 M50 55 L75 70 M25 70 L75 70 M50 40 L32 48 M50 40 L68 48"/></svg>`,

  energyFlow: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="50" cy="16" r="8" fill="#464038" stroke="none"/><path d="M50 24 L50 60 M50 34 L28 46 M50 34 L72 46 M50 60 L32 88 M50 60 L68 88"/><path d="M14 50 Q50 30 86 50" stroke-dasharray="3 6"/></svg>`,

  balanceScale: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><path d="M50 12 L50 88 M20 88 L80 88 M20 24 L80 24 M20 24 L10 46 M20 24 L30 46 M80 24 L70 46 M80 24 L90 46"/><path d="M10 46 A10 8 0 0 0 30 46 M70 46 A10 8 0 0 0 90 46"/></svg>`,

  nadiVibhajan: `<svg viewBox="0 0 100 100" ${ICON_STYLE}><circle cx="50" cy="16" r="8" fill="#464038" stroke="none"/><path d="M50 24 L50 58 M50 32 L26 44 M50 32 L74 44 M50 58 L34 86 M50 58 L66 86 M50 8 L50 0" /><circle cx="50" cy="50" r="34" stroke-dasharray="2 6"/></svg>`,
};

// One small ascending-bars glyph, reused identically on every one of the 24
// mini asana charts (not a per-pose icon) purely to mark that card as "a
// trend over time", in the same hand-drawn line style as the rest.
const MINI_CHART_ICON = `<svg viewBox="0 0 100 100" ${ICON_STYLE} width="14" height="14"><path d="M12 88 L88 88"/><path d="M28 88 L28 62"/><path d="M50 88 L50 46"/><path d="M72 88 L72 24"/><circle cx="72" cy="24" r="7" fill="#464038" stroke="none"/></svg>`;

// Simple moon-phase glyphs: a dark disc with a light "lens" overlay offset
// horizontally, clipped to the disc. Not an astronomically exact terminator
// (that needs an ellipse-arc path), but a recognizable, consistent 8-phase
// strip built with plain shapes, per phase key from MOON_PHASES.
let _moonIconSeq = 0;
const MOON_ICON_OFFSET = {
  'new': 34, 'waxing-crescent': 26, 'first-quarter': 17, 'waxing-gibbous': 8,
  'full': 0, 'waning-gibbous': -8, 'last-quarter': -17, 'waning-crescent': -26,
};
function moonIconSVG(phaseKey, size) {
  size = size || 32;
  const id = 'moon-clip-' + (_moonIconSeq++);
  const dx = MOON_ICON_OFFSET[phaseKey] != null ? MOON_ICON_OFFSET[phaseKey] : 34;
  const r = 16, c = 18;
  return `<svg viewBox="0 0 36 36" width="${size}" height="${size}">
    <defs><clipPath id="${id}"><circle cx="${c}" cy="${c}" r="${r}"/></clipPath></defs>
    <circle cx="${c}" cy="${c}" r="${r}" fill="#464038"/>
    <g clip-path="url(#${id})"><circle cx="${c + dx}" cy="${c}" r="${r}" fill="#F7F2EA"/></g>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#464038" stroke-width="1.5"/>
  </svg>`;
}

// Rating smileys - hand-built (not sourced from any image) so there's no
// licensing question, in the same four-color, white-features-on-a-solid-disc
// style as a typical feedback-rating widget. Transparent outside the circle
// since it's plain SVG with no background rect. Keyed by RATING_SCALE value.
const SMILEY_ICONS = {
  1: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#E5352B"/>
    <path d="M9 14 L16 17" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <path d="M31 14 L24 17" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <circle cx="14" cy="21" r="2" fill="#fff"/><circle cx="26" cy="21" r="2" fill="#fff"/>
    <path d="M12 30 Q20 23 28 30" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`,
  2: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#F5900E"/>
    <path d="M9 15 L16 17" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <path d="M31 15 L24 17" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <circle cx="14" cy="21" r="2" fill="#fff"/><circle cx="26" cy="21" r="2" fill="#fff"/>
    <path d="M13 28 Q20 24 27 28" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`,
  3: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#2F8FE0"/>
    <circle cx="14" cy="18" r="2" fill="#fff"/><circle cx="26" cy="18" r="2" fill="#fff"/>
    <path d="M12 24 Q20 31 28 24" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`,
  4: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#4CAF50"/>
    <path d="M10 18 Q14 14 18 18" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M22 18 Q26 14 30 18" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M10 23 Q20 33 30 23" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </svg>`,
};

// Done / not-done response icons for the Kriyas and Sadhanas panel - same
// solid-disc-with-white-glyph style and color language as the smileys above.
const RESPONSE_ICONS = {
  yes: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#4CAF50"/>
    <path d="M11 20 L17 26 L29 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  no: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#E5352B"/>
    <path d="M13 13 L27 27 M27 13 L13 27" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`,
};

// Simple line-art avatar silhouettes for the sex picker - hand-built (not
// sourced from any image), so there's no licensing question. Same head +
// shoulders base for all three; hair is clipped to the head circle (same
// trick as the moon-phase icons above) so its edges are always clean,
// with female hair adding two rounded side panels down to shoulder length.
let _avatarIconSeq = 0;
const AVATAR_HAIR = {
  male: (color, clipId) => `<g clip-path="url(#${clipId})"><rect x="30" y="15" width="40" height="16" fill="${color}"/></g>`,
  female: (color, clipId) => `
    <g clip-path="url(#${clipId})"><rect x="28" y="11" width="44" height="20" fill="${color}"/></g>
    <rect x="26" y="27" width="11" height="35" rx="5.5" fill="${color}"/>
    <rect x="63" y="27" width="11" height="35" rx="5.5" fill="${color}"/>`,
  'prefer-not-to-say': () => '',
};
function avatarSVG(kind, color, size) {
  size = size || 60;
  const clipId = 'avatar-head-clip-' + (_avatarIconSeq++);
  const hair = (AVATAR_HAIR[kind] || AVATAR_HAIR['prefer-not-to-say'])(color, clipId);
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <defs><clipPath id="${clipId}"><circle cx="50" cy="36" r="17"/></clipPath></defs>
    <path d="M18 92 C18 66 31 56 50 56 C69 56 82 66 82 92"/>
    <circle cx="50" cy="36" r="17"/>
    ${hair}
  </svg>`;
}
