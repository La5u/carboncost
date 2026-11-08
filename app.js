const $ = (s) => document.querySelector(s);
const byId = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
// Calculated items: the average is the sum of amount × shared factor (FACTORS in data.js);
// a term without a factor is a fixed number of grams.
const term = ([f, n]) => (f ? n * FACTORS[f].g : n);
for (const it of ITEMS) if (it.calc) {
  const g = it.calc.reduce((sum, t) => sum + term(t), 0);
  it.g = [it.g?.[0] ?? g, g, it.g?.[2] ?? g];
}
// Item label → its variants; the first variant is the default. Items for one country
// (region: 'US') are only listed when that country's grid is chosen.
let groups;
const regroup = () => {
  groups = {};
  for (const it of ITEMS) if (!it.region || it.region === region) (groups[it.item] ||= []).push(it);
};

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
regroup();
// Amount of the selected item: units, km for trips, or its own unit (g, ml, min…). Starts at the default amount.
let sel, cat, qty, often, asking;
const OFTEN = { once: ['once', 1], day: ['a day', 365.25], week: ['a week', 52.18], month: ['a month', 12], year: ['a year', 1] };
const annual = (n, o) => n * (OFTEN[o]?.[1] || 1);
const hash = (id, n, o) => `#${id}/${n}${o && o !== 'once' ? '/' + o : ''}`;
const save = () => history.replaceState(null, '', hash(sel.id, qty, often));
// Warn once, rather than on every change of amount or grid.
const valid = (rows, ids) => rows.filter((row) => {
  const missing = ids(row).filter((id) => id && !byId[id]);
  if (missing.length) console.warn(`Skipping ${row.id || row.q}: missing ${missing.join(', ')}`);
  return !missing.length;
});
const switches = valid(SWITCHES, (s) => [s.upfront, s.instead, s.per, s.minus]);
const questions = valid(QUESTIONS, (q) => [q.a[0], q.b[0]]);
// 'avg': the average, or the spread of the sources' averages where they disagree. 'range': least to most possible.
let view = localStorage.getItem('view') === 'range' ? 'range' : 'avg';
// Also compare against uncertain (faded) items, marked low confidence.
let unsure = localStorage.getItem('unsure') === '1';

