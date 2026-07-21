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
    <div class="ema-daynums">Day energy <b>${emaEsc(daily.dayOfMonth)}</b> &times; Universal <b>${emaEsc(daily.universalDisplay)}</b></div>
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
  const r = emaxingPersonalDaily(birthDate, today, emaxingContent);
  el.setAttribute('data-daytype', emaPaidDaytype(r.classKey)); // day-type banner hook
  // No numbers/scores shown — "hidden soup" rule: the reading is the whole product.
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

  // Re-render the paid card whenever auth/subscription state changes (e.g. after
  // sign-in or a returning subscriber's status loads).
  window.emaxingOnSubscriptionChange = () => { if (emaCurrentBirthDate) emaRenderPersonal(emaCurrentBirthDate); };

  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'emaUnlockBtn') emaxingHandleUnlock();
  });

  let saved = null;
  try { saved = localStorage.getItem(EMAXING_BDAY_KEY); } catch (e) { /* ignore */ }
  if (saved) { input.value = saved; emaShowApp(saved); } else { emaShowSetup(); }
}

document.addEventListener('DOMContentLoaded', emaInit);
