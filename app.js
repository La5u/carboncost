const $ = (s) => document.querySelector(s);
const byId = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
// Item label → its variants; the first variant is the default.
const groups = {};
for (const it of ITEMS) (groups[it.item] ||= []).push(it);

// Guess the grid region from the browser timezone: no network request needed.
const TZ_REGIONS = [
  [/^Europe\/London$/, 'UK'],
  [/^Europe\/Paris$/, 'FR'],
  [/^Europe\/Berlin$/, 'DE'],
  [/^Europe\//, 'EU'],
  [/^America\/(Toronto|Montreal|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina)$/, 'CA'],
  [/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky)|Pacific\/Honolulu)/, 'US'],
  [/^Asia\/(Kolkata|Calcutta)$/, 'IN'],
  [/^Asia\/(Shanghai|Chongqing|Urumqi)$/, 'CN'],
  [/^Asia\/Tokyo$/, 'JP'],
  [/^Australia\//, 'AU'],
];
function guessRegion() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const hit = TZ_REGIONS.find(([re]) => re.test(tz));
  return hit ? hit[1] : 'WORLD';
}

let region = localStorage.getItem('region');
if (!GRIDS[region]) region = guessRegion();
// Amount of the selected item: units, km for trips, or its own unit (g, ml, min…). Starts at the default amount.
let sel, cat, qty;

const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
// As given: per unit, per km for trips, or per amt of unit.
const perUnit = (it) => [0, 1, 2].map((i) => (it.g ? it.g[i] : 0) + (it.kwh ? it.kwh[i] * GRIDS[region][1] : 0));
// For the default amount: one unit, an average trip, or amt of unit.
const grams = (it) => perUnit(it).map((g) => g * (it.km || 1));
const deflt = (it) => it.km || it.amt || 1;
// Per one of whatever qty counts.
const perOne = (it) => grams(it).map((g) => g / deflt(it));
// What the default amount is, e.g. 'average'.
const avg = (it) => (it.km ? 'average trip' : it.avg);
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const star = (it) => (it.kwh ? '*' : '');
const size = (it) => (it.km ? ` (${it.km.toLocaleString('en')} km trip)` : it.amt ? ` (${it.amt.toLocaleString('en')} ${it.unit})` : '');
// Lower-case the first letter of a name inside a sentence, but not of an abbreviation like 'LED'.
const lc = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

// 2 significant figures; values below 0.1 are shown as fractions, e.g. 1/300.
const sig = (x) => (+x.toPrecision(2)).toLocaleString('en', { maximumFractionDigits: 3 });
const num = (n) => (n >= 0.1 ? sig(n) : '1/' + sig(Math.round(1 / n)));
// World emissions per person per year, to turn a mass into time: "the average person emits this in 3 hours".
const PERSON_YEAR = byId['person-year'].g[1];
function time(g) {
  const s = (g / PERSON_YEAR) * 365.25 * 86400;
  if (s < 1) return 'less than a second';
  const [n, u] = [[31557600, 'year'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']]
    .map(([sec, u]) => [s / sec, u]).find(([n]) => n >= 1);
  const r = sig(n);
  return `${r} ${u}${r === '1' ? '' : 's'}`;
}
function mass(g) {
  if (g >= 1e6) return sig(g / 1e6) + ' t';
  if (g >= 1e3) return sig(g / 1e3) + ' kg';
  return sig(g) + ' g';
}

// "a – b", or '' when both ends format the same (only one sourced figure).
const span = (a, b, fmt) => (fmt(a) === fmt(b) ? '' : `${fmt(a)} – ${fmt(b)}`);
// No consensus between sources: show the range itself instead of a central value.
const vague = (it) => it.conf === 'low';

function source(it, summary) {
  const [lo, mid, hi] = perUnit(it);
  const rng = span(lo, hi, mass);
  const [tLo, tMid, tHi] = grams(it);
  const tRng = span(tLo, tHi, mass);
  const perTrip = it.km ? `; average trip ${it.km.toLocaleString('en')} km = ${mass(tMid)}${tRng ? ` (${tRng})` : ''}` : '';
  const kwhRng = it.kwh && it.kwh[0] !== it.kwh[2] ? ` (${it.kwh[0]}–${it.kwh[2]})` : '';
  const fuel = it.g && it.kwh ? `${it.g[1]} g from fuel + ` : '';
  const elec = it.kwh ? ` = ${fuel}${it.kwh[1]} kWh${kwhRng} × ${GRIDS[region][1]} g/kWh, ${GRIDS[region][0]} grid` : '';
  const refs = it.src.map(([t, url]) => `<li>${url ? `<a href="${url}" rel="noopener">${esc(t)}</a>` : esc(t)}</li>`).join('');
  const per = it.km ? ' per km' : it.amt ? '' : ' each';
  return `<details><summary>${summary}</summary>${esc(it.name)}${it.amt ? size(it) : ''}: ${mass(mid)}${rng ? ` (${rng})` : ''}${per}${elec}${perTrip}. ${esc(it.note)} Confidence: ${it.conf}.<ul>${refs}</ul></details>`;
}

function renderNav() {
  $('#cats').innerHTML = Object.entries(CATS)
    .map(([c, ic]) => `<button data-cat="${c}" class="${c === cat ? 'on' : ''}">${icon(ic)}${esc(c)}</button>`).join('');
  $('#subs').innerHTML = Object.values(groups).filter((g) => g[0].cat === cat)
    .sort((a, b) => grams(b[0])[1] - grams(a[0])[1])
    .map(([d]) => `<a href="#${d.id}" class="${d.item === sel.item ? 'on' : ''}">${icon(d.icon)}${esc(d.item)}</a>`).join('');
}
$('#cats').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) { cat = b.dataset.cat; renderNav(); }
};

