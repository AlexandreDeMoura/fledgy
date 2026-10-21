// The web view of the knowledge base. It is read-only but for one thing: on a Flow's page the
// Builder records a QA Result on each QA Step, one of four states and a note.
// A sidebar is always in view: a search, the Overview and the Changes, then every Area with its
// Flows and its Flows to write. A Flow to write opens in a popover that says how to write it.
// A page per Flow: its facts, then two tabs. "Read the Flow" lists the paths on the left and the
// Steps of the chosen one on the right, each with its Parts, one of which can be opened to show
// where it lives in the code. "Check by hand" holds the path's Manual QA Check: a row per QA Step,
// the current one open to record its result, by click or by key, and move on to the next.
// The Overview says how many Flows are written and how many wait to be, which Flows changed since the
// last commit and in it, and which Flows to write to start with. The Changes is a timeline, newest
// first, of the Flows not committed and of those each of the last commits changed, with the QA Results
// recorded before each change.
// Every term on screen is underlined, and hovering or focusing it shows its sentence from the guide.
// Everything on screen but the Areas folded in the sidebar and the commits unfolded on the Changes is
// addressed by the URL, so any state can be reloaded or shared.

let DATA;
let READ_AT = 0; // when the knowledge base was last read

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const q = (k) => new URL(location.href).searchParams.get(k);
const set = (obj) => `data-set="${esc(JSON.stringify(obj))}"`;
// A change of state within a page replaces the address; going to another page adds one, so Back returns.
function setQ(obj) {
  const u = new URL(location.href);
  for (const [k, v] of Object.entries(obj)) v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v);
  history.replaceState(null, '', u);
  render();
}
function go(href) {
  history.pushState(null, '', href);
  render();
}
window.addEventListener('popstate', () => render());
const flowHref = (fid, extra = {}) => {
  const u = new URLSearchParams({ flow: fid });
  for (const [k, v] of Object.entries(extra)) if (v != null) u.set(k, v);
  return `/?${u}`;
};

// ---------- the words: a tooltip on each term, with its sentence and a link into the guide ----------

const GUIDE = 'https://github.com/AlexandreDeMoura/fledgy/blob/main/docs/words.md';
// One sentence per term the view shows, the same as in docs/words.md, where each term is a heading.
// The last two are the view's own and have no entry in the guide.
const WORDS = {
  flow: ['Flow', 'One thing someone does in your app, from what starts it to what they see at the end, like “Start a thread”.'],
  area: ['Area', 'A region of your app you’d name in conversation, like Chat or Billing. Every Flow belongs to one.'],
  towrite: ['Flow to write', 'A Flow listed now and written later: the app has it, but nobody has described it yet.'],
  uncommitted: ['Not committed', 'Changed on your computer since the last git commit.'],
  variant: ['Variant', 'Another way the Flow can end, like a refusal or a payment that fails. It leaves the main path at one step and never comes back to it.'],
  mainpath: ['Main path', 'The way the Flow goes when nothing goes wrong.'],
  actor: ['Actor', 'Who the Flow is done by: a person in a role, a schedule, or another system.'],
  trigger: ['Trigger', 'What starts the Flow.'],
  system: ['System', 'What the app does in this step, out of sight of the person using it.'],
  part: ['Part', 'A named piece of your app, one thing it can do, described in one sentence. Parts are what point to the code.'],
  entity: ['Entity', 'A Part the app stores and keeps between visits, like a thread, an agent or a light/dark theme setting.'],
  anchor: ['Anchor', 'A pointer from a Part to the place in the code that makes it, on the screen side or the backend side. A click opens it in VS Code.'],
  qachip: ['QA results', 'How many steps of the Flow’s tests by hand (its Manual QA Checks) you recorded as passed.'],
  qa: ['Manual QA Check', 'Steps to test the Flow by hand, ticked in the web view. The main path and each Variant have one.'],
  prepare: ['Prepare', 'What to set up in the app before the first step.'],
  cnp: ['Could not perform', 'You could not try the step, for example because its setup was not possible. It is neither a pass nor a fail.'],
  leaves: ['Leaves the main path', 'From this step on, this Variant goes its own way. The steps before it are the same as the main path’s.', false],
  live: ['Live from knowledge-base/', 'This page shows the files in knowledge-base/. It reads them again each time you come back to the window, so what the agent just wrote shows up.', false],
};
// The guide's anchor for a term: its heading, as GitHub turns it into an id.
const slug = (key) => WORDS[key][0].toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');

// A term where it appears. Inside a button or a link it takes no focus of its own: focusing the control shows it.
const term = (key, html, inControl) => `<span class="d-term" data-term="${key}"${inControl ? '' : ' tabindex="0"'}>${html}</span>`;

