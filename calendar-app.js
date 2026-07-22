/* EMaxing consumer calendar — month grid + per-day two-number reading (free).
   Same engine + content as the profile page. The day-detail reading is
   engine-driven, so real freeDaily copy drops in via emaxing-content.json with
   no code changes. */

let emaxingContent = { numbers: {}, freeDaily: {} };
let emaCalYear;   // month in view
let emaCalMonth;
let emaSelected;  // selected Date (local midnight)
let emaCalBirthDate = null;  // saved birthday, for the personalized paid reading

function emaMidnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function emaParseBday(iso) {
  if (!iso) return null;
  const p = String(iso).split('-').map(Number);
  if (p.length !== 3 || !p[0]) return null;
  const d = new Date(); d.setFullYear(p[0], p[1] - 1, p[2]); d.setHours(0, 0, 0, 0);
  return d;
}
function emaSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function emaRenderCalendar() {
  const grid = document.getElementById('emaCalGrid');
  document.getElementById('emaCalLabel').textContent =
    new Date(emaCalYear, emaCalMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const startDow = new Date(emaCalYear, emaCalMonth, 1).getDay();
  const daysInMonth = new Date(emaCalYear, emaCalMonth + 1, 0).getDate();
  const today = emaMidnight(new Date());

  let html = '';
  for (let i = 0; i < startDow; i++) html += '<div class="ema-cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(emaCalYear, emaCalMonth, d);
    const dt = emaDaytype(emaxingTwoNumberDaily(date, emaxingContent).classKey);
    const cls = ['ema-cal-cell'];
    if (emaSameDay(date, today)) cls.push('today');
    if (emaSelected && emaSameDay(date, emaSelected)) cls.push('selected');
    // Per-day type indicator: a dot (color) PLUS an accessible label (never color
    // alone). The design layer styles .ema-cal-dot[data-daytype].
    html += `<button class="${cls.join(' ')}" data-day="${d}" data-daytype="${dt}" title="${d} · ${EMA_DAYTYPE_LABEL[dt]}"><span class="ema-cal-daynum">${d}</span><span class="ema-cal-dot" data-daytype="${dt}" aria-label="${EMA_DAYTYPE_LABEL[dt]}"></span></button>`;
  }
  grid.innerHTML = html;
}

function emaRenderCalDetail() {
  const el = document.getElementById('emaCalDetail');
  const daily = emaxingTwoNumberDaily(emaSelected, emaxingContent);
  el.setAttribute('data-daytype', emaDaytype(daily.classKey)); // UI hook for the day-type banner
  const label = emaSelected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  el.innerHTML = `
    <div class="ema-card-eyebrow">${emaEsc(label)}</div>
    <div class="ema-daynums">Day energy <b>${emaEsc(daily.dayCompound)}</b> &times; Universal <b>${emaEsc(daily.universalDisplay)}</b></div>
    ${emaAdviceHtml(daily.entry)}`;
}

// The personalized (paid) reading for the selected day — gated exactly like the
// profile card: no birthday -> prompt; not a subscriber -> locked teaser; else the
// real source-hidden v2 read for that date.
function emaRenderCalPersonal() {
  const el = document.getElementById('emaCalPersonal');
  if (!el) return;
  const label = emaSelected.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  if (!emaCalBirthDate) {
    el.classList.remove('locked');
    el.removeAttribute('data-daytype');
    el.innerHTML = `
      <div class="ema-card-eyebrow">Your Personal Guidance</div>
      <p class="ema-guidance">Set your birthday on your profile to unlock your personalized reading for any day.</p>
      <a class="ema-foot-link" href="index.html">Go to your profile &rarr;</a>`;
    return;
  }

  const subbed = (typeof emaxingIsSubscriber === 'function') && emaxingIsSubscriber();
  if (!subbed) {
    el.classList.add('locked');
    el.removeAttribute('data-daytype');
    const teaser = {
      title: 'Your Personal Guidance',
      summary: "A reading tuned to your exact chart and this day's energy.",
      guidance: 'Unlock to see your personalized reading for any day on the calendar — matched to your full profile.',
    };
    el.innerHTML = `
      <div class="ema-card-eyebrow">Your Personal Guidance &middot; ${emaEsc(label)}</div>
      <div class="ema-lock">
        <div class="ema-lock-blur" aria-hidden="true">${emaAdviceHtml(teaser)}</div>
        <div class="ema-lock-overlay">
          <div class="ema-lock-icon">🔒</div>
          <div class="ema-lock-title">Personalized daily guidance</div>
          <div class="ema-lock-sub">Your exact reading for any day, tuned to your profile.</div>
          <button class="ema-btn ema-unlock" id="emaUnlockBtn">Unlock &middot; $4.90/mo</button>
        </div>
      </div>`;
    return;
  }

  el.classList.remove('locked');
  const r = emaxingPersonalV2(emaCalBirthDate, emaSelected, emaxingContent);
  el.setAttribute('data-daytype', r.daytype);
  el.innerHTML = `
    <div class="ema-card-eyebrow">Your Personal Guidance &middot; ${emaEsc(label)}</div>
    ${emaAdviceHtml(r.entry)}`;
}

function emaSelect(date) {
  emaSelected = emaMidnight(date);
  emaRenderCalendar();
  emaRenderCalDetail();
  emaRenderCalPersonal();
}

async function emaCalInit() {
  try { emaxingContent = await (await fetch('emaxing-content.json')).json(); } catch (e) { /* placeholders */ }
  try { emaCalBirthDate = emaParseBday(localStorage.getItem('emaxing_birthday')); } catch (e) { /* ignore */ }

  const today = emaMidnight(new Date());
  emaCalYear = today.getFullYear();
  emaCalMonth = today.getMonth();
  emaSelected = today;

  // Re-render the paid card when auth/subscription changes (sign-in, unlock, etc.).
  window.emaxingOnSubscriptionChange = () => emaRenderCalPersonal();
  document.body.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'emaUnlockBtn' && typeof emaxingHandleUnlock === 'function') emaxingHandleUnlock();
  });

  document.getElementById('emaCalPrev').addEventListener('click', () => {
    emaCalMonth--; if (emaCalMonth < 0) { emaCalMonth = 11; emaCalYear--; } emaRenderCalendar();
  });
  document.getElementById('emaCalNext').addEventListener('click', () => {
    emaCalMonth++; if (emaCalMonth > 11) { emaCalMonth = 0; emaCalYear++; } emaRenderCalendar();
  });
  document.getElementById('emaCalToday').addEventListener('click', () => {
    const t = emaMidnight(new Date());
    emaCalYear = t.getFullYear(); emaCalMonth = t.getMonth();
    emaSelect(t);
  });
  document.getElementById('emaCalGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-day]');
    if (!btn) return;
    emaSelect(new Date(emaCalYear, emaCalMonth, Number(btn.dataset.day)));
  });

  emaRenderCalendar();
  emaRenderCalDetail();
  emaRenderCalPersonal();
}

document.addEventListener('DOMContentLoaded', emaCalInit);