function renderHead() {
  const vs = groups[sel.item];
  $('#variants').innerHTML = vs.length > 1
    ? vs.map((v) => `<a href="#${v.id}" class="${v === sel ? 'on' : ''}">${esc(v.name)}</a>`).join('')
    : '';
  const what = sel.km ? 'km by ' + lc(sel.name) : sel.amt ? `${sel.unit} ${lc(sel.name)}` : '× ' + sel.name;
  $('#big').innerHTML = `${icon(sel.icon)}<div><span id="what"><input id="qty" type="text" inputmode="decimal"
    value="${qty}" aria-label="Amount" title="Change the amount"> ${esc(what)}${star(sel)}<span id="avg"></span></span><b id="total"></b>
    <span id="person"></span></div>`;
  const input = $('#qty');
  const fit = () => { input.style.width = Math.max(1, input.value.length) + 1 + 'ch'; };
  fit();
  input.oninput = () => {
    fit();
    const v = parseFloat(input.value);
    if (v > 0) { qty = v; renderRows(); }
  };
}

function renderRows() {
  const [lo, mid, hi] = perOne(sel).map((g) => g * qty);
  const rng = span(lo, hi, mass);
  const fuzzy = vague(sel) && rng;
  $('#avg').textContent = avg(sel) && qty === deflt(sel) ? ` (${avg(sel)})` : '';
  $('#total').textContent = (fuzzy ? rng : mass(mid)) + ' CO₂e';
  $('#person').textContent = sel.id === 'person-year' ? ''
    : `About what the average person on Earth emits in ${time(mid)}.`;
  $('#detail').innerHTML = source(sel, `${rng && !fuzzy ? `range ${rng} · ` : ''}${sel.conf} confidence · sources`);
  const others = Object.values(groups).filter((g) => g[0].item !== sel.item).map((g) => g[0])
    .sort((a, b) => grams(a)[1] - grams(b)[1]);
  $('#rows').innerHTML = others.map((it) => {
    const [bLo, bMid, bHi] = grams(it);
    // Widest honest range: low of selected ÷ high of other, and vice versa.
    const rng = span(lo / bHi, hi / bLo, num);
    const fuzzy = (vague(sel) || vague(it)) && rng;
    return `<li><a href="#${it.id}" title="${esc(it.name)}">${icon(it.icon)} <b>${fuzzy ? rng : num(mid / bMid)} ×</b> ${esc(it.name)}${size(it)}${star(it)}</a>
      <span class="rng">${fuzzy ? '' : rng}</span>${source(it, 'source')}</li>`;
  }).join('');
}

function render() {
  sel = byId[location.hash.slice(1)] || ITEMS[0];
  qty = deflt(sel);
  cat = sel.cat;
  renderNav();
  renderHead();
  renderRows();
}

const regionSel = $('#region');
regionSel.innerHTML = Object.entries(GRIDS)
  .map(([k, [n]]) => `<option value="${k}">Electricity: ${n}</option>`).join('');
regionSel.value = region;
regionSel.onchange = () => {
  region = regionSel.value;
  localStorage.setItem('region', region);
  renderNav();
  renderRows();
  renderFoot();
};
function renderFoot() {
  $('#gridnote').innerHTML = `* Runs on electricity, so it depends on how your electricity is made. We use the
    ${GRIDS[region][0]} average for 2025: ${GRIDS[region][1]} g CO₂e per kWh, including building and fuelling power plants
    (<a href="${GRID_SOURCE[1]}" rel="noopener">${GRID_SOURCE[0]}</a>). We guessed your region from your timezone; change it at the top.`;
}

addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
render();
renderFoot();
