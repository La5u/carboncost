const $ = (s) => document.querySelector(s);
const byId = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
// Calculated items: the average is the sum of amount × shared factor (FACTORS in data.js);
// a term without a factor is a fixed number of grams.
const term = ([f, n]) => (f ? n * FACTORS[f].g : n);
for (const it of ITEMS) if (it.calc) {
  const g = it.calc.reduce((sum, t) => sum + term(t), 0);
  it.g = [it.g?.[0] ?? g, g, it.g?.[2] ?? g];
}
// Item label → its variants; the first variant is the default.
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

const knownGrid = (grid) => Object.hasOwn(GRIDS, grid) ? grid : null;
let preferredRegion = knownGrid(localStorage.getItem('region'));
let region, explicitRegion;
const withGrid = (fragment) => explicitRegion ? `${fragment}/grid=${explicitRegion}` : fragment;
function splitGrid(fragment) {
  const parts = fragment.split(/[?&]/, 1)[0].split('/');
  const grid = parts.find((part) => part.startsWith('grid='));
  return [parts.filter((part) => !part.includes('=')).join('/'), grid ? knownGrid(grid.slice(5)) : null];
}
// Amount of the selected item: units, km for trips, or its own unit (g, ml, min…). Starts at the default amount.
let sel, cat, qty, times, often, asking;
const OFTEN = { once: ['once', 1], day: ['daily', 365.25], week: ['weekly', 52.18], month: ['monthly', 12], year: ['yearly', 1] };
const annual = (n, o) => n * (OFTEN[o]?.[1] || 1);
function readAmount(value = '') {
  const decimal = value.trim().replace(',', '.');
  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(decimal)) return null;
  const n = Number(decimal);
  return Number.isFinite(n) && n > 0 ? n : null;
}
const amount = () => annual(qty * times, often);
const validAmount = (n) => Number.isFinite(n) && n > 0;
const itemHash = (id) => withGrid(`#${id}`);
const hash = (id, n, o, t = 1) => withGrid(`#${id}/${n}${t !== 1 ? '/' + (o || 'once') + '/' + t : o && o !== 'once' ? '/' + o : ''}`);
const save = () => {
  if (validAmount(amount())) history.replaceState(null, '', hash(sel.id, qty, often, times));
};
// Warn once, rather than on every change of amount or grid.
const valid = (rows, ids) => rows.filter((row) => {
  const missing = ids(row).filter((id) => id && !byId[id]);
  if (missing.length) console.warn(`Skipping ${row.id || row.q}: missing ${missing.join(', ')}`);
  return !missing.length;
});
const switches = valid(SWITCHES, (s) => [s.upfront, s.instead, s.per, s.minus]);
const questions = valid(QUESTIONS, (q) => [q.a[0], q.b[0]]);
// Average uses the central estimate when available. Range uses the low and high estimates.
let view = localStorage.getItem('view') === 'range' ? 'range' : 'avg';

