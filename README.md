# Yoga Sadhana Tracker

A daily yoga asana tracker with insights across time of day, meal/fasting
status, moon phase, kriyas practiced, and Balancing Sadhana. Built as a
48-hour hackathon prototype.

## Run it right now (Desktop)

No install needed beyond a browser. From this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html` in a browser. (Opening
`index.html` directly by double-clicking also works in most browsers,
since there's no backend to talk to.)

On the sign-in screen, click **Continue with Demo Account** (just a name +
email, no password) to get straight into the app. Then, in the **Settings**
tab, click **Load 30 days of sample data** to instantly populate the
Insights tab with a month of randomized practice history.

## What's implemented

- **Sign-in**: real Google / Microsoft / Apple SSO buttons are wired up
  (Google Identity Services, MSAL.js, Sign in with Apple JS) but need your
  own client IDs to activate - see "Turning on real SSO" below. Until then,
  the demo sign-in exercises the identical session/data path.
- **Daily entry**: a "My Daily Well-being Tracker" panel with date (defaults
  to a "Today" pill; "Choose a date" reveals the calendar) and moon phase
  (computed locally - no external API) on the left, and a one-time sex
  picker (hand-drawn avatar icons, not a dropdown) on the right - pick once
  and it locks (greyed out, with a "Change" escape hatch) rather than
  asking again every day, with a menstrual-cycle Yes/No follow-up under it
  when "Female" is chosen. Below that, a full-width fasting row, labeled
  "Normal fast" on any ordinary day and "**Ekadashi** fast" (bold) on an
  actual Ekadashi day - same three buttons (No/Half/Full Fast) either way,
  so the row's height never changes based on the selected date. Then all
  ~23 yogasanas from the reference form under **Morning Session / Evening
  Session tabs** - the same 24 poses, rated independently for each session
  (defaults to whichever session matches the current time of day), each on
  the source form's 4-smiley scale (Very difficult, Difficult, Easy,
  Pleasure) - with a Reset button that clears only the currently open
  session. Then a "Kriyas and Sadhanas done today" panel (Bhuta Shuddhi,
  Surya Kriya, Shambhavi Mahamudra Kriya, Shakti Chalana Kriya, Suka Kriya
  & AUM Chanting, Shoonya Meditation - each answered with a simple
  done/not-done tick or cross, also with its own Reset).
- **Insights** (the core of the app) - available immediately after saving
  an entry:
  - **Key message** at the very top: a plain-English weekly finding (the
    strongest time-of-day × moon-phase combination in the last 7 days,
    falling back to the single strongest factor, and quoting a general
    note from a matching day when there is one) plus a concrete "focus on
    these asanas" call-out for whichever poses scored lowest that week.
  - Stat tiles: today / 7-day / 30-day average and a day streak.
  - **30-day trend line**, equal-weighted across every rated asana. Hover
    any point for that day's score and top-3 asanas. New Moon, Full Moon
    and Ekadashi days get distinct markers (see "Lunar approximation"
    below) with a legend under the chart.
  - **"What's shaping your practice"**: six always-on charts in a 3x2 grid
    (moon phase, meals, fasting, kriyas/sadhanas done [bucketed by count,
    e.g. "4 of 6 done", to stay readable], balancing sadhana [tied to the
    Suka Kriya & AUM Chanting item specifically], time of day) - no
    dropdown needed. A small 8-icon moon-phase strip sits under the Moon
    Phase chart. A 7th chart (menstrual cycle vs. not) appears
    automatically once any entry has "Female" selected.
  - "More findings": the longer-run (full history) version of the same
    factor-gap analysis.
  - **24 mini bar charts**, one per asana, each showing its own last 7
    days (so you can see exactly which poses are trending up or down this
    week) - at the very bottom of the tab, laid out as a fixed 6x4 grid
    (same fixed card size/background/icon on every card, collapsing to
    fewer columns on narrow screens). An **Overall / Morning / Evening**
    tab switcher sits above the grid: Overall averages that day's Morning
    and Evening rating (or falls back to whichever one exists, if only one
    was logged); Morning and Evening each show only that session's own
    rating. Each bar sits on a thin x-axis baseline and is rounded only at
    its top edge. A day with no data for the selected tab shows as a short
    grey bar ("No data" on hover) - except **today**, which is left blank
    rather than greyed out, since "not logged yet" isn't the same claim as
    "logged nothing." Bar color always matches one of the four rating
    smiley colors exactly (red -> orange -> blue -> green): see the note in
    `js/insights.js` above `ASANA_BAR_RAMP` / `discreteAsanaColor` - an
    earlier version blended between colors for fractional (Morning+Evening
    averaged) scores like 2.5, but every blend tried looked either muddy or
    (with hue interpolation) made a mediocre score momentarily
    indistinguishable from "Pleasure" green. Snapping to the nearest whole
    score avoids that ambiguity entirely; the tooltip still shows the exact
    averaged value.
- **Reminder**: an in-app browser notification while the tab is open, plus
  a downloadable `.ics` daily calendar reminder that works even when the
  browser is closed.
- **Minimum data collected**: just name + email (from whichever sign-in
  method is used) and the practice entries themselves. Everything is stored
  in the browser's `localStorage`, scoped to that email - nothing is sent
  to a server.
- **Pose images**: replaced with a small set of consistent, hand-drawn
  black-line SVG icons (grouped by pose family - standing / prone backbend /
  seated forward bend / seated twist / inverted / balance / meditation)
  rather than photos, so there's no licensing question. See
  `js/icons.js` / `js/poses.js` to swap in per-pose art later.
- **Brand colors**: warm charcoal `#464038` (headings, header background),
  saffron orange `#E8842A` (accents), warm off-white `#F7F2EA` (page
  background). All are CSS variables at the top of `css/styles.css`.