const tip = document.createElement('div');
tip.className = 'd-tip';
document.body.appendChild(tip);
let tipFor = null;
let tipTimer;
function showTip(el) {
  const [name, sentence, guided] = WORDS[el.dataset.term];
  clearTimeout(tipTimer);
  tipFor = el;
  tip.innerHTML = `<b>${esc(name)}</b><div>${esc(sentence)}</div>${guided === false ? '' : `<a href="${GUIDE}#${slug(el.dataset.term)}" target="_blank" rel="noopener">More in the guide →</a>`}`;
  tip.style.display = 'block';
  const r = el.getBoundingClientRect();
  tip.style.left = `${Math.min(Math.max(8, r.left - 8), innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top = `${r.bottom + 8 + tip.offsetHeight > innerHeight ? r.top - tip.offsetHeight - 8 : r.bottom + 8}px`;
}
function hideTip() {
  clearTimeout(tipTimer);
  tip.style.display = 'none';
  tipFor = null;
}
// The tooltip stays a moment after the pointer leaves the term, so it can be reached for its link.
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest?.('.d-term');
  if (el) el === tipFor ? clearTimeout(tipTimer) : showTip(el);
  else if (e.target.closest?.('.d-tip')) clearTimeout(tipTimer);
  else if (tipFor) tipTimer = setTimeout(hideTip, 200);
});
document.addEventListener('focusin', (e) => {
  const el = e.target.matches?.('.d-term') ? e.target : e.target.querySelector?.('.d-term');
  el ? showTip(el) : !e.target.closest?.('.d-tip') && hideTip();
});
document.addEventListener('scroll', (e) => !e.target.closest?.('.d-tip') && hideTip(), true);

// A Flow names its Area in a field; its id is its file name alone.
const areaOf = (id) => DATA.flows[id]?.area ?? '';
const areaName = (aid) => DATA.areas[aid]?.name ?? (aid || 'No Area');
const actorName = (f) => DATA.actors[f.actor]?.name ?? f.actor;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function ago(date) {
  const min = Math.round((Date.now() - Date.parse(date)) / 60000);
  if (min < 1) return 'just now';
  return `${min < 60 ? plural(min, 'minute') : min < 1440 ? plural(Math.round(min / 60), 'hour') : plural(Math.round(min / 1440), 'day')} ago`;
}
function readAgo() {
  const s = Math.max(0, Math.round((Date.now() - READ_AT) / 1000));
  return s < 60 ? `read ${s} s ago` : `read ${ago(new Date(READ_AT).toISOString())}`;
}

// ---------- QA Results: one of four states per QA Step ----------

const STATE_LINE = { 'not-checked': 'Not checked', passed: '✓ Passed', failed: '✕ Failed', 'could-not-perform': '– Could not perform' };

let REFUSED = null; // what the server said when it last refused to record a result
const result = (fid, p, qs) => DATA.results[fid]?.[p.id]?.[qs.id] ?? { state: 'not-checked', note: '' };
function tally(fid, P) {
  const t = { 'not-checked': 0, passed: 0, failed: 0, 'could-not-perform': 0, all: 0 };
  for (const p of P) for (const qs of p.qa.steps) (t[result(fid, p, qs).state]++, t.all++);
  return t;
}
// One square per QA Step of a path, in the colour of its result.
const squares = (fid, p) => `<span class="d-sq">${p.qa.steps.map((qs) => `<i class="s-${result(fid, p, qs).state}"></i>`).join('')}</span>`;
const moved = (r) => r.since && (r.since.commits.length || r.since.uncommitted);
// The state of a whole Flow, as its dot in the sidebar says it: what failed first, then what to check again.
function flowState(fid) {
  const P = DATA.flows[fid].paths;
  const all = P.flatMap((p) => p.qa.steps.map((qs) => result(fid, p, qs)));
  if (all.some((r) => r.state === 'failed')) return ['failed', 'A QA Step failed'];
  if (all.some(moved)) return ['again', 'QA results were recorded before a change'];
  if (all.some((r) => r.state === 'could-not-perform')) return ['again', 'A QA Step could not be performed'];
  if (all.length && all.every((r) => r.state === 'passed')) return ['passed', 'Every QA Step passed'];
  return [all.some((r) => r.state !== 'not-checked') ? 'some' : 'none', all.some((r) => r.state !== 'not-checked') ? 'Some QA Steps checked' : 'No QA Step checked'];
}
// The answer to a change is the whole of the data again, or why the change was refused.
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const sent = await r.json();
  REFUSED = r.ok ? null : sent.error;
  if (r.ok) DATA = sent;
}

// A Step states both lines, even when one is empty.
function sides(s) {
  const line = (label, text, empty) => `<div class="d-kv"><span>${label}</span><div class="${text ? '' : 'd-none'}">${esc(text ?? empty)}</div></div>`;
  return line('Does', s.does, 'Nothing.') + line('Sees', s.sees, 'Nothing changes on screen.');
}

// ---------- git: what changed a Flow ----------
// A Flow changed when the code one of its Parts' Anchors points to changed.

const short = (c) => c.sha.slice(0, 7);
const changes = (fid) => DATA.changes.flows[fid] ?? { uncommitted: false };
const commitRow = (c) =>
  `<div class="d-commit"><span class="d-mono" title="${esc(c.sha)}">${esc(short(c))}</span><span>${esc(c.subject)}</span><span class="d-when">${esc(ago(c.date))}</span></div>`;

// ---------- Areas, Flows and Flows to write, in the order of the sidebar ----------

// Every Flow to write, with the written Flows that have a precondition waiting for it.
function toWrite() {
  return Object.entries(DATA.areas).flatMap(([aid, area]) =>
    Object.entries(area?.flows_to_write ?? {}).map(([id, entry]) => ({
      id,
      area: aid,
      name: entry?.name ?? id,
      is: entry?.is,
      waited: Object.keys(DATA.flows).filter((fid) => (DATA.flows[fid].preconditions ?? []).some((pre) => pre?.flow_to_write === id)),
    }))
  );
}
// Every Area of areas.yaml, even one with no Flow yet, then any Area a Flow names that the file lacks.
function areaList() {
  const TW = toWrite();
  const ids = [...new Set([...Object.keys(DATA.areas), ...Object.keys(DATA.flows).map(areaOf)])];
  return ids.map((id) => ({
    id,
    known: !!DATA.areas[id],
    flows: Object.keys(DATA.flows).filter((fid) => areaOf(fid) === id),
    toWrite: TW.filter((e) => e.area === id),
  }));
}
const flowOrder = () => areaList().flatMap((a) => a.flows);
// The first Step, in the order of the sidebar, that names a Part.
function firstUse(pid) {
  for (const fid of flowOrder())
    for (const p of DATA.flows[fid].paths) {
      const step = p.steps.findIndex((s) => !s.shared && (s.parts ?? []).includes(pid));
      if (step >= 0) return { fid, path: p.id, step };
    }
}

// ---------- the sidebar ----------

const EXPANDED = new Map(); // Area id → whether the Builder unfolded it
const TWOPEN = new Map(); // Area id → whether the Builder unfolded its Flows to write

let SEARCH = '';
let SEARCH_AT = 0; // the result Enter opens
function searchResults() {
  const t = SEARCH.trim().toLowerCase();
  if (!t) return [];
  const has = (s) => String(s ?? '').toLowerCase().includes(t);
  const out = [];
  for (const fid of flowOrder()) {
    const f = DATA.flows[fid];
    if (has(f.name) || has(f.goal)) out.push({ kind: 'Flow', name: f.name, sub: areaName(areaOf(fid)), href: flowHref(fid), named: has(f.name) });
  }
  for (const e of toWrite()) if (has(e.name) || has(e.is)) out.push({ kind: 'Flow to write', name: e.name, sub: areaName(e.area), tw: e.id, named: has(e.name) });
  for (const [pid, part] of Object.entries(DATA.parts)) {
    if (!part || !(has(part.name) || has(part.is))) continue;
    // A Part opens where it is first named; one that no Step names has nowhere to open.
    const at = firstUse(pid);
    if (!at) continue;
    out.push({
      kind: part.entity ? 'Entity' : 'Part',
      name: part.name ?? pid,
      sub: `in ${DATA.flows[at.fid].name}, step ${at.step + 1}`,
      href: flowHref(at.fid, { path: at.path === 'main' ? null : at.path, step: at.step, part: pid }),
      named: has(part.name),
    });
  }
  // What is named so comes before what only mentions it.
  return out.sort((a, b) => b.named - a.named).slice(0, 12);
}
function searchList() {
  if (!SEARCH.trim()) return '';
  const found = searchResults();
  if (!found.length) return '<div class="d-results"><div class="d-rnone">Nothing found.</div></div>';
  SEARCH_AT = Math.min(SEARCH_AT, found.length - 1);
  return `<div class="d-results">${found
    .map((r, i) => {
      const inner = `<span class="d-rname">${esc(r.name)}</span><span class="d-rkind">${esc(r.kind)}</span><span class="d-rsub">${esc(r.sub)}</span>`;
      const cls = `d-result ${i === SEARCH_AT ? 'on' : ''}`;
      return r.tw ? `<button class="${cls}" data-tw="${esc(r.tw)}" data-found>${inner}</button>` : `<a class="${cls}" href="${esc(r.href)}" data-found>${inner}</a>`;
    })
    .join('')}</div>`;
}
function showSearch() {
  const box = document.querySelector('.d-search');
  box?.querySelector('.d-results')?.remove();
  box?.insertAdjacentHTML('beforeend', searchList());
}
function clearSearch() {
  SEARCH = '';
  SEARCH_AT = 0;
  if (document.activeElement?.matches('[data-search]')) document.activeElement.blur();
}

function sidebar(fid) {
  const tw = q('tw');
  const uncommitted = Object.keys(DATA.flows).filter((id) => changes(id).uncommitted).length;
  const page = fid ? 'flow' : q('page') === 'changes' ? 'changes' : 'overview';
  const areas = areaList();
  const icon = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;

  const flowRow = (id) => {
    const [state, why] = flowState(id);
    return `<a class="d-sflow ${id === fid ? 'on' : ''}" href="${esc(flowHref(id))}">
      <i class="d-sdot ${state}" title="${esc(why)}"></i><span class="d-sfname">${esc(DATA.flows[id].name)}</span>
      ${changes(id).uncommitted ? `<span class="d-stag amber">${term('uncommitted', 'not committed', true)}</span>` : ''}
    </a>`;
  };
  const toWriteBlock = (a) => {
    if (!a.toWrite.length) return '';
    const open = TWOPEN.get(a.id) ?? a.toWrite.some((e) => e.id === tw);
    const head = open
      ? `<button class="d-stw open" data-twlist="${esc(a.id)}"><i class="d-twicon"></i>${term('towrite', 'To write', true)}<span class="d-scount">${a.toWrite.length} ▴</span></button>`
      : `<button class="d-stw" data-twlist="${esc(a.id)}"><i class="d-twicon"></i>${term('towrite', `${a.toWrite.length} to write`, true)}</button>`;
    return `${head}${
      open
        ? a.toWrite
            .map(
              (e) => `<button class="d-stwe ${e.id === tw ? 'on' : ''}" data-tw="${esc(e.id)}"><span class="d-sfname">${esc(e.name)}</span>${
                e.waited.length ? '<span class="d-stag blue" title="A written Flow has a precondition waiting for it">waited for</span>' : ''
              }</button>`
            )
            .join('')
        : ''
    }`;
  };
  const area = (a) => {
    // Unfolded by default: the Area of the open Flow or Flow to write, and on the Overview every Area with a Flow.
    const open = EXPANDED.get(a.id) ?? (a.flows.includes(fid) || a.toWrite.some((e) => e.id === tw) || (!fid && a.flows.length > 0));
    return `<div class="d-sarea">
      <button class="d-sareah" data-area="${esc(a.id)}" aria-expanded="${open}">
        <span class="d-chev ${open ? 'open' : ''}">›</span>
        <span class="d-saname ${a.known ? '' : 'd-warn'}" ${a.known ? '' : `title="${a.id ? 'This Area is not in areas.yaml' : 'These Flows name no Area'}"`}>${esc(areaName(a.id))}</span>
        <span class="d-scount">${a.flows.length}${a.toWrite.length ? ` · ${a.toWrite.length} to write` : ''}</span>
      </button>
      ${open ? `<div class="d-sflows">${a.flows.map(flowRow).join('')}${toWriteBlock(a)}${a.flows.length || a.toWrite.length ? '' : '<div class="d-snone">No Flow yet.</div>'}</div>` : ''}
    </div>`;
  };

  return `<aside class="d-side" data-pane="side" data-key="side">
    <div class="d-brand"><a class="d-logo" href="/"><i></i>Fledgy</a><span class="d-sl">/</span><span class="d-repo">${esc(DATA.repo.name)}</span></div>
    <div class="d-search">
      <label class="d-sbox">${icon('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>')}
        <input data-search placeholder="Search Flows, Parts…" value="${esc(SEARCH)}" autocomplete="off" spellcheck="false" aria-label="Search Flows, Flows to write and Parts" />
        <kbd>⌘K</kbd></label>
      ${searchList()}
    </div>
    <nav class="d-snav">
      <a class="d-snavi ${page === 'overview' ? 'on' : ''}" href="/">${icon('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>')}Overview</a>
      <a class="d-snavi ${page === 'changes' ? 'on' : ''}" href="/?page=changes">${icon('<circle cx="4.5" cy="3.5" r="1.5"/><circle cx="4.5" cy="12.5" r="1.5"/><circle cx="11.5" cy="6.5" r="1.5"/><path d="M4.5 5v6M11.5 8c0 2-2 2.5-5 3.5"/>')}Changes${
        uncommitted ? `<span class="d-badge" title="${plural(uncommitted, 'Flow')} not committed">${uncommitted}</span>` : ''
      }</a>
    </nav>
    <div class="d-lab d-slab">${term('area', 'Areas')}</div>
    <div class="d-sareas">${areas.length ? areas.map(area).join('') : '<div class="d-snone">Nothing mapped yet.</div>'}</div>
    <div class="d-sfoot"><div><i class="d-dot"></i>${term('live', 'Live from knowledge-base/')}</div><div class="d-mono dim" data-read>${readAgo()}</div></div>
  </aside>`;
}

// A Flow to write, opened from the sidebar, the search or a precondition: what it is, who waits for it, how to write it.
function twPopover() {
  const e = toWrite().find((x) => x.id === q('tw'));
  if (!e) return '';
  const command = `/map-the-app Write the Flow ${e.name}`;
  const waits = e.waited.map((fid) => {
    const pre = (DATA.flows[fid].preconditions ?? []).find((p) => p?.flow_to_write === e.id);
    return `<div>Waited for by <a class="d-chip sm" href="${esc(flowHref(fid))}">${esc(DATA.flows[fid].name)}</a>${pre?.so_that ? ` — “${esc(pre.so_that)}”` : ''}</div>`;
  });
  return `<div class="d-pop" role="dialog" aria-label="${esc(e.name)}, a Flow to write">
    <div class="d-poph"><span class="d-lab">${term('towrite', 'Flow to write')} · ${esc(areaName(e.area))}</span><button class="d-x" ${set({ tw: null })} aria-label="Close">×</button></div>
    <div class="d-popt">${esc(e.name)}</div>
    ${e.is ? `<div class="d-popis">${esc(e.is)}</div>` : ''}
    <div class="d-popw">${waits.join('') || 'No written Flow waits for it.'}</div>
    <div class="d-popcmd"><span>To write it, in Claude Code type <code>${esc(command)}</code></span><button class="d-btn2" data-copy="${esc(command)}">Copy</button></div>
  </div>`;
}
// The popover sits beside the sidebar, level with the entry it opened from when that entry is in view.
function placePopover() {
  const pop = document.querySelector('.d-pop');
  if (!pop) return;
  const from = document.querySelector('.d-stwe.on')?.getBoundingClientRect();
  const top = from && from.bottom > 0 && from.top < innerHeight ? from.top - 40 : 120;
  pop.style.top = `${Math.max(12, Math.min(top, innerHeight - pop.offsetHeight - 12))}px`;
}

// ---------- the Overview: how far the map has come, what just changed, what to write next ----------

const and = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const flowCard = (fid, cls = '') =>
  `<a class="d-ocard ${cls}" href="${esc(flowHref(fid))}"><span>${esc(DATA.flows[fid].name)}</span><span class="d-oopen">Open →</span></a>`;
// The guide's headings a Builder new to the words is most likely to need.
const GUIDE_WORDS = [
  ['knowledge-base', 'The knowledge base'],
  ['flow', 'Flow'],
  ['main-path', 'Main path and Variants'],
  ['part', 'Part'],
  ['manual-qa-check', 'Manual QA Check'],
];

function overview() {
  const written = Object.keys(DATA.flows);
  const TW = toWrite();
  const uncommitted = (DATA.changes.uncommitted?.flows ?? []).filter((id) => DATA.flows[id]);
  const last = DATA.changes.recent[0];
  const line = (html) => `<span>${html}</span>`;
  const n = (x, cls = '') => `<b class="${cls}">${x}</b>`;

  const head = written.length
    ? [
        line(`${n(written.length)} ${term('flow', written.length === 1 ? 'Flow' : 'Flows')} ${written.length === 1 ? 'is' : 'are'} written.`),
        TW.length ? line(`${n(`${TW.length} more`)} ${TW.length === 1 ? 'is' : 'are'} ${term('towrite', 'waiting to be written')}.`) : '',
        uncommitted.length ? line(`${n(uncommitted.length, 'amber')} changed on your computer ${last ? 'since the last commit' : `and ${uncommitted.length === 1 ? 'is' : 'are'} not committed yet`}.`) : '',
      ]
    : Object.keys(DATA.areas).length
      ? [line(`No ${term('flow', 'Flow')} is written yet.`), TW.length ? line(`${n(TW.length)} ${TW.length === 1 ? 'is' : 'are'} waiting to be written.`) : '']
      : [line('Nothing is mapped yet.')];

  let body;
  if (!written.length) {
    body = `<p class="d-otext">${
      Object.keys(DATA.areas).length
        ? `The ${term('area', 'Areas')} and the ${term('towrite', 'Flows to write')} are listed on the left. In Claude Code, type <code>/map-the-app</code> to carry on: Fledgy writes the Flows with you, one Area at a time.`
        : 'In Claude Code, type <code>/map-the-app</code>. Fledgy reads your code, proposes the Areas it sees for you to correct, then writes their Flows with you, one Area at a time. This page fills in as it goes.'
    }</p>`;
  } else {
    const notCommitted = uncommitted.length
      ? `<section class="d-osec">
          <div class="d-ohead"><i class="d-odot amber"></i>${term('uncommitted', 'Not committed yet')}</div>
          <div class="d-ocards one">${uncommitted.map((id) => flowCard(id, 'amber')).join('')}</div>
        </section>`
      : '';
    let lastCommit = '';
    if (last) {
      const changed = last.flows.filter((id) => DATA.flows[id]);
      lastCommit = `<section class="d-osec">
          <div class="d-ohead"><i class="d-odot blue"></i>In the last commit<span class="d-ocommit"><span title="${esc(last.sha)}">${esc(short(last))}</span> “${esc(last.subject)}” · ${esc(ago(last.date))}</span></div>
          ${changed.length ? `<div class="d-ocards">${changed.map((id) => flowCard(id)).join('')}</div>` : '<p class="d-otext dim">It changed no Flow.</p>'}
        </section>`;
    }
    let still = '';
    if (TW.length) {
      const perArea = areaList()
        .filter((a) => a.toWrite.length)
        .map((a) => `${a.toWrite.length} in ${esc(areaName(a.id))}`);
      // The Flows to write that written Flows wait for come first: the most waited for, at most three.
      const waited = TW.filter((e) => e.waited.length).sort((a, b) => b.waited.length - a.waited.length);
      const named = waited.slice(0, 3).map((e) => `<button class="d-otw" data-tw="${esc(e.id)}">${esc(e.name)}</button>`);
      if (waited.length > 3) named.push(plural(waited.length - 3, 'other'));
      const many = waited.length > 1 || waited[0]?.waited.length > 1;
      const start = waited.length
        ? ` Start with ${and(named)}: ${many ? 'written Flows already depend' : 'a written Flow already depends'} on ${waited.length > 1 ? 'them' : 'it'}.`
        : '';
      still = `<section class="d-osec d-ostill">
          <div class="d-ohead"><i class="d-twicon"></i>${term('towrite', 'Still to write')}</div>
          <p class="d-otext">${perArea.join(', ')}.${start}</p>
          <p class="d-osmall">To write them, type <code>/map-the-app</code> in Claude Code.</p>
        </section>`;
    }
    body = notCommitted + lastCommit + still;
  }

  return `<div class="d-over" data-pane="overview" data-key="overview">
    <div class="d-ocol">
      <div class="d-lab d-oeyebrow">${esc(DATA.repo.name)} · Knowledge base</div>
      <h1 class="d-ohead1">${head.join('')}</h1>
      ${body}
      <div class="d-owords">
        <p>Not sure what a word means? The guide explains each one in more depth.</p>
        <div class="d-opills">${GUIDE_WORDS.map(([id, label]) => `<a class="d-opill" href="${GUIDE}#${id}" target="_blank" rel="noopener">${label}</a>`).join('')}<a class="d-link d-oguide" href="${GUIDE}" target="_blank" rel="noopener">Whole guide ↗</a></div>
      </div>
    </div>
  </div>`;
}

// ---------- the Changes: which Flows changed, newest first ----------
// A timeline: what is not committed, then each of the last commits. The commits in a row that changed
// no Flow fold into one group.

const FOLDS = new Set(); // the newest sha of each fold of commits the Builder unfolded
const dayOf = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
};
// “an Admin”, but “a User”: a name that starts with a vowel sounded as “you” or “one” takes “a”.
const withArticle = (name) => (/^(a|an|the)\s/i.test(name) ? name : `${/^[aeiou]/i.test(name) && !/^(us|uni|eu|one)/i.test(name) ? 'an' : 'a'} ${name}`);

// The newest change made after a QA Result was recorded: 'uncommitted', a commit's sha, or nothing.
function newestChange(r) {
  if (!moved(r)) return null;
  if (r.since.uncommitted) return 'uncommitted';
  const shas = new Set(r.since.commits.map((c) => c.sha));
  return DATA.changes.recent.find((c) => shas.has(c.sha))?.sha ?? r.since.commits[0]?.sha ?? null;
}
// A Flow changed by `at`, and under it a strip for each path whose results were recorded before that change.
// A result shows only at the newest change since it, so it is said once on the page.
function changedRow(fid, at) {
  const f = DATA.flows[fid];
  const strips = f.paths.flatMap((p) => {
    const n = p.qa.steps.filter((qs) => newestChange(result(fid, p, qs)) === at).length;
    if (!n) return [];
    const on = p.id === 'main' ? `its ${term('mainpath', 'Main path')}` : `its ${term('variant', 'Variant')} “${esc(p.name)}”`;
    return `<div class="d-cstrip"><span>↻ ${n} ${term('qachip', n === 1 ? 'QA result' : 'QA results')} on ${on} ${n === 1 ? 'was' : 'were'} recorded before this change.</span>
      <a class="d-cagain" href="${esc(flowHref(fid, { path: p.id === 'main' ? null : p.id, tab: 'check' }))}">Check again →</a></div>`;
  });
  return `<a class="d-crow" href="${esc(flowHref(fid))}">
      <span class="d-cname"><span>${esc(f.name)}</span><span class="d-csub">${esc(areaName(areaOf(fid)))} · done by ${esc(withArticle(actorName(f)))}</span></span>
      <span class="d-oopen">Open →</span>
    </a>${strips.join('')}`;
}

function changesPage() {
  const recent = DATA.changes.recent;
  const uncommitted = (DATA.changes.uncommitted?.flows ?? []).filter((id) => DATA.flows[id]);
  const changed = (c) => c.flows.filter((id) => DATA.flows[id]);
  const group = (dot, head, body) => `<section class="d-cgroup"><i class="d-cdot ${dot}"></i><div class="d-chead">${head}</div>${body}</section>`;

  const groups = [];
  if (uncommitted.length)
    groups.push(
      group(
        'amber',
        `<b>${term('uncommitted', 'Not committed')}</b><span class="dim">on your computer, now · ${plural(uncommitted.length, 'Flow')}</span>`,
        `<div class="d-ccard amber">${uncommitted.map((id) => changedRow(id, 'uncommitted')).join('')}</div>`
      )
    );
  for (let i = 0; i < recent.length; ) {
    const c = recent[i];
    const flows = changed(c);
    if (flows.length) {
      groups.push(
        group(
          'blue',
          `<span class="d-mono" title="${esc(c.sha)}">${esc(short(c))}</span><b class="d-csubj">${esc(c.subject)}</b><span class="dim">${esc(ago(c.date))} · ${plural(flows.length, 'Flow')}</span>${
            i === 0 ? '<span class="d-clast">last commit</span>' : ''
          }`,
          `<div class="d-ccard">${flows.map((id) => changedRow(id, c.sha)).join('')}</div>`
        )
      );
      i++;
      continue;
    }
    // The commits from here that changed no Flow, newest first.
    let j = i;
    while (j < recent.length && !changed(recent[j]).length) j++;
    const run = recent.slice(i, j);
    const open = FOLDS.has(run[0].sha);
    const [newest, oldest] = [dayOf(run[0].date), dayOf(run.at(-1).date)];
    const subjects = run.slice(0, 3).map((x) => esc(x.subject));
    groups.push(
      group(
        'hollow',
        `<b>${run.length === 1 ? '1 commit' : `${run.length} commits`} changed no ${term('flow', 'Flow')}</b><span class="dim">${newest === oldest ? newest : `${oldest} – ${newest}`}</span>
         <button class="d-cfold" data-fold="${esc(run[0].sha)}" aria-expanded="${open}">${open ? 'Hide ▴' : 'Show ▾'}</button>`,
        open
          ? `<div class="d-cfolded">${run.map(commitRow).join('')}</div>`
          : `<div class="d-cdim">${subjects.join(' · ')}${run.length > 3 ? ` and ${run.length - 3} more` : ''}</div>`
      )
    );
    i = j;
  }

  let body;
  if (!Object.keys(DATA.flows).length)
    body = '<p class="d-otext">No Flow is written yet, so no change can show here. In Claude Code, type <code>/map-the-app</code>.</p>';
  else {
    // Said plainly when nothing changed a Flow, above the commits; with no commit at all, below what is not committed.
    const none =
      recent.length && !uncommitted.length && !recent.some((c) => changed(c).length)
        ? `<p class="d-otext">${recent.length === 1 ? 'The last commit did not change a Flow.' : `None of the last ${recent.length} commits changed a Flow.`}</p>`
        : '';
    const noCommit = recent.length ? '' : `<p class="d-otext">This branch has no commit yet.${uncommitted.length ? '' : ' No Flow has changes that are not committed.'}</p>`;
    body = `${none}${groups.length ? `<div class="d-ctimeline">${groups.join('')}</div>` : ''}${noCommit}`;
  }

  return `<div class="d-over" data-pane="changes" data-key="changes">
    <div class="d-ccol">
      <h1 class="d-h1">Changes</h1>
      <div class="d-lead">Which ${term('flow', 'Flows')} changed, newest first.</div>
      ${body}
      <div class="d-cfoot"><b>What counts as a change.</b> A ${term('flow', 'Flow')} changed when the code its ${term('part', 'Parts')} point to changed. Rewording the Flow doesn’t count: nothing changed in the app. <a class="d-link" href="${GUIDE}#not-committed" target="_blank" rel="noopener">More in the guide ↗</a></div>
    </div>
  </div>`;
}

// ---------- the Flow page ----------

// A precondition is a sentence, or names the Flow that brings it about: one that is written, which it links to,
// or one still to write, which opens its popover. A Flow that is neither shows its id.
function precondition(pre) {
  if (typeof pre === 'string') return `<div>${esc(pre)}</div>`;
  const id = pre?.flow ?? pre?.flow_to_write;
  const tw = toWrite().find((e) => e.id === id);
  const named = DATA.flows[id]
    ? `<a class="d-chip sm" href="${esc(flowHref(id))}" title="Open this Flow">${esc(DATA.flows[id].name)}</a>`
    : tw
      ? `<button class="d-chip sm dashed" data-tw="${esc(id)}" title="A Flow to write">${esc(tw.name)} · to write</button>`
      : `<span class="d-chip sm dashed missing" title="No Flow and no Flow to write has this id">${esc(id)}</span>`;
  return `<div>${esc(pre?.so_that)} ${named}</div>`;
}

function anchor(a) {
  const [file, symbol] = String(a.at ?? '').split('#');
  return `<a class="d-anc" href="vscode://file/${encodeURI(DATA.repo.root + '/' + file)}" title="Open in VS Code">
    <span class="d-ancl">${esc(a.label)}</span>
    <span class="d-ancp">${a.side ? `${esc(a.side)} · ` : ''}${esc(file)}${symbol ? `<b>#${esc(symbol)}</b>` : ''}</span>
  </a>`;
}

// The open Part of a Step: its sentence on the left, where it lives in the code on the right.
function partPanel(id, p, i) {
  const part = DATA.parts[id];
  const also = p.steps.map((s, j) => j).filter((j) => j !== i && (p.steps[j].parts ?? []).includes(id));
  return `<div class="d-ppanel">
    <div class="d-ppl">
      <div class="d-ppname">${esc(part.name ?? id)}${part.entity ? `<span class="d-tag">${term('entity', 'Entity')}</span>` : ''}</div>
      <div class="d-pis">${esc(part.is)}</div>
      ${part.relations?.length ? `<ul class="d-prel">${part.relations.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${also.length ? `<div class="d-palso">Also in step ${also.map((j) => `<button ${set({ step: j, part: id })}>${j + 1}</button>`).join(', ')}</div>` : ''}
    </div>
    <div class="d-ppr">
      <div class="d-lab">${term('anchor', 'Where it lives in the code')} · opens in VS Code</div>
      ${(part.anchors ?? []).map(anchor).join('') || '<div class="d-none">No Anchor.</div>'}
    </div>
  </div>`;
}

function stepRow(fid, P, p, s, i, cur) {
  const on = i === cur;
  const parts = s.parts ?? [];
  const open = on && parts.includes(q('part')) ? q('part') : null;
  const chips = parts
    .map((id) => {
      const part = DATA.parts[id];
      if (!part) return `<span class="d-chip missing" title="No file at parts/${esc(id)}.yaml">${esc(id)}</span>`;
      const isOpen = id === open;
      return `<button class="d-chip ${isOpen ? 'on' : ''}" ${set({ step: i, part: isOpen ? null : id })} aria-expanded="${isOpen}">${esc(part.name ?? id)}${
        part.entity ? `<span class="d-ent">${term('entity', 'Entity', true)}</span>` : ''
      }<span class="d-caret">${isOpen ? '▴' : '▾'}</span></button>`;
    })
    .join('');
  // On the main path, the Variants that leave it at this Step.
  const leaving = p.id === 'main' ? P.slice(1).filter((v) => v.divergesAt === i) : [];
  const tag = s.shared
    ? '<span class="d-tag">Same as main path</span>'
    : i === p.divergesAt
      ? `<span class="d-tag blue">${term('leaves', 'Leaves the main path')}</span><span class="d-swhen">when ${esc(p.when)}</span>`
      : '';
  return `<div class="d-step ${on ? 'on' : ''} ${s.shared ? 'shared' : ''}" data-step="${i}">
    <button class="d-snum" ${set({ step: i, part: null })} aria-label="Step ${i + 1}">${i + 1}</button>
    <div class="d-smain">
      ${tag ? `<div class="d-stags">${tag}</div>` : ''}
      ${sides(s)}
    </div>
    <div class="d-ssys ${s.system ? '' : 'empty'}"><div class="d-lab">${term('system', 'System')}</div><div>${esc(s.system ?? 'Nothing.')}</div></div>
    <div class="d-sparts">
      ${
        leaving.length
          ? `<div class="d-leaving">${term('variant', leaving.length === 1 ? 'A Variant' : 'Variants')} ${leaving.length === 1 ? 'leaves' : 'leave'} here: ${leaving
              .map((v) => `<button class="d-vlink" ${set({ path: v.id, step: i, part: null })}>${esc(v.name)}</button>`)
              .join(', ')}</div>`
          : ''
      }
      ${parts.length ? `<div class="d-chips"><span class="d-lab">${term('part', 'Parts')}</span>${chips}</div>` : '<div class="d-none">No Part in this step.</div>'}
    </div>
    ${open ? partPanel(open, p, i) : ''}
  </div>`;
}

// The paths of the Flow, each a card: on "Read the Flow" its Steps, on "Check by hand" its results.
function pathCard(fid, P, x, p, check) {
  const t = tally(fid, [x]);
  const own = x.steps.filter((s) => !s.shared).length;
  const badge = t.failed
    ? `<span class="d-pbadge failed">${t.failed} failed</span>`
    : `<span class="d-pbadge ${t.all && t.passed === t.all ? 'passed' : ''}">${t.passed}/${t.all}</span>`;
  const summary = t.failed
    ? `<span class="d-st s-failed">${t.failed} failed</span>`
    : t.all && t.passed === t.all
      ? '<span class="d-st s-passed">all passed</span>'
      : t['not-checked'] === t.all
        ? 'not started'
        : `${t.passed}/${t.all} passed`;
  const sub = check
    ? `<span class="d-pcheck">${squares(fid, x)}${summary}</span>`
    : x.id === 'main'
      ? `<span class="d-psub">${plural(x.steps.length, 'step')} · ${esc(x.outcome)}</span>`
      : `<span class="d-pmeta">${x.divergesAt == null ? '<span class="d-warn">leaves at a step the main path does not have</span>' : `leaves at step ${x.divergesAt + 1}`} · ${plural(own, 'step')}</span>`;
  return `<button class="d-pcard ${x.id === p.id ? 'on' : ''}" ${set({ path: x.id === 'main' ? null : x.id, step: null, part: null, qa: null })}>
    <span class="d-ptitle"><span>${x.id === 'main' ? term('mainpath', esc(x.name), true) : esc(x.name)}</span>${check ? '' : badge}</span>
    ${sub}
  </button>`;
}

// What has happened to the Flow since the results on this path were recorded: the result with the most to say.
// A change never clears a result: the Builder is told, and decides whether to reset.
function changedSince(fid, p) {
  const since = p.qa.steps.map((qs) => result(fid, p, qs).since).filter((c) => c && (c.commits.length || c.uncommitted));
  if (!since.length) return null;
  const most = since.reduce((a, b) => (b.commits.length > a.commits.length ? b : a));
  return { commits: most.commits, byDate: most.byDate, uncommitted: since.some((c) => c.uncommitted) };
}

function sinceBanner(c) {
  const n = c.commits.length;
  const text = n
    ? `${plural(n, 'commit')} ${n === 1 ? 'has' : 'have'} changed this Flow since this path was checked${c.uncommitted ? ', and it has changes that are not committed yet' : ''}.`
    : 'This Flow has changes that are not committed yet, made after this path was checked.';
  return `<div class="d-since">
    <div class="d-lab">Changed since the last check</div>
    <div>${text}</div>
    ${n ? `<div>${c.commits.map(commitRow).join('')}</div>` : ''}
    ${n && c.byDate ? '<div class="d-sincef d-warn">The commit the check was recorded on is not in this branch’s history, so these are the commits made after the date of the check.</div>' : ''}
    <div class="d-sincef">A commit changes a Flow when it changes the code one of its Parts points to. The results are kept as they are. Record a step again once you have looked, or reset them if they no longer hold.</div>
  </div>`;
}

// The QA Step the Check opens on: the one named in the address, or the first not checked.
function currentQa(fid, p) {
  const n = Number.parseInt(q('qa') ?? '', 10);
  if (Number.isInteger(n) && n >= 0 && n < p.qa.steps.length) return n;
  const open = p.qa.steps.findIndex((qs) => result(fid, p, qs).state === 'not-checked');
  return Math.max(open, 0);
}
// A note typed on a QA Step not checked yet waits here, by step, to be recorded with its result.
const NOTES = new Map();
const qaRef = (fid, p, qs) => JSON.stringify({ flow: fid, path: p.id, step: qs.id });

// What has happened to the Flow since a result was recorded, said in a few words.
function sinceWords(r) {
  return [
    r.since?.commits.length ? `${plural(r.since.commits.length, 'commit')} to this Flow since${r.since.byDate ? ', by date' : ''}` : '',
    r.since?.uncommitted ? 'changes not committed since' : '',
  ]
    .filter(Boolean)
    .join(' and ');
}

// A QA Step that is not the current one: what to do, its result and its note.
function qaRow(fid, p, qs, i) {
  const r = result(fid, p, qs);
  return `<button class="d-qrow s-${r.state}" ${set({ qa: i })} data-qa="${i}">
    <span class="d-qnum">${i + 1}</span>
    <span class="d-qtext"><span>${esc(qs.do)}</span>${r.note ? `<span class="d-qnote">“${esc(r.note)}”</span>` : ''}</span>
    <span class="d-qstate">${
      r.state === 'not-checked'
        ? '<span class="d-st s-not-checked">Not checked</span>'
        : `<span class="d-st s-${r.state}">${STATE_LINE[r.state]}</span><span class="d-when">${esc(ago(r.date))}</span>${
            moved(r) ? `<span class="d-qmoved" title="${esc(sinceWords(r))}">changed since</span>` : ''
          }`
    }</span>
  </button>`;
}

// The current QA Step, open: what to do, what to expect, the three results and a note.
function qaCurrent(fid, p, qs, i) {
  const r = result(fid, p, qs);
  const ref = esc(qaRef(fid, p, qs));
  const button = (state, label, key, mark) =>
    `<button class="d-rbtn ${state} ${r.state === state ? 'on' : ''}" data-result="${ref}" data-state="${state}"><span class="d-rmark">${mark}</span>${label}<kbd>${key}</kbd></button>`;
  const note = r.state === 'not-checked' ? (NOTES.get(qaRef(fid, p, qs)) ?? '') : r.note;
  const after = sinceWords(r);
  const status =
    r.state === 'not-checked'
      ? 'Not checked yet'
      : `<span title="${esc(new Date(r.date).toLocaleString())} · ${esc(r.commit)}">${STATE_LINE[r.state]} ${esc(ago(r.date))}</span>${
          r.uncommitted ? ' · <span class="d-warn">recorded with changes to this Flow not committed</span>' : ''
        }${after ? ` · <span class="d-warn">${esc(after)}</span>` : ''} · <button class="d-qclear" data-result="${ref}" data-state="not-checked">Set back to not checked</button>`;
  return `<div class="d-qcur s-${r.state}" data-qa="${i}">
    <span class="d-qnum">${i + 1}</span>
    <div class="d-qbody">
      <div class="d-lab">Do</div>
      <div class="d-qdo">${esc(qs.do)}</div>
      <div class="d-lab">Expect</div>
      <div class="d-qexpect">${esc(qs.expect)}</div>
      ${
        qs.id == null
          ? '<div class="d-rec d-warn">This QA Step has no id, so no result can be recorded on it.</div>'
          : `<div class="d-qact">
              ${button('passed', 'Passed', 'P', '✓')}${button('failed', 'Failed', 'F', '✕')}${button('could-not-perform', term('cnp', 'Could not perform', true), 'X', '–')}
              <label class="d-qnotebox"><input data-note="${ref}" value="${esc(note)}" placeholder="Note about what you saw" autocomplete="off" /><kbd>N</kbd></label>
            </div>
            <div class="d-qfoot">${status}</div>`
      }
    </div>
  </div>`;
}

// After this path: the next one nobody started, else the next one with a QA Step not checked.
function nextPath(fid, P, p) {
  const at = P.indexOf(p);
  const after = [...P.slice(at + 1), ...P.slice(0, at)].filter((x) => x.qa.steps.length);
  const left = (x) => tally(fid, [x])['not-checked'];
  const fresh = after.find((x) => left(x) === x.qa.steps.length);
  if (fresh) return { path: fresh, why: 'next path not started' };
  const unfinished = after.find((x) => left(x) > 0);
  return unfinished && { path: unfinished, why: 'next path with steps not checked' };
}

function checkByHand(fid, P, p) {
  const t = tally(fid, [p]);
  const since = changedSince(fid, p);
  const cur = currentQa(fid, p);
  const next = nextPath(fid, P, p);
  const tallyLine = [['passed', 'passed'], ['failed', 'failed'], ['could-not-perform', 'could not perform'], ['not-checked', 'not checked']]
    .filter(([k]) => t[k])
    .map(([k, label]) => `<span class="d-st s-${k}">${t[k]} ${label}</span>`)
    .join('<span class="dim"> · </span>');
  const setup = p.qa.setup ?? [];
  return `<div class="d-qapane">
    <div class="d-qah"><span class="d-lab">${term('qa', 'Manual QA Check')} · ${esc(p.name)}</span><span class="d-tally">${tallyLine}</span>${
      t['not-checked'] < t.all ? `<button class="d-link" data-reset="${esc(JSON.stringify({ flow: fid, path: p.id }))}">Reset results</button>` : ''
    }</div>
    ${REFUSED ? `<div class="d-rec d-warn">Not recorded: ${esc(REFUSED)}</div>` : ''}
    ${DATA.resultsFile ? '' : '<div class="d-rec d-warn">Results cannot be recorded yet: they need a git repo with at least one commit.</div>'}
    ${since ? sinceBanner(since) : ''}
    <div class="d-qprep"><span class="d-lab">${term('prepare', 'Prepare')}</span><span class="d-qpreptext">${
      setup.length ? setup.map((x, i) => `${i + 1}. ${esc(x)}`).join(' ') : '<span class="d-none">Nothing to set up.</span>'
    }</span><span class="d-qprepn">${plural(setup.length, 'thing')}</span></div>
    <div class="d-qlist">${p.qa.steps.map((qs, i) => (i === cur ? qaCurrent(fid, p, qs, i) : qaRow(fid, p, qs, i))).join('')}</div>
    <div class="d-qkeys">
      <span><kbd>J</kbd><kbd>K</kbd>next / previous step</span>
      <span><kbd>P</kbd><kbd>F</kbd><kbd>X</kbd>record and move on</span>
      <span><kbd>N</kbd>note</span>
      <span class="d-qthen">${
        next
          ? `Then: <button ${set({ path: next.path.id === 'main' ? null : next.path.id, qa: null, step: null, part: null })}>${next.why}, ${esc(next.path.name)} →</button>`
          : t.all && !t['not-checked']
            ? 'Every path of this Flow is checked.'
            : ''
      }</span>
    </div>
  </div>`;
}

// Records a result on the current QA Step, with its note, then moves on to the next one.
async function recordCurrent(ref, state) {
  const input = [...document.querySelectorAll('[data-note]')].find((el) => el.dataset.note === ref);
  const note = state === 'not-checked' ? '' : (input?.value ?? '');
  await post('/api/result', { ...JSON.parse(ref), state, note });
  if (REFUSED) return render();
  NOTES.delete(ref);
  const fid = q('flow');
  const P = DATA.flows[fid]?.paths ?? [];
  const p = P.find((x) => x.id === q('path')) ?? P[0];
  const at = p ? p.qa.steps.findIndex((qs) => qaRef(fid, p, qs) === ref) : -1;
  if (state === 'not-checked' || at < 0) return setQ({ qa: at < 0 ? null : at });
  setQ({ qa: Math.min(at + 1, p.qa.steps.length - 1) });
}

// The Step a path opens on: a Variant's first Step of its own, the main path's first.
const startStep = (p) => p.divergesAt ?? 0;
function currentStep(p) {
  const n = Number.parseInt(q('step') ?? '', 10);
  return Number.isInteger(n) && n >= 0 && n < p.steps.length ? n : startStep(p);
}

function flowPage(fid) {
  const f = DATA.flows[fid];
  const actor = DATA.actors[f.actor];
  const P = f.paths;
  const p = P.find((x) => x.id === q('path')) ?? P[0];
  const check = q('tab') === 'check';
  const cur = currentStep(p);
  const { uncommitted, last } = changes(fid);
  const order = flowOrder();
  const at = order.indexOf(fid);
  const [prev, next] = [order[at - 1], order[at + 1]];
  const navBtn = (id, label) =>
    id ? `<a class="d-btn2" href="${esc(flowHref(id))}" title="${esc(DATA.flows[id].name)}">${label}</a>` : `<span class="d-btn2 off">${label}</span>`;
  const t = tally(fid, P);
  const variants = P.slice(1);

  return `<div class="d-flow">
    <div class="d-fhead">
      <div class="d-ftitle">
        <div class="d-fcrumb">${esc(areaName(areaOf(fid)))}</div>
        <h1 class="d-h1">${esc(f.name)}</h1>
        <div class="d-lead">${esc(f.goal)}</div>
      </div>
      <div class="d-fnav">${navBtn(prev, `← ${prev ? esc(DATA.flows[prev].name) : 'Previous'}`)}${navBtn(next, `${next ? esc(DATA.flows[next].name) : 'Next'} →`)}</div>
    </div>
    <div class="d-facts">
      <div class="d-fact"><div class="d-lab">${term('actor', 'Actor')}</div><div class="d-clamp" ${actor?.is ? `title="${esc(actor.is)}"` : ''}><b>${esc(actorName(f))}</b>${actor?.is ? `<span class="dim"> · ${esc(actor.is)}</span>` : ''}</div></div>
      <div class="d-fact"><div class="d-lab">${term('trigger', 'Trigger')}</div><div>${esc(f.trigger)}</div></div>
      <div class="d-fact"><div class="d-lab">Before it starts</div>${(f.preconditions ?? []).map(precondition).join('') || '<div class="d-none">Nothing.</div>'}</div>
    </div>
    <div class="d-tabs" role="tablist">
      <button class="d-tab ${check ? '' : 'on'}" role="tab" aria-selected="${!check}" ${set({ tab: null })}>Read the Flow<kbd>R</kbd></button>
      <button class="d-tab ${check ? 'on' : ''}" role="tab" aria-selected="${check}" ${set({ tab: 'check' })}>Check by hand${squares(fid, p)}<kbd>C</kbd></button>
      <span class="d-tabr">${
        check
          ? `<span ${DATA.resultsFile ? `title="${esc(DATA.resultsFile)}"` : ''}>Results stay on this machine, outside the repo</span>`
          : `${uncommitted ? `<span class="d-warn">${term('uncommitted', 'changes not committed')}</span> · ` : ''}${
              last ? `last commit to change it <span title="${esc(last.sha)} ${esc(last.subject)}">${esc(short(last))}</span> · ${esc(ago(last.date))}` : 'no commit has changed it'
            }`
      }</span>
    </div>
    <div class="d-fbody">
      <div class="d-pathcol" data-pane="paths" data-key="${esc(fid)}">
        ${pathCard(fid, P, P[0], p, check)}
        ${variants.length ? `<div class="d-lab d-vlab">${term('variant', 'Variants')} · ${variants.length}</div>${variants.map((x) => pathCard(fid, P, x, p, check)).join('')}` : ''}
        ${
          check
            ? `<div class="d-pfoot">This Flow · ${[['passed', 'passed'], ['failed', 'failed'], ['could-not-perform', 'could not perform'], ['not-checked', 'not checked']]
                .filter(([k]) => t[k])
                .map(([k, label]) => `${t[k]} ${label}`)
                .join(' · ')}</div>`
            : ''
        }
      </div>
      <div class="d-content ${check ? 'check' : ''}" data-pane="content" data-key="${esc(`${fid}|${p.id}|${check}`)}">
        ${
          check
            ? checkByHand(fid, P, p)
            : `${p.id !== 'main' && p.divergesAt == null ? `<div class="d-vbanner"><span class="d-lab blue">${term('variant', 'Variant')}</span><span>${esc(p.when)}</span><span class="d-warn">It leaves at a Step the main path does not have.</span></div>` : ''}
               ${p.steps.map((s, i) => stepRow(fid, P, p, s, i, cur)).join('')}
               <div class="d-outcome"><span class="d-lab green">Outcome</span><span>${esc(p.outcome)}</span></div>`
        }
      </div>
    </div>
  </div>`;
}

// ---------- wiring ----------

let SHOWN = {}; // what the last render showed, to tell a new Step or path from a redraw
function render() {
  const app = document.getElementById('app');
  if (DATA.error) {
    app.innerHTML = `<div class="d-error"><div class="d-lab d-warn">The knowledge base could not be read</div><pre>${esc(DATA.error)}</pre></div>`;
    return;
  }
  // Redrawing replaces the panes, so each keeps its scroll position as long as it still shows the same thing.
  const kept = Object.fromEntries([...document.querySelectorAll('[data-pane]')].map((el) => [el.dataset.pane, { key: el.dataset.key, top: el.scrollTop }]));
  const searching = document.activeElement?.matches?.('[data-search]');
  const fid = DATA.flows[q('flow')] ? q('flow') : null;
  document.title = fid ? `${DATA.flows[fid].name} · Fledgy` : q('page') === 'changes' ? `Changes · Fledgy · ${DATA.repo.name}` : `Fledgy · ${DATA.repo.name}`;
  hideTip();
  app.innerHTML = `<div class="d-shell">${sidebar(fid)}<main class="d-main">${fid ? flowPage(fid) : q('page') === 'changes' ? changesPage() : overview()}</main></div>${twPopover()}`;
  for (const el of document.querySelectorAll('[data-pane]')) if (kept[el.dataset.pane]?.key === el.dataset.key) el.scrollTop = kept[el.dataset.pane].top;
  if (searching) {
    const input = app.querySelector('[data-search]');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  placePopover();
  // A Step or a QA Step chosen elsewhere than in view is brought into it; a path opened on a Variant starts where it leaves.
  const check = q('tab') === 'check';
  const target = document.querySelector(check ? '.d-qcur' : '.d-step.on');
  const shown = fid && { path: `${fid}|${q('path')}|${q('tab')}`, at: check ? q('qa') : q('step') };
  if (target && shown && (shown.path !== SHOWN.path || shown.at !== SHOWN.at)) {
    if (shown.path === SHOWN.path || check) target.scrollIntoView({ block: 'nearest' });
    else if (+target.dataset.step > 0) target.scrollIntoView({ block: 'start' });
  }
  SHOWN = shown || {};
}

function openToWrite(id) {
  const e = toWrite().find((x) => x.id === id);
  if (!e) return;
  // The sidebar unfolds to the entry, so the popover can sit level with it.
  EXPANDED.delete(e.area);
  TWOPEN.delete(e.area);
  clearSearch();
  setQ({ tw: q('tw') === id ? null : id });
}

document.addEventListener('click', async (e) => {
  // A click outside the popover closes it, and one outside the search closes its results.
  if (q('tw') && !e.target.closest('.d-pop, [data-tw]')) setQ({ tw: null });
  if (SEARCH && !e.target.closest('.d-search')) {
    clearSearch();
    showSearch();
  }
  const a = e.target.closest('a[href^="/"]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault();
    if (a.matches('[data-found]')) clearSearch();
    return go(a.getAttribute('href'));
  }
  const t = e.target.closest('[data-set],[data-result],[data-reset],[data-area],[data-twlist],[data-tw],[data-copy],[data-fold]');
  if (!t) return;
  if (t.dataset.area != null) {
    const open = t.getAttribute('aria-expanded') === 'true';
    EXPANDED.set(t.dataset.area, !open);
    return render();
  }
  if (t.dataset.twlist != null) {
    TWOPEN.set(t.dataset.twlist, !t.matches('.open'));
    return render();
  }
  if (t.dataset.tw != null) return openToWrite(t.dataset.tw);
  if (t.dataset.fold != null) {
    FOLDS.has(t.dataset.fold) ? FOLDS.delete(t.dataset.fold) : FOLDS.add(t.dataset.fold);
    return render();
  }
  if (t.dataset.copy != null) {
    const done = () => (t.textContent = 'Copied');
    return navigator.clipboard?.writeText(t.dataset.copy).then(done, () => (t.textContent = 'Select and copy it'));
  }
  if (t.dataset.set) setQ(JSON.parse(t.dataset.set));
  if (t.dataset.reset) await post('/api/result-reset', JSON.parse(t.dataset.reset));
  else if (t.dataset.result) {
    // The note is read from the page: a click on a state can land before the note's own change is saved.
    return recordCurrent(t.dataset.result, t.dataset.state);
  } else return;
  render();
});
// Saving a note redraws nothing, so a click that follows it straight away still lands on its button.
document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-note]')) return;
  const ref = JSON.parse(e.target.dataset.note);
  const p = DATA.flows[ref.flow]?.paths.find((x) => x.id === ref.path);
  const qs = p?.qa.steps.find((x) => x.id === ref.step);
  // A note on a step not checked yet is kept until its result is recorded.
  if (qs && result(ref.flow, p, qs).state !== 'not-checked') post('/api/note', { ...ref, note: e.target.value });
});

