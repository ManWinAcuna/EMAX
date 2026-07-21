/* ============================================================================
   EMaxing engine — deterministic profile + daily readings.

   Pure logic layered over the ported numerology math (lib/*). It NEVER contains
   advice copy - all wording comes from emaxing-content.json. Same inputs always
   produce the same output (no randomness): this is the "hidden algorithm".
   ============================================================================ */

// Valid advice keys: 1-9 plus the three master numbers (kept as their own
// readings). Anything else (e.g. a karmic 28) digit-sums down to its 1-9 base so
// every value still maps to an authored entry.
const EMAXING_KEYS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '11', '22', '33']);

function emaxingAdviceKey(n) {
  const k = String(n);
  if (EMAXING_KEYS.has(k)) return k;
  let x = Math.abs(parseInt(n, 10)) || 0;
  while (x > 9) x = String(x).split('').reduce((s, d) => s + Number(d), 0);
  return String(x || 1);
}

// The four consumer profile numbers from a birth Date - nothing else. Uses only
// the ported numerology/astro functions.
function emaxingProfile(birthDate) {
  return {
    lifePath: getLifePath(birthDate),              // display, e.g. "9" or "22/4"
    lifePathKey: emaxingAdviceKey(compatLifePathInfo(birthDate).lookupValue),
    dayBorn: getReducedDay(birthDate),             // reduced day-of-month
    yearAnimal: getChineseZodiacYear(birthDate),   // Vietnamese/Chinese YEAR animal only
    sunSign: getSunSign(birthDate),                // Western sun sign
  };
}

// Pure single-digit reduction (1-9), NO master/karmic preservation. The
// day-of-month energy uses this per Manuel's method (22nd -> 4, 28th -> 1, 11th
// -> 2), which is deliberately different from getReducedDay() / the life-path
// axis that keep masters.
function emaxingDigit1to9(n) {
  let x = Math.abs(parseInt(n, 10)) || 0;
  while (x > 9) x = String(x).split('').reduce((s, d) => s + Number(d), 0);
  return x;
}

// [SUPERSEDED by emaxingTwoNumberDaily] Single-number free daily, kept only for
// reference. The live free/calendar reading is the two-number model below.
function emaxingUniversalDaily(targetDate, content) {
  const info = compatLifePathInfo(targetDate);
  const key = emaxingAdviceKey(info.lookupValue);
  const entry = (content && content.universalDay && content.universalDay[key]) || null;
  return { key, dayDisplay: info.display, entry };
}

// Fills tokens in an advice entry's text: raw ({dayOfMonth}/{universalDay}) and
// block-field ({A.energy}/{A.move}/{A.trap}/{B.energy}/...) where A = the
// day-of-month number's block and B = the universal-day number's block, pulled
// from content.numbers. This is what lets a class template weave in each
// number's ENERGY, not just the digit. Unknown tokens are left as-is.
function emaxingInterpolate(entry, map) {
  if (!entry) return entry;
  const sub = (s) => (typeof s === 'string' ? s.replace(/\{([\w.]+)\}/g, (m, k) => (map[k] != null ? map[k] : m)) : s);
  const out = {};
  Object.keys(entry).forEach((k) => {
    const v = entry[k];
    out[k] = Array.isArray(v) ? v.map(sub) : sub(v);
  });
  return out;
}

// FREE daily — the two-number model. It layers the DAY-OF-MONTH energy (pure
// 1-9) against the UNIVERSAL DAY number (masters 11/22/33 kept), scores their
// pair with numerologyCompat, and classifies the interaction. A single compat
// score can't tell a "trap" from a "best of both" (both can be low), so that
// split is DATA, not math: content.freeDaily.lowSplit[pairKey] decides, and
// classTemplates + optional heroPairs supply the wording. Same for everyone on
// a given date; powers both the profile's free reading and the calendar.
function emaxingTwoNumberDaily(targetDate, content) {
  const cfg = (content && content.freeDaily) || {};
  const dayOfMonth = emaxingDigit1to9(targetDate.getDate());
  const universalInfo = compatLifePathInfo(targetDate);
  // Universal axis keeps masters 11/22/33 and karmic 13, but folds 28 -> 1
  // (Manuel's rule).
  let universalDay = universalInfo.lookupValue;
  let universalDisplay = universalInfo.display;
  if (universalDay === 28) { universalDay = 1; universalDisplay = '1'; }
  const score = numerologyCompat(dayOfMonth, universalDay);
  const pairKey = dayOfMonth + 'x' + universalDay;

  const synergyMin = (cfg.thresholds && cfg.thresholds.synergyMin != null) ? cfg.thresholds.synergyMin : 75;
  const flowMin = (cfg.thresholds && cfg.thresholds.flowMin != null) ? cfg.thresholds.flowMin : 45;

  let classKey;
  if (score >= synergyMin) classKey = 'synergy';
  else if (score >= flowMin) classKey = 'flow';
  else classKey = (cfg.lowSplit && cfg.lowSplit[pairKey]) || 'trap'; // low splits editorially; default trap

  const template = (cfg.classTemplates && cfg.classTemplates[classKey]) || null;
  const hero = (cfg.heroPairs && cfg.heroPairs[pairKey]) || null;

  // A = the day-of-month number's block, B = the universal-day number's block,
  // from content.numbers. Lets templates weave each number's energy/move/trap.
  const numbers = (content && content.numbers) || {};
  const A = numbers[String(dayOfMonth)] || {};
  const B = numbers[String(universalDay)] || {};
  const tokenMap = {
    dayOfMonth: dayOfMonth,
    universalDay: universalDay,
    universalDisplay: universalDisplay,
    'A.energy': A.energy, 'A.move': A.move, 'A.trap': A.trap,
    'B.energy': B.energy, 'B.move': B.move, 'B.trap': B.trap,
  };

  return {
    dayOfMonth,
    universalDay,
    universalDisplay: universalDisplay,
    score,
    pairKey,
    classKey,
    numbersA: A,
    numbersB: B,
    entry: emaxingInterpolate(emaxingMergeAdvice(template, hero), tokenMap),
  };
}

