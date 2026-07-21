/* Shared EMaxing UI helpers — used by the profile page (app.js) and the
   calendar (calendar-app.js). Pure rendering; no state. */

function emaEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function emaStars(n) {
  n = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// Renders an AdviceEntry (title / focus+rating / summary / guidance / do+avoid).
function emaAdviceHtml(entry) {
  if (!entry) return '<div class="ema-empty">Reading coming soon.</div>';
  const list = (arr, cls) => (arr && arr.length)
    ? `<ul class="ema-list ${cls}">${arr.map((x) => `<li>${emaEsc(x)}</li>`).join('')}</ul>` : '';
  return `
    ${entry.title ? `<div class="ema-advice-title">${emaEsc(entry.title)}</div>` : ''}
    ${entry.focus != null || entry.rating != null ? `<div class="ema-focus">${entry.focus != null ? `Focus · <b>${emaEsc(entry.focus)}</b>` : ''}${entry.rating != null ? ` <span class="ema-stars" title="Energy ${emaEsc(entry.rating)}/5">${emaStars(entry.rating)}</span>` : ''}</div>` : ''}
    ${entry.summary ? `<p class="ema-summary">${emaEsc(entry.summary)}</p>` : ''}
    ${entry.guidance ? `<p class="ema-guidance">${emaEsc(entry.guidance)}</p>` : ''}
    ${(entry.do || entry.avoid) ? `<div class="ema-doavoid">
      ${entry.do ? `<div class="ema-do"><span class="ema-doavoid-label">Do</span>${list(entry.do, 'do')}</div>` : ''}
      ${entry.avoid ? `<div class="ema-avoid"><span class="ema-doavoid-label">Avoid</span>${list(entry.avoid, 'avoid')}</div>` : ''}
    </div>` : ''}`;
}
