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
// 'avg': the average, or the spread of the sources' averages where they disagree. 'range': least to most possible.
let view = localStorage.getItem('view') === 'range' ? 'range' : 'avg';

const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
// [low, central, high] for a view: the full range, the disputed averages, or just the average.
const pick = (a, d, v) => (v === 'range' ? a : d ? [d[0], a[1], d[1]] : [a[1], a[1], a[1]]);
// As given: per unit, per km for trips, or per amt of unit.
const perUnit = (it, v = view) => {
  const [g, k] = [it.g && pick(it.g, it.disputed?.g, v), it.kwh && pick(it.kwh, it.disputed?.kwh, v)];
  return [0, 1, 2].map((i) => (g ? g[i] : 0) + (k ? k[i] * GRIDS[region][1] : 0));
};
// For the default amount: one unit, an average trip, or amt of unit.
const grams = (it, v) => perUnit(it, v).map((g) => g * (it.km || 1));
const deflt = (it) => it.km || it.amt || 1;
// Per one of whatever qty counts.
const perOne = (it) => grams(it).map((g) => g / deflt(it));
// What the default amount is, e.g. 'average'.
const avg = (it) => (it.km ? 'average trip' : it.avg);
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// Footnote marks: * runs on electricity, † food (counted as bought).
const star = (it) => (it.kwh ? '*' : '') + (it.cat === 'Food & drink' ? '†' : '');
// Thousands grouped with a narrow no-break space, e.g. 1 500, so a number never wraps or reads as a decimal comma.
const fmt = (n, o) => n.toLocaleString('en', o).replace(/,/g, '\u202f').replace('-', '−');
const size = (it) => (it.km ? ` (${fmt(it.km)} km trip)` : it.amt ? ` (${fmt(it.amt)} ${it.unit})` : '');
// Lower-case the first letter of a name inside a sentence, but not of an abbreviation like 'LED'.
const lc = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

