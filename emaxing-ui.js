/* Shared EMaxing UI helpers — used by the profile page (app.js) and the
   calendar (calendar-app.js). Pure rendering; no state. */

function emaEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function emaStars(n) {
  n = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// Maps the engine's classKey to the UI day-type token the design layer styles
// against (data-daytype). synergy=Cheat Code, flow=Flow, trap=Matrix Trap,
// bestOfBoth=Hardest to Farm.
const EMA_DAYTYPE = { synergy: 'cheat', flow: 'flow', trap: 'trap', bestOfBoth: 'farm' };
const EMA_DAYTYPE_LABEL = { cheat: 'Cheat Code', flow: 'Flow', trap: 'Matrix Trap', farm: 'Hardest to Farm' };
function emaDaytype(classKey) { return EMA_DAYTYPE[classKey] || 'flow'; }

// Paid synthesis classKeys map onto the same four banner colors (reuses the
// day-type banner CSS). allFriction has no dedicated signal color yet — it rides
// the trap red as a "heavy day, tread carefully" cue until a 5th state exists.
const EMA_PAID_DAYTYPE = {
  allFavorable: 'cheat',
  dayYearTrap: 'trap', monthYearTrap: 'trap', dayMonthTrap: 'trap',
  allFriction: 'trap',
  flow: 'flow',
};
function emaPaidDaytype(classKey) { return EMA_PAID_DAYTYPE[classKey] || 'flow'; }

// Renders an AdviceEntry (title / focus+rating / summary / guidance / do+avoid).
function emaAdviceHtml(entry) {
  if (!entry) return '<div class="ema-empty">Reading coming soon.</div>';
  const list = (arr, cls) => (arr && arr.length)
    ? `<ul class="ema-list ${cls}">${arr.map((x) => `<li>${emaEsc(x)}</li>`).join('')}</ul>` : '';
  return `
    ${entry.title ? `<div class="ema-advice-title">${emaEsc(entry.title)}</div>` : ''}
    ${entry.focus != null || entry.rating != null ? `<div class="ema-focus">${entry.focus != null ? `Focus · <b>${emaEsc(entry.focus)}</b>` : ''}${entry.rating != null ? ` <span class="ema-stars" title="Energy ${emaEsc(entry.rating)}/5">${emaStars(entry.rating)}</span>` : ''}</div>` : ''}
    ${entry.summary ? `<p class="ema-summary">${emaEsc(entry.summary)}</p>` : ''}
    ${entry.guidance ? String(entry.guidance).split(/\n{2,}/).map((g) => g.trim()).filter(Boolean).map((g) => `<p class="ema-guidance">${emaEsc(g)}</p>`).join('') : ''}
    ${entry.trap ? `<div class="ema-trap"><span class="ema-trap-label">⚠️ Today's trap</span><span class="ema-trap-text">${emaEsc(entry.trap)}</span></div>` : ''}
    ${(entry.do || entry.avoid) ? `<div class="ema-doavoid">
      ${entry.do ? `<div class="ema-do"><span class="ema-doavoid-label">Do</span>${list(entry.do, 'do')}</div>` : ''}
      ${entry.avoid ? `<div class="ema-avoid"><span class="ema-doavoid-label">Avoid</span>${list(entry.avoid, 'avoid')}</div>` : ''}
    </div>` : ''}`;
}
