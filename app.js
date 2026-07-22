/* EMaxing consumer app — profile + free daily + (gated) personal daily.
   All numerology comes from the ported engine; this file is just UI + wiring. */

const EMAXING_BDAY_KEY = 'emaxing_birthday';        // 'YYYY-MM-DD'

let emaxingContent = { universalDay: {}, personalDay: {}, lifePathOverlay: {} };
let emaCurrentBirthDate = null; // so an auth/subscription change can re-render the paid card

function emaParseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date();
  dt.setFullYear(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

// emaEsc / emaStars / emaAdviceHtml live in emaxing-ui.js (shared with calendar).
// emaxingIsSubscriber / auth modal / checkout live in emaxing-auth.js.

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
  const el = document.getElementById('emaFreeDaily');
  el.setAttribute('data-daytype', emaDaytype(daily.classKey)); // UI hook for the day-type banner
  el.innerHTML = `
    <div class="ema-card-eyebrow">Energy Maxing for the Day · ${emaEsc(dateLabel)}</div>
    <div class="ema-daynums">Day energy <b>${emaEsc(daily.dayCompound)}</b> &times; Universal <b>${emaEsc(daily.universalDisplay)}</b></div>
    ${emaAdviceHtml(daily.entry)}`;
}

function emaRenderPersonal(birthDate) {
  const el = document.getElementById('emaPersonal');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (!emaxingIsSubscriber()) {
    el.classList.add('locked');
    el.removeAttribute('data-daytype'); // no banner tint on the locked teaser
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
  const r = emaxingPersonalV2(birthDate, today, emaxingContent);
  el.setAttribute('data-daytype', r.daytype); // day-type banner hook (from net tone)
  // No numbers/scores shown — "hidden soup" rule: the synthesized read is the whole product.
  el.innerHTML = `
    <div class="ema-card-eyebrow">Your Personal Guidance · Today</div>
    ${emaAdviceHtml(r.entry)}`;
}

function emaShowApp(iso) {
  const bd = emaParseISO(iso);
  emaCurrentBirthDate = bd;
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

/* ---- Birthday picker: tap month, tap day, type year (no native calendar) ---- */

function emaDaysInMonth(month, year) {
  if (!month) return 31;
  // 2000 is a leap year, so Feb 29 stays selectable before a year is typed.
  return new Date(year || 2000, month, 0).getDate();
}

// Rebuild the day options for the chosen month/year, keeping the picked day if it
// still exists (a 31 chosen then switched to Feb just resets to the placeholder).
function emaPopulateDays() {
  const daySel = document.getElementById('emaBdayDay');
  const month = Number(document.getElementById('emaBdayMonth').value) || 0;
  const year = Number(document.getElementById('emaBdayYear').value) || 0;
  const prev = daySel.value;
  const n = emaDaysInMonth(month, year);
  const keep = prev && Number(prev) <= n;
  let html = `<option value="" disabled${keep ? '' : ' selected'}>Day</option>`;
  for (let d = 1; d <= n; d++) html += `<option value="${d}"${keep && Number(prev) === d ? ' selected' : ''}>${d}</option>`;
  daySel.innerHTML = html;
}

function emaSetBdayFields(iso) {
  const p = String(iso || '').split('-').map(Number);
  if (p.length !== 3 || !p[0]) return;
  document.getElementById('emaBdayYear').value = p[0];
  document.getElementById('emaBdayMonth').value = String(p[1]);
  emaPopulateDays();
  document.getElementById('emaBdayDay').value = String(p[2]);
}

// Returns 'YYYY-MM-DD' if the three fields form a real, non-future date, else null.
function emaReadBdayFields() {
  const month = Number(document.getElementById('emaBdayMonth').value) || 0;
  const day = Number(document.getElementById('emaBdayDay').value) || 0;
  const year = Number(document.getElementById('emaBdayYear').value) || 0;
  if (!month || !day || !year || year < 1900 || year > new Date().getFullYear()) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null; // rolled over
  if (dt > new Date()) return null; // future
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function emaInit() {
  try {
    emaxingContent = await (await fetch('emaxing-content.json')).json();
  } catch (e) {
    // keep the empty default; UI shows "coming soon" placeholders
  }

  emaPopulateDays();
  document.getElementById('emaBdayMonth').addEventListener('change', emaPopulateDays);
  document.getElementById('emaBdayYear').addEventListener('input', emaPopulateDays);

  document.getElementById('emaBdayForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const iso = emaReadBdayFields();
    const err = document.getElementById('emaBdayError');
    if (!iso) { if (err) err.textContent = 'Pick your month, day, and year.'; return; }
    if (err) err.textContent = '';
    try { localStorage.setItem(EMAXING_BDAY_KEY, iso); } catch (err2) { /* ignore */ }
    emaShowApp(iso);
  });

  document.getElementById('emaChangeBday').addEventListener('click', (e) => {
    e.preventDefault();
    let saved = null;
    try { saved = localStorage.getItem(EMAXING_BDAY_KEY); } catch (e2) { /* ignore */ }
    if (saved) emaSetBdayFields(saved);
    emaShowSetup();
  });

  // Re-render the paid card whenever auth/subscription state changes (e.g. after
  // sign-in or a returning subscriber's status loads).
  window.emaxingOnSubscriptionChange = () => { if (emaCurrentBirthDate) emaRenderPersonal(emaCurrentBirthDate); };

  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'emaUnlockBtn') emaxingHandleUnlock();
  });

  let saved = null;
  try { saved = localStorage.getItem(EMAXING_BDAY_KEY); } catch (e) { /* ignore */ }
  if (saved) { emaSetBdayFields(saved); emaShowApp(saved); } else { emaShowSetup(); }
}

document.addEventListener('DOMContentLoaded', emaInit);
