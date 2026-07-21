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

// FREE universal daily: keyed only by the date's own universal day number, so
// it reads the same for everyone. Powers both the profile page's free reading
// and the calendar's per-day knowledge.
function emaxingUniversalDaily(targetDate, content) {
  const info = compatLifePathInfo(targetDate);
  const key = emaxingAdviceKey(info.lookupValue);
  const entry = (content && content.universalDay && content.universalDay[key]) || null;
  return { key, dayDisplay: info.display, entry };
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