// 2 significant figures; values below 0.1 are shown as fractions, e.g. 1/300.
const sig = (x) => fmt(+x.toPrecision(2), { maximumFractionDigits: 3 });
// Big counts in words, e.g. 240 thousand, 1.2 million: easier to read than a row of digits.
// [divisor, word]; words start at 10 000, so 1–9 thousand stays in digits.
const scale = (n) => [[1e9, ' billion', 1e9], [1e6, ' million', 1e6], [1e3, ' thousand', 1e4]].find(([, , t]) => +n.toPrecision(2) >= t) || [1, ''];
const big = (n, [d, w] = scale(n)) => sig(n / d) + w;
const num = (n, s) => (n >= 0.1 ? big(n, s) : n <= 0 ? '0' : '1/' + sig(Math.round(1 / n)));
// A range of counts in one scale where the low end stays at least 1: "5.6–15 thousand", not "5 600 – 15 thousand".
const numSpan = (a, b) => {
  const s = scale(b);
  return span(a, b, (n) => num(n, a >= s[0] && s[0] > 1 ? s : undefined));
};
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
// A shared unit is written once: "4–20 kg", but "300 g – 2 kg".
function span(a, b, fmt) {
  const [x, y] = [fmt(a), fmt(b)];
  if (x === y) return '';
  const [, xn, xu] = x.match(/^(.*?)( [^\d\s]\S*)?$/), [, yn, yu] = y.match(/^(.*?)( [^\d\s]\S*)?$/);
  return xu === yu ? `${xn}–${yn}${xu || ''}` : `${x} – ${y}`;
}
function source(it, summary) {
  const [aLo, mid, aHi] = perUnit(it, 'avg');
  const [lo, , hi] = perUnit(it, 'range');
  const aRng = span(aLo, aHi, mass);
  const rng = span(lo, hi, mass);
  const perTrip = it.km ? `; average trip ${fmt(it.km)} km = ${mass(grams(it, 'avg')[1])}` : '';
  const kwhRng = it.kwh && it.kwh[0] !== it.kwh[2] ? ` (${it.kwh[0]}–${it.kwh[2]})` : '';
  const fuel = it.g && it.kwh ? `${it.g[1]} g from fuel + ` : '';
  const elec = it.kwh ? ` = ${fuel}${it.kwh[1]} kWh${kwhRng} × ${GRIDS[region][1]} g/kWh, ${GRIDS[region][0]} grid` : '';
  const refs = it.src.map(([t, url]) => `<li>${url ? `<a href="${url}" rel="noopener">${esc(t)}</a>` : esc(t)}</li>`).join('');
  const per = it.km ? ' per km' : it.amt ? '' : ' each';
  return `<details><summary>${summary}</summary>${esc(it.name)}${it.amt ? size(it) : ''}: average ${mass(mid)}${per}${aRng ? ` (sources disagree: ${aRng})` : ''}${elec}${perTrip}; least to most possible ${rng || mass(mid)}. ${esc(it.note)} Confidence: ${it.conf}.<ul>${refs}</ul></details>`;
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
  // Shown even for a single variant, so it is clear which exact item the figure is for.
  $('#variants').innerHTML = vs.map((v) => `<a href="#${v.id}" class="${v === sel ? 'on' : ''}">${esc(v.name)}</a>`).join('');
  const what = sel.km ? 'km by ' + lc(sel.name) : sel.amt ? `${sel.unit} ${lc(sel.name)}` : '× ' + sel.name;
  $('#big').innerHTML = `${icon(sel.icon)}<div><span id="what"><input id="qty" type="text" inputmode="decimal"
    value="${qty}" aria-label="Amount" title="Change the amount"> ${esc(what)}${star(sel)}<span id="avg"></span></span><b id="total"></b>
    <span id="person"></span><span id="disp"></span>${sel.model ? `<span id="model">Based on one model: ${esc(sel.model)}</span>` : ''}</div>`;
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
  $('#avg').textContent = avg(sel) && qty === deflt(sel) ? ` (${avg(sel)})` : '';
  $('#total').textContent = (rng || mass(mid)) + ' CO₂e';
  $('#disp').textContent = view === 'avg' && rng ? 'Sources disagree about the average, so this is the spread of their averages.' : '';
  $('#person').textContent = sel.id === 'person-year' ? ''
    : `About what the average person on Earth emits in ${time(mid)}.`;
  $('#detail').innerHTML = source(sel, `${sel.conf} confidence · sources`);
  const others = Object.values(groups).filter((g) => g[0].item !== sel.item).map((g) => g[0])
    .sort((a, b) => grams(a)[1] - grams(b)[1]);
  // Bars: each item's footprint on a log scale, with a tick where the selected amount sits.
  const logs = ITEMS.map((it) => Math.log(grams(it)[1])).concat(Math.log(mid));
  const [lMin, lMax] = [Math.min(...logs), Math.max(...logs)];
  const pct = (g) => (((Math.log(g) - lMin) / (lMax - lMin)) * 100).toFixed(1) + '%';
  $('#rows').style.setProperty('--sel', pct(mid));
  const rows = others.map((it) => {
    const [bLo, bMid, bHi] = grams(it);
    // Widest honest range: low of selected ÷ high of other, and vice versa.
    // A low end at or below zero (e.g. chocolate from farms that store carbon) leaves no upper limit.
    const [a, b] = [Math.max(lo / bHi, 0), bLo > 0 ? hi / bLo : Infinity];
    return [isFinite(b) ? numSpan(a, b) || num(mid / bMid) : `${num(a)} or more`, it, bMid];
  });
  // Multipliers sit in one right-aligned column, as wide as the longest.
  $('#rows').style.setProperty('--w', Math.max(...rows.map(([m]) => m.length)) + 2 + 'ch');
  $('#rows').innerHTML = rows.map(([m, it, bMid]) => `<li style="--bar:${pct(bMid)}"><a href="#${it.id}" title="${esc(it.name)}">${icon(it.icon)} <b>${m} ×</b> ${esc(it.name)}${size(it)}${star(it)}</a>
      ${source(it, 'source')}</li>`).join('');
}

function render() {
  sel = byId[location.hash.slice(1)] || ITEMS[0];
  qty = deflt(sel);
  cat = sel.cat;
  renderNav();
  renderHead();
  renderRows();
}

const viewBtns = [...document.querySelectorAll('#views button')];
const showView = () => viewBtns.forEach((b) => b.classList.toggle('on', b.dataset.v === view));
viewBtns.forEach((b) => { b.onclick = () => {
  view = b.dataset.v;
  localStorage.setItem('view', view);
  showView();
  renderRows();
}; });
showView();

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