// Overlay merge: the base reading first, then any field the overlay supplies
// overrides it (arrays like do/avoid are replaced wholesale). A null/partial
// overlay always still yields a complete reading, because base is the fallback.
function emaxingMergeAdvice(base, overlay) {
  if (!base && !overlay) return null;
  if (!overlay) return Object.assign({}, base);
  if (!base) return Object.assign({}, overlay);
  return Object.assign({}, base, overlay);
}

// Direction band for one cycle level's compat-to-universal score: is the person
// FLOWING with the universal current at this timescale (FAV), FIGHTING it (FRI),
// or neither (NEU)? Reuses the free tier's own thresholds so the paid verdict
// can never contradict the free one on the same date.
function emaxingCycleBand(score, favMin, frictionMin) {
  if (score >= favMin) return 'FAV';
  if (score < frictionMin) return 'FRI';
  return 'NEU';
}

// PAID personalized daily — the multi-timeframe synthesis (Marketing-locked
// model, from Manuel's "year plays out over the year, month over the month, day
// every day" framing). computeEnergyFlow already scores each nested cycle level
// against its universal context; this bands each level's direction and reads the
// relationship BETWEEN levels. A "clash" = a bigger and a smaller cycle at
// opposite ends (one FAV, one FRI) — and the bigger cycle always wins the read
// ("don't let today wreck your year"). Severity scales with the span of the
// clash: Day↔Year (biggest) > Month↔Year > Day↔Month. All three FAV = the rare
// stacked Cheat Code; all three FRI = a heavy/rest day. Identity (Life Path)
// flavors it last. Never exposes the numbers/scores — qualitative tokens only.
function emaxingPersonalDaily(birthDate, targetDate, content) {
  const flow = computeEnergyFlow(birthDate, targetDate);
  const cfg = (content && content.personalDaily) || {};
  const favMin = (cfg.thresholds && cfg.thresholds.favMin != null) ? cfg.thresholds.favMin : 75;
  const frictionMin = (cfg.thresholds && cfg.thresholds.frictionMin != null) ? cfg.thresholds.frictionMin : 45;

  const bands = {
    year: emaxingCycleBand(flow.numerology.yearScore, favMin, frictionMin),
    month: emaxingCycleBand(flow.numerology.monthScore, favMin, frictionMin),
    day: emaxingCycleBand(flow.numerology.dayScore, favMin, frictionMin),
  };
  // Opposite-ends only: a middle NEU never clashes (kills false 51-vs-49 splits).
  const clash = (a, b) =>
    (bands[a] === 'FAV' && bands[b] === 'FRI') || (bands[a] === 'FRI' && bands[b] === 'FAV');

  let classKey, lead, trap;
  if (bands.year === 'FAV' && bands.month === 'FAV' && bands.day === 'FAV') {
    classKey = 'allFavorable'; lead = 'all'; trap = null;
  } else if (bands.year === 'FRI' && bands.month === 'FRI' && bands.day === 'FRI') {
    classKey = 'allFriction'; lead = 'all'; trap = null;
  } else if (clash('day', 'year')) {
    classKey = 'dayYearTrap'; lead = 'year'; trap = 'day';
  } else if (clash('month', 'year')) {
    classKey = 'monthYearTrap'; lead = 'year'; trap = 'month';
  } else if (clash('day', 'month')) {
    classKey = 'dayMonthTrap'; lead = 'month'; trap = 'day';
  } else {
    classKey = 'flow'; lead = 'day'; trap = null;
  }

  const lpKey = emaxingAdviceKey(compatLifePathInfo(birthDate).lookupValue);
  const templates = cfg.classTemplates || {};
  const base = templates[classKey] || null;
  const overlay = (cfg.identityFlavor && cfg.identityFlavor[lpKey] && cfg.identityFlavor[lpKey][classKey]) || null;

  // Qualitative tokens ONLY — the "hidden soup" rule forbids showing the numbers.
  const LEVEL_NAME = { year: 'your year', month: 'this month', day: 'today', all: 'everything' };
  const BAND_WORD = { FAV: 'favorable', NEU: 'neutral', FRI: 'friction' };
  const tokenMap = {
    leadName: LEVEL_NAME[lead],
    trapName: trap ? LEVEL_NAME[trap] : '',
    yearBand: BAND_WORD[bands.year],
    monthBand: BAND_WORD[bands.month],
    dayBand: BAND_WORD[bands.day],
  };

  return {
    entry: emaxingInterpolate(emaxingMergeAdvice(base, overlay), tokenMap),
    classKey,
    lead,
    trap,
    bands,
    hasOverlay: !!overlay,
    lifePathKey: lpKey,
    // Kept for internal use / back-compat only; NEVER rendered (hidden-soup rule).
    personalDay: flow.numerology.personalDay,
    personalMonth: flow.numerology.personalMonth,
    personalYear: flow.numerology.personalYear,
  };
}