const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
// [low, central, high] for a view: the full range, or just the average.
const pick = (a, v) => (v === 'range' || a[1] == null ? a : [a[1], a[1], a[1]]);
const gridFor = (it) => GRIDS[it.remote ? 'WORLD' : region];
const electric = (it) => it.kwh || it.remoteKwh;
// Making the vehicle or device, its share per unit: one figure or [low, central, high].
const madeG = (it) => (Array.isArray(it.made[0]) ? it.made[0] : [it.made[0], it.made[0], it.made[0]]);
// As given: per unit, per km for trips, or per amt of unit. use: only running it, without making it.
const perUnit = (it, v = view, use) => {
  const grid = gridFor(it)[1], world = GRIDS.WORLD[1];
  const electricity = it.kwh && scaled(it.kwh, grid);
  const remote = it.remoteKwh && scaled(it.remoteKwh, world);
  const parts = [it.g, electricity, remote, it.made && !use && madeG(it)].filter(Boolean);
  const totals = [0, 1, 2].map((i) => parts.reduce((sum, part) => sum == null || part[i] == null ? null : sum + part[i], 0));
  if (it.deviceScenarios) {
    const devices = it.deviceScenarios.map(({ made, kwh, remoteKwh }) => (use ? 0 : made) + kwh * grid + remoteKwh * world);
    return pick([Math.min(...devices), totals[1], Math.max(...devices)], v);
  }
  if (totals[0] > totals[2]) [totals[0], totals[2]] = [totals[2], totals[0]];
  return pick(totals, v);
};
const scaled = (range, n) => Array.from(range, (g) => g == null ? null : g * n);
// For the default amount: one unit, a default trip, or amt of unit.
const grams = (it, v, use) => scaled(perUnit(it, v, use), it.km || 1);
const deflt = (it) => it.km || it.amt || 1;
// Per one of whatever qty counts.
const perOne = (it, use, v = view) => scaled(perUnit(it, v, use), 1 / (it.amt || 1));
// Sort range-only items by the middle of their interval. The bars show both ends.
// The average, or else the middle of the range on a log scale.
const position = ([lo, mid, hi]) => mid ?? (lo > 0 ? Math.sqrt(lo * hi) : (lo + hi) / 2);
const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0];
// What the default amount is, e.g. 'average'.
const avg = (it) => it.avg ?? (it.km ? 'average trip' : '');
const weak = (it) => it.unc >= 100 || it.unc === 'single' || it.unc === 'limited' || it.unc === 'range';
const comparisonView = (it) => weak(it) ? 'range' : view;
const confidence = {
  10: 'Measured or calculated from physics',
  25: 'Well supported for this item',
  50: 'Comparable averages within 1.5×',
  100: 'Comparable averages up to 2× apart',
  200: 'Comparable averages more than 2× apart',
  single: 'One source for this estimate',
  limited: 'Limited evidence for a typical estimate',
  range: 'No comparable average available',
};
const unc = (it) => confidence[it.unc];
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// Footnote marks: * runs on electricity, † food (counted as bought).
const star = (it) => (electric(it) ? '*' : '') + (it.cat === 'Food & drink' ? '†' : '');
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
const footprint = ([lo, , hi]) => span(lo, hi, mass) || mass(lo);
const link = ([t, url]) => (url ? `<a href="${url}" rel="noopener">${esc(t)}</a>` : esc(t));
function sourceBody(it) {
  const estimates = perUnit(it, 'range');
  const mid = estimates[1];
  const trip = it.km && grams(it, mid == null ? 'range' : 'avg');
  const perTrip = trip ? `. ${fmt(it.km)} km (${avg(it)}): ${footprint(trip)}` : '';
  // The electricity scenarios can run in either direction when paired with fuel.
  const kwhRng = it.kwh && it.kwh[0] !== it.kwh[2] ? ` (${Math.min(it.kwh[0], it.kwh[2])}–${Math.max(it.kwh[0], it.kwh[2])})` : '';
  const fixed = (it.made && mid != null ? `${mass(madeG(it)[1])} making it + ` : '')
    + (it.g && it.kwh && mid != null ? `${mass(it.g[1])} ${it.direct || 'from fuel'} + ` : '');
  const [gridName, intensity] = gridFor(it);
  const kwh = (n) => fmt(n, { maximumSignificantDigits: 4 });
  const delivery = it.remoteKwh ? ` + ${kwh(it.remoteKwh[1])} kWh × ${GRIDS.WORLD[1]} g/kWh, world grid for delivery` : '';
  const elec = !it.kwh ? '' : mid == null ? `. Electricity uses the ${gridName} grid at ${intensity} g/kWh`
    : ` = ${fixed}${kwh(it.kwh[1])} kWh${it.remoteKwh ? '' : kwhRng} × ${intensity} g/kWh, ${gridName} grid${delivery}`;
  const made = it.made ? `<br>${esc(it.made[1])}: ${footprint(madeG(it))}` : '';
  // Working: each term as amount × factor = grams.
  const work = it.calc ? `<p>${it.calc.map(([f, n, what]) => f
    ? `${esc(what)} × ${fmt(+(FACTORS[f].g / 1000).toPrecision(3))} kg CO₂e per ${FACTORS[f].unit} ${esc(FACTORS[f].name)} = ${mass(term([f, n]))}`
    : `${esc(what)}: ${mass(n)}`).join('<br>')}${made}</p>` : it.made ? `<p>${made.slice(4)}</p>` : '';
  const factors = [...new Set((it.calc || []).map(([f]) => f).filter(Boolean))]
    .map((f) => `<li>${esc(FACTORS[f].name)}: ${FACTORS[f].src.map(link).join('; ')}</li>`).join('');
  const checks = (it.checks || []).map(([t, url, g]) => `<li>${link([t, url])}: ${mass(g)}</li>`).join('');
  const per = it.km ? ' per km' : it.amt ? '' : ' each';
  const range = estimates[0] === estimates[2] ? '' : `${it.rangeLabel || 'Reported range'}: ${footprint(estimates)}${per}`;
  const headline = mid == null ? `${range || footprint(estimates) + per}. No average available${elec}${perTrip}`
    : `${it.estimate || 'Average'}: ${mass(mid)}${per}${elec}${perTrip}${range ? `. ${range}` : ''}`;
  return `${esc(it.name)}${it.amt ? size(it) : ''}: ${headline}.
    ${esc(it.note)}${it.local ? ` ${esc(it.local)}` : ''}<p>${esc(unc(it))}.</p>${work}<ul>${it.src.map((s) => `<li>${link(s)}</li>`).join('')}${factors}</ul>${checks ? `Checks:<ul>${checks}</ul>` : ''}`;
}
const source = (it, summary, arrow = false) => `<details data-source="${it.id}"><summary${arrow ? ' class="tog" aria-label="Sources" title="Sources"' : ''}>${summary}</summary><div class="src"></div></details>`;
function fillSource(details) {
  const it = byId[details.dataset.source];
  const grid = electric(it) ? gridFor(it)[0] : '';
  if (details.dataset.grid === grid) return;
  details.lastElementChild.innerHTML = sourceBody(it);
  details.dataset.grid = grid;
}
document.addEventListener('toggle', (e) => {
  if (e.target.matches('details[data-source][open]')) fillSource(e.target);
}, true);