- **Font**: Inter (open, SIL OFL license, loaded from Google Fonts in
  `index.html`/`app.html`), weights 300/400/600 mapped to
  `--weight-light`/`--weight-regular`/`--weight-semibold` in
  `css/styles.css`. Falls back to Segoe UI / system sans-serif if the font
  request is ever blocked.

## Assumptions worth knowing about

- **Morning/Evening data shape**: `asanaRatings` is `{ morning: {...}, evening: {...} }`.
  Entries saved before this feature existed have a flat `{ asanaKey: value }`
  shape instead; `normalizeAsanaRatings()` in `js/app.js` and
  `flattenAsanaEntries()` in `js/insights.js` both treat that old shape as
  the Morning session on read, so old saved days keep working without a
  migration step. A day's overall score averages every rating from
  whichever session(s) were actually logged - equal weight per asana per
  session, not weighted toward one session.
- Icon-to-pose mapping is grouped by pose family for consistency and
  build speed, not one bespoke illustration per asana.
- The 30-day sample data (`js/seed.js`) has a few mild synthetic patterns
  baked in (morning sessions score a bit higher, full/new moon days a bit
  harder) purely so the Insights tab has something interesting to show in
  a demo - it is not a claim about real effects.
- **Lunar approximation**: New Moon / Full Moon are flagged by day-count
  from a reference new moon (pure math, offline). Ekadashi is approximated
  as the 11th day after each new moon and full moon - a day-count
  approximation for the prototype, not a tithi-accurate Panchang
  calculation. See `js/moon.js` → `getLunarEvent`.
- **Sex** is a one-time, locked choice stored at the account level
  (`Storage` settings → `sexLocked`/`lockedSex`), not a per-day field -
  every saved entry's `sex` mirrors that locked value. A "Change" link
  next to the locked avatar unlocks it again if needed (with a
  confirmation, since it updates every day's record). **Menstrual cycle**
  status, by contrast, genuinely is per-day and asked each time "Female"
  is the locked choice.

## Turning on real SSO

Edit `js/config.js`:

```js
sso: {
  googleClientId: 'xxxx.apps.googleusercontent.com',   // Google Cloud Console → OAuth client ID (Web)
  microsoftClientId: 'xxxx-xxxx-xxxx',                  // Azure AD app registration
  microsoftTenant: 'common',
  appleClientId: 'com.yourorg.yourapp',                 // Apple Developer → Services ID
}
```

Each button auto-activates once its client ID no longer starts with
`YOUR_`. Note: this prototype decodes the identity token client-side for
speed - a production build should verify tokens server-side.

## Scaling beyond the hackathon

Today, each user's data lives only in their own browser (`localStorage`),
which is why the app itself scales to any number of simultaneous users for
free - it's static files, so hosting it (Netlify, GitHub Pages, Vercel,
S3+CloudFront) handles 1000 concurrent people without any server code. The
tradeoff: no cross-device sync and no admin/aggregate view across users.

To add that:
1. Stand up a small API (e.g. FastAPI/Express) + a real database
   (Postgres/SQLite) behind it.
2. Swap `js/storage.js`'s localStorage calls for `fetch()` calls to that
   API - the rest of the app (forms, insights, charts) doesn't need to
   change, since it already goes through `Storage.*` as its only data layer.
3. Verify SSO tokens server-side and issue your own session.

## Path to Mobile App

This is already a installable PWA shell (`manifest.json` included). Once
verified on Desktop:
- Add a service worker for offline support, and it installs like an app
  on Android/desktop Chrome today.
- For iOS App Store / Play Store distribution, wrap it with Capacitor or
  React Native WebView - the HTML/CSS/JS here does not need a rewrite.

## File map

```
index.html        sign-in screen
app.html          main app shell (tabs: Daily Entry / Insights / Settings)
css/styles.css    all styling, brand colors as CSS variables
js/config.js      brand colors + SSO client ID placeholders
js/moon.js        moon phase calculation (pure math, offline)
js/icons.js       hand-drawn SVG pose icons
js/poses.js       asana list, kriyas/sadhanas panel items, rating scale
js/storage.js     localStorage data layer (the one place to swap for a real API)
js/auth.js        sign-in page logic (Google/Microsoft/Apple/demo)
js/insights.js    stats, factor breakdowns, key message, chart rendering
js/csv.js         CSV parser + import mapping (Settings → Import CSV)
js/seed.js        30-day randomized sample data generator
js/app.js         main app wiring (forms, tabs, reminders)
```