const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
// [low, central, high] for a view: the full range, or just the average.
const pick = (a, v) => (v === 'range' ? a : [a[1], a[1], a[1]]);
// Making the vehicle or device, its share per unit: one figure or [low, central, high].
const madeG = (it) => (Array.isArray(it.made[0]) ? it.made[0] : [it.made[0], it.made[0], it.made[0]]);
// As given: per unit, per km for trips, or per amt of unit. use: only running it, without making it.
const perUnit = (it, v = view, use) => {
  const [g, k] = [it.g && pick(it.g, v), it.kwh && pick(it.kwh, v)];
  const m = it.made && !use ? pick(madeG(it), v) : [0, 0, 0];
  return [0, 1, 2].map((i) => m[i] + (g ? g[i] : 0) + (k ? k[i] * GRIDS[region][1] : 0));
};
// For the default amount: one unit, an average trip, or amt of unit.
const grams = (it, v, use) => perUnit(it, v, use).map((g) => g * (it.km || 1));
const deflt = (it) => it.km || it.amt || 1;
// Per one of whatever qty counts.
const perOne = (it, use) => grams(it, view, use).map((g) => g / deflt(it));
// What the default amount is, e.g. 'average'.
const avg = (it) => (it.km ? 'average trip' : it.avg);
// unc: how far off the average may be, in %. Faded: uncertain by 2× or more.
const weak = (it) => it.unc >= 100;
const unc = (it) => (it.unc >= 100 ? `within ${sig(1 + it.unc / 100)}×` : `±${it.unc}%`);
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// Footnote marks: * runs on electricity, † food (counted as bought).
const star = (it) => (it.kwh ? '*' : '') + (it.cat === 'Food & drink' ? '†' : '');
// Thousands grouped with a narrow no-break space, e.g. 1 500, so a number never wraps or reads as a decimal comma.
const fmt = (n, o) => n.toLocaleString('en', o).replace(/,/g, '\u202f').replace('-', '−');
const size = (it) => (it.km ? ` (${fmt(it.km)} km trip)` : it.amt ? ` (${fmt(it.amt)} ${it.unit})` : '');
// Lower-case the first letter of a name inside a sentence, but not of an abbreviation like 'LED'.
const lc = (s) => (/^([A-Z][a-z]|A )/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

// 2 significant figures; values below 0.1 are shown as fractions, e.g. 1/300.
const sig = (x) => fmt(+x.toPrecision(2), { maximumFractionDigits: 10 });
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
const link = ([t, url]) => (url ? `<a href="${url}" rel="noopener">${esc(t)}</a>` : esc(t));
function sourceBody(it) {
  const mid = perUnit(it, 'avg')[1];
  const [lo, , hi] = perUnit(it, 'range');
  const rng = span(lo, hi, mass);
  const perTrip = it.km ? `; average trip ${fmt(it.km)} km = ${mass(grams(it, 'avg')[1])}` : '';
  // Min–max: paired with fuel, the kWh scenarios need not run low to high (see data.js).
  const kwhRng = it.kwh && it.kwh[0] !== it.kwh[2] ? ` (${Math.min(...it.kwh)}–${Math.max(...it.kwh)})` : '';
  const fuel = (it.made ? `${mass(madeG(it)[1])} making it + ` : '') + (it.g && it.kwh ? `${mass(it.g[1])} from fuel + ` : '');
  const elec = it.kwh ? ` = ${fuel}${it.kwh[1]} kWh${kwhRng} × ${GRIDS[region][1]} g/kWh, ${GRIDS[region][0]} grid` : '';
  const made = it.made ? `<br>${esc(it.made[1])}: ${span(madeG(it)[0], madeG(it)[2], mass) || mass(madeG(it)[1])}` : '';
  // Working: each term as amount × factor = grams.
  const work = it.calc ? `<p>${it.calc.map(([f, n, what]) => f
    ? `${esc(what)} × ${fmt(+(FACTORS[f].g / 1000).toPrecision(3))} kg CO₂e per ${FACTORS[f].unit} ${esc(FACTORS[f].name)} = ${mass(term([f, n]))}`
    : `${esc(what)}: ${mass(n)}`).join('<br>')}${made}</p>` : it.made ? `<p>${made.slice(4)}</p>` : '';
  const factors = [...new Set((it.calc || []).map(([f]) => f).filter(Boolean))]
    .map((f) => `<li>${esc(FACTORS[f].name)}: ${FACTORS[f].src.map(link).join('; ')}</li>`).join('');
  const checks = (it.checks || []).map(([t, url, g]) => `<li>${link([t, url])}: ${mass(g)}</li>`).join('');
  const per = it.km ? ' per km' : it.amt ? '' : ' each';
  return `${esc(it.name)}${it.amt ? size(it) : ''}: average ${mass(mid)}${per} ${unc(it)}${elec}${perTrip}; least to most possible ${rng || mass(mid)}.
    ${esc(it.note)}${it.local ? ` ${esc(it.local)}` : ''}${work}<ul>${it.src.map((s) => `<li>${link(s)}</li>`).join('')}${factors}</ul>${checks ? `Checks:<ul>${checks}</ul>` : ''}`;
}
const source = (it, summary) => `<details><summary>${summary}</summary>${sourceBody(it)}</details>`;
// A row's sources open under it from the arrow on the left; the row itself links to the item.
const tog = `<button class="tog" aria-expanded="false" aria-label="Sources" title="Sources">${icon('chevron-right')}</button>`;
addEventListener('click', (e) => {
  const b = e.target.closest('.tog');
  if (!b) return;
  const open = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', open);
  b.parentElement.querySelector('.src').hidden = !open;
});

function renderNav() {
  $('#qlink').classList.toggle('on', asking);
  $('#cats').innerHTML = Object.entries(CATS)
    .map(([c, ic]) => `<button data-cat="${c}" class="${!asking && c === cat ? 'on' : ''}">${icon(ic)}${esc(c)}</button>`).join('');
  $('#subs').hidden = asking;
  if (asking) return;
  $('#subs').innerHTML = Object.values(groups).filter((g) => g[0].cat === cat)
    .sort((a, b) => grams(b[0])[1] - grams(a[0])[1])
    .map(([d]) => `<a href="#${d.id}" class="${d.item === sel.item ? 'on' : ''}${weak(d) ? ' weak' : ''}">${icon(d.icon)}${esc(d.item)}</a>`).join('');
}
$('#cats').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  // From the questions page, a category opens its first item.
  if (asking) location.hash = ITEMS.find((it) => it.cat === b.dataset.cat).id;
  else { cat = b.dataset.cat; renderNav(); }
};

