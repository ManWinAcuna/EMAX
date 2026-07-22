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
  // Manuel's rule: there is NO pure 2 energy — a 2 reads as master 11 (life path,
  // universal day, etc.). The only literal 2 anywhere is the calendar 2nd, which
  // is handled in the day-of-month path, not here.
  if (EMAXING_KEYS.has(k)) return k === '2' ? '11' : k;
  let x = Math.abs(parseInt(n, 10)) || 0;
  while (x > 9) x = String(x).split('').reduce((s, d) => s + Number(d), 0);
  return x === 2 ? '11' : String(x || 1);
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

// Reduce a number, but STOP on the master numbers 11/22/33 (they don't reduce).
function emaxingReduceKeepMasters(n) {
  n = Math.abs(parseInt(n, 10)) || 0;
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

// Manuel's "there is no 2 energy" rule: a value that lands on a bare 2 reads as
// master 11 — the ONE exception is where a literal 2 is allowed (the 2nd of the
// month). Masters and all other values pass through untouched.
function emaxingResolveTwo(reduced, allowLiteralTwo) {
  return (reduced === 2 && !allowLiteralTwo) ? 11 : reduced;
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
// Compound-first content lookup: a compound number (13th, 22nd, 31st) reads from
// its OWN block in `numbers` if authored, else falls back to its reduced root —
// so a 13/4, 22/4, 31/4 can each carry a different flavor while still scoring as a
// 4. The compound is shown as the label; the read never explains it (Manuel's
// "secret" — just give the energy).
function emaxingNumberBlock(numbers, compound, root) {
  return (numbers && (numbers[String(compound)] || numbers[String(root)])) || {};
}

function emaxingTwoNumberDaily(targetDate, content) {
  const cfg = (content && content.freeDaily) || {};
  const rawDay = targetDate.getDate();             // 1-31, the compound
  // Root drives scoring + classification. Keeps masters 11/22/33 and applies the
  // "no pure 2" rule: 11th/20th/29th read as master 11; only the literal 2nd is a 2.
  const dayOfMonth = emaxingResolveTwo(emaxingReduceKeepMasters(rawDay), rawDay === 2);
  const dayCompound = (rawDay <= 9 || rawDay === dayOfMonth)
    ? String(rawDay) : (rawDay + '/' + dayOfMonth); // label, e.g. "13/4", "20/11", "11"
  const universalInfo = compatLifePathInfo(targetDate);
  // Universal axis keeps masters 11/22/33 and karmic 13, folds 28 -> 1, and maps a
  // bare 2 -> master 11 (same "no pure 2" rule; no literal-2nd exception here).
  let universalDay = universalInfo.lookupValue;
  let universalDisplay = universalInfo.display;
  if (universalDay === 28) { universalDay = 1; universalDisplay = '1'; }
  if (universalDay === 2) { universalDay = 11; universalDisplay = '11'; }
  const universalRoot = emaxingDigit1to9(universalDay);
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
  // Compound-first: the 13th pulls numbers['13'] if authored, else numbers['4'].
  const A = emaxingNumberBlock(numbers, rawDay, dayOfMonth);
  const B = emaxingNumberBlock(numbers, universalDay, universalRoot);
  const tokenMap = {
    dayOfMonth: dayOfMonth,
    dayCompound: dayCompound,
    universalDay: universalDay,
    universalDisplay: universalDisplay,
    'A.energy': A.energy, 'A.move': A.move, 'A.trap': A.trap,
    'B.energy': B.energy, 'B.move': B.move, 'B.trap': B.trap,
  };

  return {
    dayOfMonth,
    dayCompound,
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

  // Each cycle level's direction blends its NUMEROLOGY score with its VIETNAMESE
  // (Chinese-zodiac) score for the same timescale — Year=year-animal,
  // Month=month-sign, Day=day-sign. Numerology-led at the engine's own 65/35 ratio
  // (matches computeEnergyFlow's finalScore), tunable via personalDaily.axisBlend.
  const wN = (cfg.axisBlend && cfg.axisBlend.numerology != null) ? cfg.axisBlend.numerology : 0.65;
  const wV = (cfg.axisBlend && cfg.axisBlend.vietnamese != null) ? cfg.axisBlend.vietnamese : 0.35;
  const num = flow.numerology, viet = flow.vietnamese;
  const blend = (n, v) => wN * n + wV * v;
  const bands = {
    year: emaxingCycleBand(blend(num.yearScore, viet.yearScore), favMin, frictionMin),
    month: emaxingCycleBand(blend(num.monthScore, viet.monthScore), favMin, frictionMin),
    day: emaxingCycleBand(blend(num.dayScore, viet.daySignScore), favMin, frictionMin),
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
    // Astrology flavor — the person's natal signs, optional color for the copy.
    yearAnimal: viet.personalYearSign,
    monthSign: viet.personalMonthSign,
    daySign: viet.personalDaySign,
    sunSign: getSunSign(birthDate),
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

/* ============================================================================
   PAID v2 — multi-layer, source-HIDDEN "friend who just knows" synthesis.
   Reads content.personalV2. Five layers each yield a compat DIRECTION
   (harmony/neutral/friction) + SALIENCE (|score-50|). The salient ones surface
   in FIXED narrative order (lifePath → dayBorn → cycles → animals → western),
   weave source-free vibe blocks, and close with a net-tone bottom line + the
   personalized trap. NEVER names a number, animal, sign, season, or cycle.
   ============================================================================ */

// Number entity for a "compound" value: {num} for scoring (masters kept, no-2),
// {block} the compound-first vibe block from `numbers`. allowLiteralTwo lets the
// literal 2nd-of-month stay a 2 (day-of-month layers); elsewhere a bare 2 -> 11.
function emaxingNumEntity(numbers, compoundValue, allowLiteralTwo) {
  let cv = compoundValue;
  if (cv === 2 && !allowLiteralTwo) cv = 11;
  const root = emaxingResolveTwo(emaxingReduceKeepMasters(cv), allowLiteralTwo && cv === 2);
  return { num: root, block: emaxingNumberBlock(numbers, cv, root) };
}

// The cycles layer: the existing macro->micro clash model, returning its classKey
// (which picks the authored cycles beat) + a direction + a salience proxy.
function emaxingCyclesRead(flow, favMin, frictionMin) {
  const n = flow.numerology, v = flow.vietnamese;
  const blend = (a, b) => 0.65 * a + 0.35 * b;
  const s = { year: blend(n.yearScore, v.yearScore), month: blend(n.monthScore, v.monthScore), day: blend(n.dayScore, v.daySignScore) };
  const band = (x) => x >= favMin ? 'FAV' : (x < frictionMin ? 'FRI' : 'NEU');
  const b = { year: band(s.year), month: band(s.month), day: band(s.day) };
  const clash = (x, y) => (b[x] === 'FAV' && b[y] === 'FRI') || (b[x] === 'FRI' && b[y] === 'FAV');
  let classKey, direction;
  if (b.year === 'FAV' && b.month === 'FAV' && b.day === 'FAV') { classKey = 'allFavorable'; direction = 'harmony'; }
  else if (b.year === 'FRI' && b.month === 'FRI' && b.day === 'FRI') { classKey = 'allFriction'; direction = 'friction'; }
  else if (clash('day', 'year')) { classKey = 'dayYearTrap'; direction = 'friction'; }
  else if (clash('month', 'year')) { classKey = 'monthYearTrap'; direction = 'friction'; }
  else if (clash('day', 'month')) { classKey = 'dayMonthTrap'; direction = 'friction'; }
  else { classKey = 'flow'; direction = 'neutral'; }
  return { classKey, direction, salience: Math.max(Math.abs(s.year - 50), Math.abs(s.month - 50), Math.abs(s.day - 50)) };
}

function emaxingCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function emaxingPersonalV2(birthDate, targetDate, content) {
  const cfg = (content && content.personalV2) || {};
  const numbers = (content && content.numbers) || {};
  const IA = cfg.interaction || {};
  const animalVibes = (cfg.vibes && cfg.vibes.animals) || {};
  const signVibes = (cfg.vibes && cfg.vibes.signs) || {};
  const th = cfg.thresholds || {};
  const harmonyMin = th.harmonyMin != null ? th.harmonyMin : 70;
  const frictionMax = th.frictionMax != null ? th.frictionMax : 40;
  const scfg = cfg.salience || {};
  const floor = scfg.floor != null ? scfg.floor : 13;
  const minBeats = scfg.minBeats != null ? scfg.minBeats : 3;
  const maxBeats = scfg.maxBeats != null ? scfg.maxBeats : 5;

  const flow = computeEnergyFlow(birthDate, targetDate);
  const viet = flow.vietnamese;
  const dirOf = (s) => s >= harmonyMin ? 'harmony' : (s < frictionMax ? 'friction' : 'neutral');
  // Replace tokens; blank the beat if anything unresolved is left OR if a DIGIT
  // slips through — source-hiding is a hard rule, so a stray number drops the beat
  // rather than ever reaching the reader.
  const weave = (tpl, map) => {
    if (typeof tpl !== 'string') return '';
    const out = tpl.replace(/\{([\w.]+)\}/g, (m, k) => (map[k] != null ? map[k] : m));
    return (/\{[\w.]+\}/.test(out) || /[0-9]/.test(out)) ? '' : out;
  };

  // Entities
  const lpVal = compatLifePathInfo(birthDate).lookupValue;
  let uVal = compatLifePathInfo(targetDate).lookupValue; if (uVal === 28) uVal = 1;
  const lp = emaxingNumEntity(numbers, lpVal, false);
  const uni = emaxingNumEntity(numbers, uVal, false);
  const dayBorn = emaxingNumEntity(numbers, birthDate.getDate(), true);
  const dateN = emaxingNumEntity(numbers, targetDate.getDate(), true);
  const numMap = (a, b) => ({ 'a.energy': a.block.energy, 'a.move': a.block.move, 'a.trap': a.block.trap, 'b.energy': b.block.energy, 'b.move': b.block.move, 'b.trap': b.block.trap });

  const layers = [];
  // 1. Life Path × Universal Day
  {
    const score = numerologyCompat(lp.num, uni.num), dir = dirOf(score);
    layers.push({ id: 'lifePathVsUniversal', dir, sal: Math.abs(score - 50), beat: weave((IA.lifePathVsUniversal || {})[dir], numMap(lp, uni)), trap: lp.block.trap });
  }
  // 2. Day Born × Day-of-month
  {
    const score = numerologyCompat(dayBorn.num, dateN.num), dir = dirOf(score);
    layers.push({ id: 'dayBornVsDate', dir, sal: Math.abs(score - 50), beat: weave((IA.dayBornVsDate || {})[dir], numMap(dayBorn, dateN)), trap: dayBorn.block.trap });
  }
  // 3. Cycles (macro->micro)
  {
    const cyc = emaxingCyclesRead(flow, harmonyMin, frictionMax);
    layers.push({ id: 'cycles', dir: cyc.direction, sal: cyc.salience, beat: (IA.cycles || {})[cyc.classKey] || '', trap: lp.block.trap });
  }
  // 4. Animals (composite of the salient year/month/day matchups)
  {
    const subs = [
      { key: 'year', a: viet.personalYearSign, b: viet.universalYearSign, score: viet.yearScore },
      { key: 'month', a: viet.personalMonthSign, b: viet.universalMonthSign, score: viet.monthScore },
      { key: 'day', a: viet.personalDaySign, b: viet.universalDaySign, score: viet.daySignScore },
    ];
    const frags = []; let maxSal = 0, domDir = 'neutral', domSal = -1;
    subs.forEach((sb) => {
      const sal = Math.abs(sb.score - 50); if (sal > maxSal) maxSal = sal;
      if (sal >= floor) {
        const dir = dirOf(sb.score), av = animalVibes[sb.a] || {}, bv = animalVibes[sb.b] || {};
        const frag = weave(((IA.animals || {})[sb.key] || {})[dir], { 'a.noun': av.noun, 'a.adj': av.adj, 'b.noun': bv.noun, 'b.adj': bv.adj });
        if (frag) frags.push(frag.trim());
        if (sal > domSal) { domSal = sal; domDir = dir; }
      }
    });
    const beat = frags.map((f) => emaxingCap(f)).join('. ');
    layers.push({ id: 'animals', dir: domDir, sal: maxSal, beat: beat ? beat + '.' : '' });
  }
  // 5. Western (season / sun sign)
  {
    const a = getSunSign(birthDate), b = getSunSign(targetDate);
    const score = westernCompat(a, b), dir = dirOf(score);
    const av = signVibes[a] || {}, bv = signVibes[b] || {};
    layers.push({ id: 'western', dir, sal: Math.abs(score - 50), beat: weave((IA.western || {})[dir], { 'a.noun': av.noun, 'a.adj': av.adj, 'b.noun': bv.noun, 'b.adj': bv.adj }) });
  }

  // Selection: present = salient + has a beat; pad to minBeats by salience; cap at maxBeats.
  const withBeat = layers.filter((l) => l.beat);
  let present = withBeat.filter((l) => l.sal >= floor);
  if (present.length < minBeats) {
    const extra = withBeat.filter((l) => present.indexOf(l) === -1).sort((x, y) => y.sal - x.sal);
    present = present.concat(extra.slice(0, minBeats - present.length));
  }
  if (present.length > maxBeats) {
    const keep = present.slice().sort((x, y) => y.sal - x.sal).slice(0, maxBeats);
    present = present.filter((l) => keep.indexOf(l) !== -1);
  }
  const ORDER = ['lifePathVsUniversal', 'dayBornVsDate', 'cycles', 'animals', 'western'];
  present.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  // Net tone across surfaced beats
  let hN = 0, fN = 0;
  present.forEach((l) => { if (l.dir === 'harmony') hN++; else if (l.dir === 'friction') fN++; });
  const tone = hN > fN ? 'harmonious' : (fN > hN ? 'challenging' : 'mixed');

  // Assemble; clean a leading "And " on the opener so it doesn't dangle.
  const beats = present.map((l) => l.beat.trim());
  if (beats.length) beats[0] = emaxingCap(beats[0].replace(/^And\s+/i, ''));
  const bottom = (cfg.bottomLine || {})[tone] || '';

  // Trap: the most-salient FRICTION number layer (lifePath/dayBorn/cycles).
  const trapCands = present.filter((l) => l.dir === 'friction' && l.trap).sort((a, b) => b.sal - a.sal);
  let trapText;
  if (trapCands.length) {
    trapText = ((cfg.trap || {}).fromFrictionLayer || '').replace(/\{a\.trap\}/g, trapCands[0].trap);
    // Same hard rule for the trap line — a leftover token or a digit falls back.
    if (/\{[\w.]+\}/.test(trapText) || /[0-9]/.test(trapText)) trapText = (cfg.trap || {}).noFriction || '';
  } else {
    trapText = (cfg.trap || {}).noFriction || '';
  }
  // emaAdviceHtml supplies its own "Today's trap" label — strip the authored prefix.
  const trapForEntry = trapText.replace(/^Your trap today:\s*/i, '');

  const guidance = beats.concat(bottom ? [bottom] : []).join('\n\n');
  const DAYTYPE = { harmonious: 'cheat', mixed: 'flow', challenging: 'trap' };

  return {
    entry: { title: 'Today, for you', guidance, trap: trapForEntry },
    tone,
    daytype: DAYTYPE[tone] || 'flow',
    surfaced: present.map((l) => l.id),
  };
}
