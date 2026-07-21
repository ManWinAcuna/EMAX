/* EMaxing consumer app — profile + free daily + (gated) personal daily.
   All numerology comes from the ported engine; this file is just UI + wiring. */

const EMAXING_BDAY_KEY = 'emaxing_birthday';        // 'YYYY-MM-DD'
const EMAXING_DEMO_UNLOCK_KEY = 'emaxing_demo_unlock';

let emaxingContent = { universalDay: {}, personalDay: {}, lifePathOverlay: {} };

function emaParseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date();
  dt.setFullYear(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function emaEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function emaStars(n) {
  n = Math.max(0, Math.min(5, Number(n) || 0));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// TEMPORARY demo gate — replaced later by the real Firebase subscription check.
// ?unlock=1 flips a local demo flag so the paid tier can be previewed now;
// ?unlock=0 clears it.
function emaxingIsSubscriber() {
  const p = new URLSearchParams(location.search);
  try {
    if (p.get('unlock') === '1') localStorage.setItem(EMAXING_DEMO_UNLOCK_KEY, '1');
    if (p.get('unlock') === '0') localStorage.removeItem(EMAXING_DEMO_UNLOCK_KEY);
    return localStorage.getItem(EMAXING_DEMO_UNLOCK_KEY) === '1';
  } catch (e) {
    return false;
  }
}

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

function emaRenderProfile(birthDate) {
  const p = emaxingProfile(birthDate);
  const cell = (val, label) => `<div class="ema-num"><div class="ema-num-val">${emaEsc(val)}</div><div class="ema-num-label">${label}</div></div>`;
  document.getElementById('emaProfile').innerHTML = `<div class="ema-numbers">
    ${cell(p.lifePath, 'Life Path')}
    ${cell(p.dayBorn, 'Day Born')}
    ${cell(p.yearAnimal, 'Year Animal')}
    ${cell(p.sunSign, 'Sun Sign')}
  </div>`;
}

function emaRenderFreeDaily() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daily = emaxingTwoNumberDaily(today, emaxingContent);
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('emaFreeDaily').innerHTML = `
    <div class="ema-card-eyebrow">Energy Maxing for the Day · ${emaEsc(dateLabel)}</div>
    <div class="ema-daynums">Day energy <b>${emaEsc(daily.dayOfMonth)}</b> &times; Universal <b>${emaEsc(daily.universalDisplay)}</b></div>
    ${emaAdviceHtml(daily.entry)}`;
}

function emaRenderPersonal(birthDate) {
  const el = document.getElementById('emaPersonal');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (!emaxingIsSubscriber()) {
    el.classList.add('locked');
    const teaser = {
      title: 'Your Personal Guidance',
      focus: '••••',
      summary: "A reading tuned to your exact chart and today's energy.",
      guidance: "Unlock to see today's personalized move — matched to your Life Path and Personal Day.",
      do: ['••••••••'], avoid: ['•••••'],
    };
    el.innerHTML = `
      <div class="ema-card-eyebrow">Your Personal Guidance · Today</div>
      <div class="ema-lock">
        <div class="ema-lock-blur" aria-hidden="true">${emaAdviceHtml(teaser)}</div>
        <div class="ema-lock-overlay">
          <div class="ema-lock-icon">🔒</div>
          <div class="ema-lock-title">Personalized daily guidance</div>
          <div class="ema-lock-sub">Tuned to your exact profile, every single day.</div>
          <button class="ema-btn ema-unlock" id="emaUnlockBtn">Unlock · $4.90/mo</button>
        </div>
      </div>`;
    return;
  }

  el.classList.remove('locked');
  const r = emaxingPersonalDaily(birthDate, today, emaxingContent);
  el.innerHTML = `
    <div class="ema-card-eyebrow">Your Personal Guidance · Today</div>
    ${emaAdviceHtml(r.entry)}
    <div class="ema-personal-meta">Personal Day ${emaEsc(r.personalDay)} · Month ${emaEsc(r.personalMonth)} · Year ${emaEsc(r.personalYear)}</div>`;
}

function emaShowApp(iso) {
  const bd = emaParseISO(iso);
  document.getElementById('emaSetup').style.display = 'none';
  document.getElementById('emaMain').style.display = '';
  emaRenderProfile(bd);
  emaRenderFreeDaily();
  emaRenderPersonal(bd);
}

function emaShowSetup() {
  document.getElementById('emaMain').style.display = 'none';
  document.getElementById('emaSetup').style.display = '';
}

async function emaInit() {
  try {
    emaxingContent = await (await fetch('emaxing-content.json')).json();
  } catch (e) {
    // keep the empty default; UI shows "coming soon" placeholders
  }

  const input = document.getElementById('emaBdayInput');
  input.max = new Date().toISOString().slice(0, 10); // no future birthdays

  document.getElementById('emaBdayForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    if (!v) return;
    try { localStorage.setItem(EMAXING_BDAY_KEY, v); } catch (err) { /* ignore */ }
    emaShowApp(v);
  });

  document.getElementById('emaChangeBday').addEventListener('click', (e) => {
    e.preventDefault();
    emaShowSetup();
  });

  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'emaUnlockBtn') {
      // Stripe checkout gets wired here later.
      alert('Checkout coming soon — EMaxing Personal is $4.90/mo.');
    }
  });

  let saved = null;
  try { saved = localStorage.getItem(EMAXING_BDAY_KEY); } catch (e) { /* ignore */ }
  if (saved) { input.value = saved; emaShowApp(saved); } else { emaShowSetup(); }
}

document.addEventListener('DOMContentLoaded', emaInit);