function renderHead() {
  const vs = groups[sel.item];
  // Shown even for a single variant, so it is clear which exact item the figure is for.
  $('#variants').innerHTML = vs.map((v) => `<a href="#${v.id}" class="${v === sel ? 'on' : ''}${weak(v) ? ' weak' : ''}">${esc(v.name)}</a>`).join('');
  const what = sel.km ? 'km by ' + lc(sel.name) : sel.amt ? `${sel.unit} ${lc(sel.name)}` : '× ' + sel.name;
  $('#big').innerHTML = `${icon(sel.icon)}<div><span id="what"><input id="qty" type="text" inputmode="decimal"
    value="${qty}" aria-label="Amount" title="Change the amount"> ${esc(what)}${star(sel)}<span id="avg"></span>
    <select id="often" aria-label="How often">${Object.entries(OFTEN).map(([k, [label]]) => `<option value="${k}"${k === often ? ' selected' : ''}>${label}</option>`).join('')}</select></span><b id="total"></b>
    <span id="person"></span>${weak(sel) ? '<span id="weak">Uncertain: estimates differ by 2× or more.</span>' : ''}${sel.model ? `<span id="model">Model: ${esc(sel.model)}</span>` : ''}</div>`;
  const input = $('#qty');
  const fit = () => { input.style.width = Math.max(1, input.value.length) + 1 + 'ch'; };
  fit();
  input.oninput = () => {
    fit();
    const v = parseFloat(input.value);
    if (Number.isFinite(v) && v > 0) { qty = v; save(); renderRows(); }
  };
  $('#often').onchange = () => { often = $('#often').value; save(); renderRows(); };
}

// Widest honest ratio: a non-positive divisor leaves no upper limit.
function ratio([xLo, xMid, xHi], [yLo, yMid, yHi]) {
  const [a, b] = [Math.max(xLo / yHi, 0), yLo > 0 ? xHi / yLo : Infinity];
  return isFinite(b) ? numSpan(a, b) || num(xMid / yMid) : `${num(a)} or more`;
}

// An amount of an item in words, e.g. '11 900 km by petrol car', with ', every day' when repeated.
// bare: just the name, when the amount is the default and saying it would only lengthen the row.
function label(it, n, o = 'once', bare) {
  const a = bare && o === 'once' ? lc(it.name) : it.km ? `${fmt(n)} km by ${lc(it.name)}`
    : it.amt ? `${fmt(n)} ${it.unit} ${lc(it.name)}` : `${fmt(n)} × ${lc(it.name)}`;
  return a + (o === 'once' ? '' : `, every ${o}`);
}

