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

// PAID personalized daily - the deterministic core. Personal Day (birthday +
// date) selects the base reading; the person's Life Path selects an optional
// overlay merged on top. Returns the merged reading plus the numbers behind it.
function emaxingPersonalDaily(birthDate, targetDate, content) {
  const flow = computeEnergyFlow(birthDate, targetDate);
  const dayKey = emaxingAdviceKey(flow.numerology.personalDay);
  const lpKey = emaxingAdviceKey(compatLifePathInfo(birthDate).lookupValue);

  const base = (content && content.personalDay && content.personalDay[dayKey]) || null;
  const overlay = (content && content.lifePathOverlay && content.lifePathOverlay[lpKey] && content.lifePathOverlay[lpKey][dayKey]) || null;

  return {
    entry: emaxingMergeAdvice(base, overlay),
    hasOverlay: !!overlay,
    personalDay: flow.numerology.personalDay,
    personalMonth: flow.numerology.personalMonth,
    personalYear: flow.numerology.personalYear,
    dayKey,
    lifePathKey: lpKey,
  };
}