function renderNav() {
  $('#qlink').classList.toggle('on', asking);
  $('#cats').innerHTML = Object.entries(CATS)
    .map(([c, ic]) => `<button data-cat="${c}" class="${!asking && c === cat ? 'on' : ''}">${icon(ic)}${esc(c)}</button>`).join('');
  $('#subs').hidden = asking;
  if (asking) return;
  $('#subs').innerHTML = Object.values(groups).filter((g) => g[0].cat === cat)
    .sort((a, b) => position(grams(b[0])) - position(grams(a[0])))
    .map(([d]) => `<a href="${itemHash(d.id)}" class="${!$('#item').hidden && d.item === sel?.item ? 'on' : ''}${weak(d) ? ' weak' : ''}">${icon(d.icon)}${esc(d.item)}</a>`).join('');
}
$('#cats').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  // From the questions page, a category opens its first item.
  if (asking) location.hash = itemHash(ITEMS.find((it) => it.cat === b.dataset.cat).id);
  else { cat = b.dataset.cat; renderNav(); }
};

function renderVariants() {
  const vs = groups[sel.item] || [sel];
  // Shown even for a single variant, so it is clear which exact item the figure is for.
  $('#variants').innerHTML = vs.map((v) => `<a href="${itemHash(v.id)}" class="${v === sel ? 'on' : ''}${weak(v) ? ' weak' : ''}">${esc(v.name)}</a>`).join('');
}