function renderRows() {
  const [lo, mid, hi] = perOne(sel).map((g) => g * annual(qty, often));
  const rng = span(lo, hi, mass);
  $('#avg').textContent = avg(sel) && qty === deflt(sel) ? ` (${avg(sel)})` : '';
  $('#total').textContent = (rng || mass(mid)) + ' CO₂e' + (often === 'once' ? '' : ' a year');
  $('#person').textContent = sel.id === 'person-year' ? ''
    : `What the average person emits in ${rng && lo > 0 && time(lo) !== time(hi) ? `${time(lo)} to ${time(hi)}` : time(mid)}.`;
  $('#detail').innerHTML = source(sel, `${unc(sel)} · how it's worked out`);
  // Well-sourced items are compared against; faded ones only when 'Include uncertain' is ticked, marked low confidence.
  const others = Object.values(groups).filter((g) => g[0].item !== sel.item && (unsure || !weak(g[0]))).map((g) => g[0])
    .sort((a, b) => grams(a)[1] - grams(b)[1]);
  // Bars: each item's footprint on a log scale.
  const logs = ITEMS.map((it) => Math.log(grams(it)[1])).concat(Math.log(mid));
  // The scale starts a little below the smallest item, so even that one gets a visible bar.
  const [lMin, lMax] = [Math.min(...logs) - 1, Math.max(...logs)];
  const pct = (g) => ((Math.log(g) - lMin) / (lMax - lMin)).toFixed(3);
  const mine = [lo, mid, hi];
  // Smaller items: how many of them match yours. Bigger ones: how many of yours match one of them.
  const smaller = others.filter((it) => grams(it)[1] <= mid), bigger = others.filter((it) => grams(it)[1] > mid);
  // Your item in the bigger rows: just its icon, named in the tooltip.
  const yours = `<span class="eq" title="${esc(label(sel, qty, often))}">${icon(sel.icon)} =</span>`;
  const list = (el, items, row) => {
    const rows = items.map((it) => [row(it), it]);
    // Multipliers sit in one right-aligned column, as wide as the longest.
    el.style.setProperty('--w', Math.max(0, ...rows.map(([[m]]) => m.length)) + 2 + 'ch');
    el.innerHTML = rows.map(([[m, text], it]) => `<li style="--bar:${pct(grams(it)[1])}"${weak(it) ? ' class="low"' : ''}>${tog}<a href="#${it.id}" title="${esc(it.name)}"><b>${m} ×</b> ${text}${weak(it) ? ' <small>low confidence</small>' : ''}</a>
      <div class="src" hidden>${sourceBody(it)}</div></li>`).join('');
    el.previousElementSibling.hidden = !items.length;
  };
  const name = (it) => `${icon(it.icon)} ${esc(it.name)}${size(it)}${star(it)}`;
  list($('#rows'), smaller, (it) => [ratio(mine, grams(it)), name(it)]);
  list($('#rows2'), bigger, (it) => [ratio(grams(it), mine), `${yours} ${name(it)}`]);
  renderSwitches();
}

function renderSwitches() {
  const link = (id, label = byId[id].name) => `<a href="#${id}">${esc(label)}</a>`;
  $('#switches').innerHTML = switches.filter((s) => [s.upfront, s.instead, s.per, s.minus].includes(sel.id)).map((s) => {
    // Upfront counts a whole item; savings count one km, gram, kWh, etc.
    const up = grams(byId[s.upfront]), minus = s.minus ? grams(byId[s.minus]) : [0, 0, 0];
    // Each use: running only; making the new car is the upfront part.
    const before = perOne(byId[s.instead], true), after = s.per ? perOne(byId[s.per], true) : [0, 0, 0];
    const net = [up[0] - minus[2], up[1] - minus[1], up[2] - minus[0]];
    const saving = [before[0] - after[2], before[1] - after[1], before[2] - after[0]];
    const n = [0, 1, 2].map((i) => saving[2 - i] > 0 ? Math.max(0, net[i]) / saving[2 - i] : Infinity);
    const counts = (a, b) => !isFinite(a) ? 'never' : !isFinite(b) ? `${num(a)} to never` : numSpan(a, b) || num(a);
    const uses = view === 'range' ? counts(n[0], n[2]) : num(n[1]);
    // Under a year reads better in months.
    const yrs = s.perYear && n.map((x) => x / s.perYear.n);
    const [k, u] = yrs && (view === 'range' ? yrs[2] : yrs[1]) < 1 ? [12, 'months'] : [1, 'years'];
    const years = s.perYear && saving[1] > 0 ? ` (about ${view === 'range' ? counts(yrs[0] * k, yrs[2] * k) : sig(yrs[1] * k)} ${u} at ${num(s.perYear.n)} ${esc(s.unit)} a year)` : '';
    const result = saving[1] <= 0 ? 'Never pays back on this grid' : `pays back after ${uses} ${esc(s.unit)}${years}`;
    const [a, b] = s.name.split(' instead of ');
    const name = b ? `${link(s.upfront, a)} instead of ${link(s.instead, b)}` : esc(s.name);
    const figures = [s.upfront, s.minus, s.instead, s.per].filter(Boolean).map((id) => source(byId[id], esc(byId[id].name))).join('');
    return `<li><span>${name}: ${result}.</span><details><summary>figures · sources</summary>
      <p>Upfront: ${link(s.upfront)}${s.minus ? ` minus ${link(s.minus)}` : ''}. Each use: ${s.per ? link(s.per) : 'nothing'} instead of ${link(s.instead)}.</p>${s.note ? `<p>${esc(s.note)}</p>` : ''}${s.perYear ? `<p>A year: <a href="${esc(s.perYear.src[1])}" rel="noopener">${esc(s.perYear.src[0])}</a></p>` : ''}${figures}</details></li>`;
  }).join('');
  $('#break-even').hidden = !$('#switches').children.length;
}

