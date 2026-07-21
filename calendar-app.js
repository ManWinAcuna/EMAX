/* EMaxing consumer calendar — month grid + per-day two-number reading (free).
   Same engine + content as the profile page. The day-detail reading is
   engine-driven, so real freeDaily copy drops in via emaxing-content.json with
   no code changes. */

let emaxingContent = { numbers: {}, freeDaily: {} };
let emaCalYear;   // month in view
let emaCalMonth;
let emaSelected;  // selected Date (local midnight)

function emaMidnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
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
    const cls = ['ema-cal-cell'];
    if (emaSameDay(date, today)) cls.push('today');
    if (emaSelected && emaSameDay(date, emaSelected)) cls.push('selected');
    html += `<button class="${cls.join(' ')}" data-day="${d}">${d}</button>`;
  }
  grid.innerHTML = html;
}

function emaRenderCalDetail() {
  const el = document.getElementById('emaCalDetail');
  const daily = emaxingTwoNumberDaily(emaSelected, emaxingContent);
  const label = emaSelected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  el.innerHTML = `
    <div class="ema-card-eyebrow">${emaEsc(label)}</div>
    <div class="ema-daynums">Day energy <b>${emaEsc(daily.dayOfMonth)}</b> &times; Universal <b>${emaEsc(daily.universalDisplay)}</b></div>
    ${emaAdviceHtml(daily.entry)}`;
}

function emaSelect(date) {
  emaSelected = emaMidnight(date);
  emaRenderCalendar();
  emaRenderCalDetail();
}

async function emaCalInit() {
  try { emaxingContent = await (await fetch('emaxing-content.json')).json(); } catch (e) { /* placeholders */ }

  const today = emaMidnight(new Date());
  emaCalYear = today.getFullYear();
  emaCalMonth = today.getMonth();
  emaSelected = today;

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
}

document.addEventListener('DOMContentLoaded', emaCalInit);