function renderHead() {
  const what = sel.km ? 'km by ' + lc(sel.name) : sel.amt ? `${sel.unit} ${lc(sel.name)}` : '× ' + sel.name;
  const count = sel.km || sel.amt ? `<input id="times" type="text" inputmode="decimal" value="${times}"
    aria-label="How many times" title="Change how many times"> × ` : '';
  const confidenceNote = sel.unc !== 'range' && weak(sel) ? `<span id="weak">${esc(unc(sel))}.</span>` : '';
  $('#big').innerHTML = `${icon(sel.icon)}<div><span id="what">${count}<input id="qty" type="text" inputmode="decimal"
    value="${qty}" aria-label="Amount" title="Change the amount"> ${esc(what)}${star(sel)}<span id="avg"></span></span>
    <span id="often" role="group" aria-label="How often">${Object.entries(OFTEN).map(([k, [label]]) => `<button type="button" data-o="${k}" class="${k === often ? 'on' : ''}" aria-pressed="${k === often}">${label}</button>`).join('')}</span><b id="total"></b>
    <span id="person"></span>${confidenceNote}${sel.model ? `<span id="model">Model: ${esc(sel.model)}</span>` : ''}</div>`;
  document.querySelectorAll('#qty, #times').forEach((input) => {
    const fit = () => { input.style.width = Math.max(1, input.value.length) + 1 + 'ch'; };
    fit();
    input.onfocus = () => input.select();
    input.oninput = () => {
      fit();
      const v = readAmount(input.value);
      input.setAttribute('aria-invalid', v == null);
      if (input.id === 'qty') qty = v;
      else times = v;
      save();
      renderRows();
    };
  });
  $('#often').onclick = (e) => {
    const b = e.target.closest('button[data-o]');
    if (!b) return;
    often = b.dataset.o;
    save();
    for (const button of $('#often').querySelectorAll('button')) {
      button.classList.toggle('on', button === b);
      button.setAttribute('aria-pressed', button === b);
    }
    renderRows();
  };
}

// Widest honest ratio: a non-positive divisor leaves no upper limit.
function ratio([xLo, xMid, xHi], [yLo, yMid, yHi]) {
  const [a, b] = [Math.max(xLo / yHi, 0), yLo > 0 ? xHi / yLo : Infinity];
  if (!Number.isFinite(b)) return Number.isFinite(a) ? `${num(a)} or more` : '–';
  return numSpan(a, b) || num(xMid == null || yMid == null ? a : xMid / yMid);
}

// An amount of an item in words, e.g. '11 900 km by petrol car', with ', every day' when repeated.
// bare: just the name, when the amount is the default and saying it would only lengthen the row.
function label(it, n, o = 'once', bare, t = 1) {
  const a = bare && o === 'once' ? lc(it.name) : it.km ? `${fmt(n)} km by ${lc(it.name)}`
    : it.amt ? `${fmt(n)} ${it.unit} ${lc(it.name)}` : `${fmt(n)} × ${lc(it.name)}`;
  return (t === 1 ? '' : `${fmt(t)} × `) + a + (o === 'once' ? '' : `, every ${o}`);
}