// The search shows its results as the Builder types, without redrawing the page.
document.addEventListener('input', (e) => {
  if (e.target.matches('[data-note]')) return NOTES.set(e.target.dataset.note, e.target.value);
  if (!e.target.matches('[data-search]')) return;
  SEARCH = e.target.value;
  SEARCH_AT = 0;
  showSearch();
});

document.addEventListener('keydown', (e) => {
  const search = document.querySelector('[data-search]');
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    search?.focus();
    search?.select();
    return;
  }
  if (e.target === search) {
    const found = document.querySelectorAll('[data-found]');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      SEARCH_AT = Math.max(0, Math.min(found.length - 1, SEARCH_AT + (e.key === 'ArrowDown' ? 1 : -1)));
      showSearch();
    } else if (e.key === 'Enter') found[SEARCH_AT]?.click();
    else if (e.key === 'Escape') {
      clearSearch();
      search.value = '';
      showSearch();
      search.blur();
    }
    return;
  }
  // Enter or Escape leaves a note, which saves it, so the keys work again.
  if (e.target.matches?.('[data-note]') && (e.key === 'Enter' || e.key === 'Escape')) {
    e.preventDefault();
    return e.target.blur();
  }
  if (e.key === 'Escape') {
    hideTip();
    if (q('tw')) setQ({ tw: null });
    return;
  }
  // The keys of the Flow page, unless a note is being typed.
  if (e.target.closest?.('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const fid = DATA?.flows?.[q('flow')] ? q('flow') : null;
  if (!fid) return;
  const key = e.key.toLowerCase();
  if (key === 'r') setQ({ tab: null });
  else if (key === 'c') setQ({ tab: 'check' });
  else if ((key === 'j' || key === 'k') && q('tab') !== 'check') {
    const P = DATA.flows[fid].paths;
    const p = P.find((x) => x.id === q('path')) ?? P[0];
    const step = Math.max(0, Math.min(p.steps.length - 1, currentStep(p) + (key === 'j' ? 1 : -1)));
    setQ({ step, part: null });
  } else if (q('tab') === 'check' && ['j', 'k', 'p', 'f', 'x', 'n'].includes(key)) {
    const P = DATA.flows[fid].paths;
    const p = P.find((x) => x.id === q('path')) ?? P[0];
    const cur = currentQa(fid, p);
    const qs = p.qa.steps[cur];
    if (!qs) return;
    if (key === 'j' || key === 'k') return setQ({ qa: Math.max(0, Math.min(p.qa.steps.length - 1, cur + (key === 'j' ? 1 : -1))) });
    if (qs.id == null) return;
    if (key === 'n') {
      e.preventDefault();
      const note = document.querySelector('.d-qcur [data-note]');
      note?.focus();
      return note?.setSelectionRange(note.value.length, note.value.length);
    }
    recordCurrent(qaRef(fid, p, qs), { p: 'passed', f: 'failed', x: 'could-not-perform' }[key]);
  }
});
addEventListener('resize', placePopover);

// Read again on load and whenever the window comes back to the front, so an edit, a stage or a commit made elsewhere shows.
// A note being typed is left alone: redrawing would throw away what is not saved yet.
async function refresh() {
  if (document.activeElement?.matches('[data-note]')) return;
  DATA = await fetch('/api/data').then((r) => r.json());
  READ_AT = Date.now();
  render();
}
window.addEventListener('focus', refresh);
setInterval(() => {
  const el = document.querySelector('[data-read]');
  if (el) el.textContent = readAgo();
}, 1000);
refresh();