// Each question: its two sides as bars on one linear scale, and how many times the first is the second.
function renderQuestions() {
  const total = ([id, n, o]) => perOne(byId[id]).map((g) => g * annual(n, o));
  const footprint = ([lo, mid, hi]) => span(lo, hi, mass) || mass(mid);
  $('#qlist').innerHTML = questions.map(({ q, a, b }) => {
    const [ta, tb] = [total(a), total(b)], top = Math.max(ta[1], tb[1]);
    const bar = (side, t) => `<div class="qbar">${icon(byId[side[0]].icon)}<span>${esc(label(byId[side[0]], side[1], side[2]))}</span><b>${footprint(t)}</b>
      <i style="--w:${(100 * t[1] / top).toFixed(1)}%"></i></div>`;
    // The first side against the second: "about the same" when the ratio could be 1 or is near it.
    const r = ta[1] / tb[1], fuzzy = ta[0] <= tb[2] && ta[2] >= tb[0];
    const verdict = (fuzzy && ta[0] !== ta[2]) || (r > 0.8 && r < 1.25) ? 'about the same'
      : r > 1 ? `${ratio(ta, tb)} × more` : `${ratio(tb, ta)} × less`;
    const low = weak(byId[a[0]]) || weak(byId[b[0]]) ? ' <small>low confidence</small>' : '';
    return `<li><a href="${hash(...a)}">${esc(q)} <b>${verdict}</b>${low}</a>${bar(a, ta)}${bar(b, tb)}</li>`;
  }).join('');
}

const rerender = () => (asking ? renderQuestions() : renderRows());

function render() {
  const [id, n, o] = location.hash.slice(1).split('/');
  asking = id === 'questions';
  $('#item').hidden = asking;
  $('#qpage').hidden = !asking;
  if (asking) { renderNav(); renderQuestions(); return; }
  sel = byId[id] || ITEMS[0];
  qty = Number.isFinite(+n) && +n > 0 ? +n : deflt(sel);
  often = Object.hasOwn(OFTEN, o) ? o : 'once';
  cat = sel.cat;
  renderNav();
  renderHead();
  renderRows();
}

const viewBtns = [...document.querySelectorAll('#views button[data-v]')];
const showView = () => viewBtns.forEach((b) => b.classList.toggle('on', b.dataset.v === view));
viewBtns.forEach((b) => { b.onclick = () => {
  view = b.dataset.v;
  localStorage.setItem('view', view);
  showView();
  rerender();
}; });
showView();
const unsureBtn = $('#unsure');
const showUnsure = () => { unsureBtn.checked = unsure; };
unsureBtn.onchange = () => {
  unsure = unsureBtn.checked;
  localStorage.setItem('unsure', unsure ? '1' : '0');
  showUnsure();
  rerender();
};
showUnsure();

const regionSel = $('#region');
regionSel.innerHTML = Object.entries(GRIDS)
  .map(([k, [n]]) => `<option value="${k}">Electricity: ${n}</option>`).join('');
regionSel.value = region;
regionSel.onchange = () => {
  region = regionSel.value;
  localStorage.setItem('region', region);
  regroup();
  renderNav();
  rerender();
  renderFoot();
};
function renderFoot() {
  $('#gridnote').innerHTML = `* Runs on electricity: ${GRIDS[region][0]} grid, ${GRIDS[region][1]} g CO₂e per kWh in 2025, power plants included
    (<a href="${GRID_SOURCE[1]}" rel="noopener">${GRID_SOURCE[0]}</a>). Guessed from your timezone; change it at the top.`;
}

addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
render();
renderFoot();