const comparisonRows = new Map();
const rowLists = [$('#rows'), $('#rows2')];
function renderRows() {
  const n = amount();
  const mine = scaled(perOne(sel), n);
  const [lo, mid, hi] = mine;
  $('#avg').textContent = avg(sel) && qty === deflt(sel) ? ` (${avg(sel)})` : '';
  if (!validAmount(n) || !Number.isFinite(lo) || !Number.isFinite(hi) || (mid != null && !Number.isFinite(mid))) {
    $('#total').textContent = '–';
    $('#person').textContent = '';
    for (const el of rowLists) el.hidden = el.previousElementSibling.hidden = true;
    return;
  }
  $('#total').textContent = footprint(mine) + ' CO₂e' + (often === 'once' ? '' : ' a year');
  const duration = lo < 0 ? null : time(lo) === time(hi) ? time(lo) : `${time(lo)} to ${time(hi)}`;
  const equivalent = sel.id === 'person-year' || !duration ? '' : `What the average person emits in ${duration}.`;
  const basis = mid == null ? 'No average available.' : sel.estimate ? `${sel.estimate}.` : '';
  const rangeNote = view === 'range' ? sel.rangeNote : '';
  $('#person').textContent = [basis, equivalent, rangeNote].filter(Boolean).join(' ');
  const others = Object.values(groups).map(([it]) => it).filter((it) => it.item !== sel.item)
    .map((it) => [it, grams(it, comparisonView(it))]).sort((a, b) => position(a[1]) - position(b[1]));
  // Bars: each item's footprint on a log scale.
  const logs = [...ITEMS.flatMap((it) => grams(it, comparisonView(it))), lo, hi].filter((g) => g > 0).map(Math.log);
  // The scale starts a little below the smallest item, so even that one gets a visible bar.
  const [lMin, lMax] = [Math.min(...logs) - 1, Math.max(...logs)];
  const x = (g) => g > 0 ? Math.max(0, (Math.log(g) - lMin) / (lMax - lMin)) : 0;
  // Smaller items: how many of them match yours. Bigger ones: how many of yours match one of them.
  // Overlapping ranges go by their average, or the middle of the range; the ratio shows the full range.
  const smaller = others.filter(([, g]) => position(g) <= position(mine));
  const bigger = others.filter(([, g]) => position(g) > position(mine));
  const yours = label(sel, qty, often, false, times);
  const list = (el, items, larger) => {
    const multipliers = items.map(([, g]) => `${larger ? ratio(g, mine) : ratio(mine, g)} ×`);
    // Multipliers sit in one right-aligned column, as wide as the longest.
    el.style.setProperty('--w', Math.max(0, ...multipliers.map((m) => m.length)) + 2 + 'ch');
    items.forEach(([it, g], i) => {
      let row = comparisonRows.get(it.id);
      if (!row) {
        row = document.createElement('li');
        row.classList.toggle('low', weak(it));
        row.innerHTML = `${source(it, icon('chevron-right'), true)}<a title="${esc(it.name)}"><b></b> <span class="eq">${icon(sel.icon)} =</span>
          ${icon(it.icon)} ${esc(it.name)}${size(it)}${star(it)}</a>`;
        comparisonRows.set(it.id, row);
      }
      // The bar runs from the low estimate (or zero) to the high one: dark up to the low estimate, light beyond it.
      // A footprint that can fall below zero extends left of the start, past the edge,
      // in proportion to its high estimate: a log scale has no room for zero or less.
      const r = x(g[2]), l = g[0] < 0 && g[2] > 0 ? r * g[0] / g[2] : 0;
      row.style.setProperty('--l', l.toFixed(3));
      row.style.setProperty('--r', r.toFixed(3));
      // Dark: up to the low estimate, or the part below zero. Light: the rest of the range.
      const d = r <= l ? 0 : g[0] > 0 ? x(g[0]) / r : -l / (r - l);
      row.style.setProperty('--d', (d * 100).toFixed(1) + '%');
      const link = row.lastElementChild;
      link.setAttribute('href', itemHash(it.id));
      link.firstElementChild.textContent = multipliers[i];
      const eq = link.querySelector('.eq');
      eq.hidden = !larger;
      eq.title = yours;
      if (el.children[i] !== row) el.insertBefore(row, el.children[i] || null);
    });
    el.hidden = el.previousElementSibling.hidden = !items.length;
  };
  // Put a row in its new list before trimming stale rows, so its disclosure can stay open.
  list(rowLists[0], smaller, false);
  list(rowLists[1], bigger, true);
  for (const [i, count] of [smaller.length, bigger.length].entries()) {
    const el = rowLists[i];
    while (el.children.length > count) el.lastElementChild.remove();
  }
}

function pairedPaybacks(s, grid) {
  const distances = s.pairs.map(({ petrolMade, evMade, petrolGPerKm, evKwhPerKm, gridGPerKwh }) => {
    const saving = petrolGPerKm - evKwhPerKm * (grid ?? gridGPerKwh);
    const upfront = evMade - (s.minus ? petrolMade : 0);
    return saving > 0 ? Math.max(0, upfront) / saving : Infinity;
  });
  return [Math.min(...distances), distances[0], Math.max(...distances)];
}

function itemPaybacks(s, discrete) {
  // Upfront counts a whole item; savings count one km, gram, kWh, etc.
  const up = grams(byId[s.upfront]), minus = s.minus ? grams(byId[s.minus]) : [0, 0, 0];
  // Each use: running only; making the new car is the upfront part.
  const instead = byId[s.instead];
  const before = perOne(instead, true), after = s.per ? perOne(byId[s.per], true) : [0, 0, 0];
  return [0, 1, 2].map((i) => {
    const [cost, credit, oldUse, newUse] = [up[i], minus[2 - i], before[2 - i], after[i]];
    if ([cost, credit, oldUse, newUse].includes(null)) return null;
    const uses = oldUse > newUse ? Math.max(0, cost - credit) / (oldUse - newUse) : Infinity;
    return discrete ? Math.ceil(uses) : uses;
  });
}

function paybackCounts(a, b, whole = false) {
  if (!Number.isFinite(a)) return 'never';
  const format = whole ? fmt : num;
  if (!Number.isFinite(b)) return `${format(a)} to never`;
  return (whole ? span(a, b, fmt) : numSpan(a, b)) || format(a);
}

function payback(s, grid) {
  const instead = byId[s.instead];
  const discrete = !instead.km && !instead.amt;
  const n = s.pairs ? pairedPaybacks(s, grid) : itemPaybacks(s, discrete);
  const ranged = view === 'range' || n[1] == null;
  if (!Number.isFinite(ranged ? n[0] : n[1])) return 'No payback';
  const uses = ranged ? paybackCounts(n[0], n[2], discrete) : s.pairs ? fmt(Math.round(n[1])) : (discrete ? fmt : num)(n[1]);
  if (s.minimum) return `at least ${uses} ${s.unit} in this study (additional cleaning excluded)`;
  // Under a year reads better in months.
  const yrs = s.perYear && scaled(n, 1 / s.perYear.n);
  const [k, u] = yrs && (ranged ? yrs[2] : yrs[1]) < 1 ? [12, 'months'] : [1, 'years'];
  const years = yrs ? ` (about ${ranged ? paybackCounts(yrs[0] * k, yrs[2] * k) : sig(yrs[1] * k)} ${u} at ${num(s.perYear.n)} ${s.unit} per year in the EU)` : '';
  return `pays back after ${uses} ${s.unit}${years}${n[1] == null ? '. No average available' : ''}`;
}

function pairedGridSource(s) {
  const [name, intensity] = GRIDS[region];
  const [lo, mid, hi] = pairedPaybacks(s, intensity);
  const average = Number.isFinite(mid) ? `${fmt(Math.round(mid))} km for the average pair` : 'no payback for the average pair';
  const range = Number.isFinite(lo) ? ` (range ${paybackCounts(lo, hi)} km)` : '';
  return `The ${name} grid uses ${intensity} g/kWh for every pair, giving ${average}${range}. ${link(GRID_SOURCE)}.`;
}

function pairedPaybackSources(s) {
  return `<p>Each kilometre saves the petrol emissions minus the emissions from charging. Divide the ${s.minus ? 'extra emissions from making the electric car' : 'emissions from making the electric car'} by that saving.</p>
    <p class="payback-grid"></p>
    <ul>${s.src.map((entry) => `<li>${link(entry)}</li>`).join('')}</ul>`;
}

function renderSwitches() {
  const list = $('#switches');
  const relevant = switches.filter((s) => [s.upfront, s.instead, s.per, s.minus, s.related].includes(sel.id));
  if (list.dataset.item !== sel.id) {
    const itemLink = (id, label = byId[id].name) => `<a href="${itemHash(id)}">${esc(label)}</a>`;
    list.innerHTML = relevant.map((s) => {
      const [a, b] = s.name.split(' instead of ');
      const name = b ? `${itemLink(s.upfront, a)} instead of ${itemLink(s.instead, b)}` : esc(s.name);
      const itemSources = [...new Set([s.upfront, s.minus, s.instead, s.per].filter(Boolean))]
        .map((id) => source(byId[id], esc(byId[id].name))).join('');
      const figures = s.pairs ? pairedPaybackSources(s) : s.src
        ? `<ul>${s.src.map((entry) => `<li>${link(entry)}</li>`).join('')}</ul>`
        : `<p>Upfront: ${itemLink(s.upfront)}${s.minus ? ` minus ${itemLink(s.minus)}` : ''}.${s.result ? '' : ` Each use: ${s.per ? itemLink(s.per) : 'nothing'} instead of ${itemLink(s.instead)}.`}</p>${itemSources}`;
      return `<li><span>${name}: <span class="payback"></span></span><details><summary>figures · sources</summary>
        ${s.note ? `<p>${esc(s.note)}</p>` : ''}${s.perYear ? `<p>A year: ${link(s.perYear.src)}</p>` : ''}${figures}</details></li>`;
    }).join('');
    list.dataset.item = sel.id;
  }
  relevant.forEach((s, i) => {
    const row = list.children[i];
    let result = s.result || payback(s, s.pairs && explicitRegion ? GRIDS[region][1] : undefined);
    if (s.pairs) {
      const [lo, , hi] = pairedPaybacks(s);
      result = explicitRegion
        ? `${result} (${GRIDS[region][0]} grid). Study-grid benchmark: ${paybackCounts(lo, hi)} km`
        : `${result} (study grids)`;
      row.querySelector('.payback-grid').innerHTML = pairedGridSource(s);
    }
    row.querySelector('.payback').textContent = `${result}.`;
  });
  list.querySelectorAll('a[href^="#"]').forEach((a) => { a.href = withGrid(splitGrid(a.hash)[0]); });
  $('#break-even').hidden = !relevant.length;
}

function verdict(a, b, fullA, fullB) {
  const overlap = overlaps(fullA, fullB) ? ' · ranges overlap' : '';
  if (a[0] === a[2] && b[0] === b[2] && a[0] === b[0]) return `about the same · 1 × as much${overlap}`;
  if (a[0] !== a[2] || b[0] !== b[2]) {
    if (a[0] > b[2]) return `${ratio(a, b)} × more${overlap}`;
    if (b[0] > a[2]) return `${ratio(b, a)} × less${overlap}`;
    return `${ratio(a, b)} × as much${overlap}`;
  }
  const r = a[1] / b[1];
  if (r >= 0.8 && r <= 1.25) {
    return `about the same · ${fmt(r, { maximumFractionDigits: 2 })} × as much${overlap}`;
  }
  return r > 1 ? `${num(r)} × more${overlap}` : `${num(1 / r)} × less${overlap}`;
}

// Each question: its two sides as bars on one linear scale, and how many times the first is the second.
function renderQuestions() {
  const total = ([id, n, o], v = comparisonView(byId[id])) => scaled(perOne(byId[id], false, v), annual(n, o));
  $('#qlist').innerHTML = questions.map(({ q, a, b, basis }) => {
    const [ta, tb] = [total(a), total(b)];
    const top = Math.max(ta[2], tb[2]);
    const percent = (g) => top > 0 ? (100 * Math.max(0, g) / top).toFixed(1) : 0;
    const bar = (side, t) => `<div class="qbar">${icon(byId[side[0]].icon)}<span>${esc(label(byId[side[0]], side[1], side[2]))}</span><b>${footprint(t)}</b>
      <i style="--start:${t[0] === t[2] ? 0 : percent(t[0])}%; --end:${percent(t[2])}%"></i></div>`;
    const limited = [a, b].some(([id]) => weak(byId[id]) && byId[id].unc !== 'range');
    const low = limited ? ' <small>limited evidence</small>' : '';
    return `<li><a href="${hash(...a)}">${esc(q)} <b>${verdict(ta, tb, total(a, 'range'), total(b, 'range'))}</b>${low}</a>${bar(a, ta)}${bar(b, tb)}${basis ? `<small>${link(['Driving distance: EU annual average, 2023', basis.src[1]])}</small>` : ''}</li>`;
  }).join('');
}

function rerender() {
  if (asking) renderQuestions();
  else if (!$('#item').hidden) {
    renderRows();
    renderSwitches();
    document.querySelectorAll('#item details[data-source][open]').forEach(fillSource);
  }
}

function render() {
  const [path, grid] = splitGrid(location.hash.slice(1));
  const [id, n, o, t] = path.split('/');
  const retired = Object.hasOwn(RETIRED_ITEMS, id) && RETIRED_ITEMS[id];
  const target = retired?.to || id;
  showRegion(grid || preferredRegion);
  const canonical = withGrid('#' + [target || ITEMS[0].id, ...path.split('/').slice(1)].join('/'));
  if ((explicitRegion || retired?.to) && location.hash !== canonical) history.replaceState(null, '', canonical);
  asking = target === 'questions';
  const unavailable = retired && !retired.to;
  $('#item').hidden = asking || unavailable;
  $('#qpage').hidden = !asking;
  $('#retired').hidden = !unavailable;
  $('#route-note').hidden = !retired?.to;
  if (retired?.to) {
    $('#route-note').textContent = retired.note;
    if (retired.noteItem) {
      const a = document.createElement('a');
      a.href = itemHash(retired.noteItem);
      a.textContent = byId[retired.noteItem].name;
      $('#route-note').append(' ', a);
    }
  }
  if (unavailable) {
    cat = retired.cat;
    renderNav();
    $('#retired h2').textContent = retired.name;
    $('#retired p').textContent = retired.note;
    return;
  }
  if (asking) { renderNav(); renderQuestions(); return; }
  const next = Object.hasOwn(byId, target) ? byId[target] : ITEMS[0];
  if (sel !== next) {
    comparisonRows.clear();
    rowLists.forEach((el) => el.replaceChildren());
    $('#detail').innerHTML = source(next, 'How it’s worked out');
  }
  sel = next;
  qty = readAmount(n) ?? deflt(sel);
  times = (sel.km || sel.amt) ? readAmount(t) ?? 1 : 1;
  often = Object.hasOwn(OFTEN, o) ? o : 'once';
  cat = sel.cat;
  renderNav();
  renderVariants();
  renderHead();
  rerender();
}

const viewBtns = [...document.querySelectorAll('#views button[data-v]')];
const showView = () => viewBtns.forEach((b) => {
  const active = b.dataset.v === view;
  b.classList.toggle('on', active);
  b.setAttribute('aria-pressed', active);
});
viewBtns.forEach((b) => { b.onclick = () => {
  view = b.dataset.v;
  localStorage.setItem('view', view);
  showView();
  rerender();
}; });
showView();

const regionSel = $('#region');
regionSel.innerHTML = Object.entries(GRIDS)
  .map(([k, [n]]) => `<option value="${k}">Electricity: ${n}</option>`).join('');
regionSel.onchange = () => {
  preferredRegion = regionSel.value;
  localStorage.setItem('region', preferredRegion);
  showRegion(preferredRegion);
  const [path] = splitGrid(location.hash);
  history.replaceState(null, '', withGrid(path && path !== '#' ? path : `#${sel.id}`));
  renderNav();
  if (!$('#item').hidden) renderVariants();
  rerender();
};
function showRegion(grid) {
  explicitRegion = grid;
  region = grid || guessRegion();
  regionSel.value = region;
  regroup();
  $('#qlink').setAttribute('href', itemHash('questions'));
  $('#gridnote').innerHTML = `* Local electricity uses the ${GRIDS[region][0]} grid (${GRIDS[region][1]} g CO₂e per kWh).
    Remote electricity uses the world grid (${GRIDS.WORLD[1]} g CO₂e per kWh). Both figures include power plants
    (${link(GRID_SOURCE)}). ${grid ? 'Change the local grid at the top.' : 'The local grid is guessed from your timezone. You can change it at the top.'}`;
}

addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
render();
