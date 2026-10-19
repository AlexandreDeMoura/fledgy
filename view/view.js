// The web view of the knowledge base. It is read-only but for one thing: on a Flow's page the
// Builder records a QA Result on each QA Step, one of four states and a note.
// A home page lists the Flows grouped by Area, can be narrowed to the Flows that changed (not
// committed yet, or in the last commits) and previews one; under them, always in view, the
// Flows to write. A page per Flow: its facts, a chip per path and the strip of Steps on top, and
// two panes below that scroll on their own: the current Step with its Parts, and the current
// path's Manual QA Check. While one pane is being scrolled the other blurs and carries a
// table of contents of the scrolled one.
// Every term on screen is underlined, and hovering or focusing it shows its sentence from the guide.
// Everything on screen is addressed by the URL, so any state can be reloaded or shared.

let DATA;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const q = (k) => new URL(location.href).searchParams.get(k);
const set = (obj) => `data-set="${esc(JSON.stringify(obj))}"`;
function setQ(obj) {
  const u = new URL(location.href);
  for (const [k, v] of Object.entries(obj)) v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v);
  history.replaceState(null, '', u);
  render();
}

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
  entity: ['Entity', 'A Part the app stores and keeps between visits, like a thread or an agent.'],
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
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function ago(date) {
  const min = Math.round((Date.now() - Date.parse(date)) / 60000);
  if (min < 1) return 'just now';
  return `${min < 60 ? plural(min, 'minute') : min < 1440 ? plural(Math.round(min / 60), 'hour') : plural(Math.round(min / 1440), 'day')} ago`;
}

// ---------- QA Results: one of four states per QA Step ----------

const STATES = [
  ['not-checked', 'Not checked'],
  ['passed', 'Passed'],
  ['failed', 'Failed'],
  ['could-not-perform', 'Could not perform'],
];
const STATE_LINE = { 'not-checked': 'Not checked', passed: '✓ Passed', failed: '✕ Failed', 'could-not-perform': '– Could not perform' };

let REFUSED = null; // what the server said when it last refused to record a result
const result = (fid, p, qs) => DATA.results[fid]?.[p.id]?.[qs.id] ?? { state: 'not-checked', note: '' };
function tally(fid, P) {
  const t = { 'not-checked': 0, passed: 0, failed: 0, 'could-not-perform': 0, all: 0 };
  for (const p of P) for (const qs of p.qa.steps) (t[result(fid, p, qs).state]++, t.all++);
  return t;
}
function qaChip(fid, P) {
  const t = tally(fid, P);
  const cls = t.failed ? 'failed' : t.passed === t.all ? 'passed' : t['could-not-perform'] ? 'could-not-perform' : '';
  return `<span class="d-qa ${cls}">${term('qachip', `QA ${t.failed ? `${t.failed} failed` : `${t.passed}/${t.all} passed`}`, true)}</span>`;
}
// The answer to a change is the whole of the data again, or why the change was refused.
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const sent = await r.json();
  REFUSED = r.ok ? null : sent.error;
  if (r.ok) DATA = sent;
}

// ---------- shared pieces ----------

function bar(crumbs, right) {
  return `<div class="d-bar">
    <a class="d-logo" href="/"><i></i>Fledgy</a>
    ${crumbs.map((c) => `<span class="d-sl">/</span>${c}`).join('')}
    <div class="d-barr"><i class="d-dot"></i>${term('live', 'Live from knowledge-base/')}${right}</div>
  </div>`;
}

// The Flow page states both lines even when empty; the home preview keeps only the ones that say something.
function sides(s, compact) {
  if (compact && !s.does && !s.sees) return `<div class="d-none">Nothing changes on screen.</div>`;
  const line = (label, text, empty) =>
    compact && !text ? '' : `<div class="d-kv"><span>${label}</span><div class="${text ? '' : 'd-none'}">${esc(text ?? empty)}</div></div>`;
  return line('Does', s.does, 'Nothing.') + line('Sees', s.sees, 'Nothing changes on screen.');
}

// ---------- git: what changed a Flow ----------
// A Flow changed when its own file did, the file of a Part it names, or a code file one of those Parts' Anchors points into.

const short = (c) => c.sha.slice(0, 7);
const changes = (fid) => DATA.changes.flows[fid] ?? { uncommitted: false };
const commitRow = (c) =>
  `<div class="d-commit"><span class="d-mono" title="${esc(c.sha)}">${esc(short(c))}</span><span>${esc(c.subject)}</span><span class="d-when">${esc(ago(c.date))}</span></div>`;

// ---------- Flows to write: entries under an Area in areas.yaml, with no file ----------

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

// ---------- home: Flows grouped by Area, with a preview, and the Flows to write under them ----------

const FILTERS = [
  ['', 'All'],
  ['uncommitted', 'Not committed'],
  ['1', 'Last commit'],
  ['3', 'Last 3 commits'],
  ['10', 'Last 10 commits'],
];
// The Flows a filter keeps: all of them, the ones with changes that are not committed,
// or the ones changed by one of the branch's last n commits.
function matching(show) {
  const ids = Object.keys(DATA.flows);
  if (!show) return ids;
  if (show === 'uncommitted') return ids.filter((id) => changes(id).uncommitted);
  const touched = new Set(DATA.changes.recent.slice(0, +show).flatMap((c) => c.flows));
  return ids.filter((id) => touched.has(id));
}

function home() {
  const flows = DATA.flows;
  const areas = DATA.areas;
  const areaName = (aid) => areas[aid]?.name ?? (aid || 'No Area');
  const TW = toWrite();
  const show = FILTERS.some(([k]) => k === q('show')) ? q('show') : '';
  const kept = matching(show);
  const scope = +show ? DATA.changes.recent.slice(0, +show) : [];
  const lastN = scope.length === 1 ? 'the last commit' : `the last ${scope.length} commits`;
  // Under a filter only the Areas with a Flow it keeps; otherwise every Area, even one with no Flow yet.
  const areaIds = [...new Set([...Object.keys(areas), ...kept.map(areaOf)])].filter((aid) => !show || kept.some((id) => areaOf(id) === aid));
  // The Flows in the order of their rows, so the preview starts on the first row.
  const ids = areaIds.flatMap((aid) => kept.filter((id) => areaOf(id) === aid));
  const pv = ids.includes(q('pv')) ? q('pv') : ids[0];

  // A click selects the row for the preview; a click on the selected row opens the Flow.
  const row = (id) => {
    const f = flows[id];
    const on = pv === id;
    const last = changes(id).last;
    return `<button class="d-row ${on ? 'on' : ''}" ${set(on ? { flow: id, pv: null, show: null, tw: null } : { pv: id })}>
      <span class="d-rowt"><span>${esc(f.name)}</span>${changes(id).uncommitted ? `<span class="d-tag amber">${term('uncommitted', 'Not committed', true)}</span>` : ''}${qaChip(id, f.paths)}</span>
      <span class="d-rowm">${esc(DATA.actors[f.actor]?.name ?? f.actor)} · ${plural(f.paths[0].steps.length, 'step')} · ${term('variant', plural(f.paths.length - 1, 'Variant'), true)}${last ? ` · changed ${esc(ago(last.date))}` : ''}</span>
      ${scope
        .filter((c) => c.flows.includes(id))
        .map((c) => `<span class="d-rowc">changed in <b>${esc(short(c))}</b> ${esc(c.subject)}</span>`)
        .join('')}
    </button>`;
  };

  const list =
    ids.length || (!show && areaIds.length)
      ? areaIds
          .map((aid) => {
            const inArea = ids.filter((id) => areaOf(id) === aid);
            const area = areas[aid];
            return `<div class="d-area">
          <div class="d-lab">${esc(areaName(aid))} · ${plural(inArea.length, 'Flow')}${area ? '' : ` · <span class="d-warn">${aid ? 'Area not in areas.yaml' : 'These Flows name no Area'}</span>`}</div>
          ${area ? `<div class="d-areais">${esc(area.is)}</div>` : ''}
        </div>${inArea.map(row).join('')}`;
          })
          .join('')
      : `<div class="d-empty">${
          !show
            ? 'Nothing mapped yet. In Claude Code, type <span class="d-mono">/map-the-app</span>.'
            : show === 'uncommitted'
              ? 'No Flow has changes that are not committed.'
              : scope.length === 0
                ? 'This branch has no commit yet.'
                : scope.length === 1
                  ? 'The last commit did not change a Flow.'
                  : `None of ${lastN} changed a Flow.`
        }</div>`;

  // The Flows to write: one list of its own, across Areas. An entry opens in place, one at a time.
  const backlog = TW.length
    ? `<div class="d-tw">
        <div class="d-area"><div class="d-lab">${term('towrite', 'To write')} · ${plural(TW.length, 'Flow')}</div>
          <div class="d-areais">Flows the app has but nobody has written yet.</div></div>
        <div class="d-backlog ${TW.some((e) => e.id === q('tw')) ? 'open' : ''}" data-pane="towrite" data-key="towrite">${TW.map((e) => {
          const open = q('tw') === e.id;
          return `<button class="d-bl ${open ? 'on' : ''}" ${set({ tw: open ? null : e.id })}>
              <span class="d-blname">${esc(e.name)}</span><span class="d-tag">${esc(areaName(e.area))}</span><span class="d-caret">${open ? '▴' : '▾'}</span>
            </button>${
              open
                ? `<div class="d-blopen"><div>${esc(e.is)}</div>
                    <div class="d-blwait">${
                      e.waited.length
                        ? `Waited for by ${e.waited.map((fid) => `<a class="d-ref" href="/?flow=${encodeURIComponent(fid)}">${esc(flows[fid].name)}</a>`).join(' ')}`
                        : 'No written Flow waits for it.'
                    }</div></div>`
                : ''
            }`;
        }).join('')}</div>
      </div>`
    : '';

  let preview;
  if (flows[pv]) {
    const f = flows[pv];
    const [main, ...variants] = f.paths;
    const { uncommitted, last } = changes(pv);
    preview = `<div class="d-lab">Preview · ${esc(areaName(areaOf(pv)))}</div>
      <div class="d-pvhead">
        <div>
          <div class="d-h2">${esc(f.name)}</div>
          <div class="d-lead">${esc(f.goal)}</div>
          <div class="d-chg">${uncommitted ? '<span class="d-warn">Has changes that are not committed.</span> ' : ''}${
            last ? `Last commit to change it: <span class="d-mono">${esc(short(last))}</span> ${esc(last.subject)}, ${esc(ago(last.date))}.` : 'Never committed.'
          }</div>
        </div>
        <a class="d-btn" href="/?flow=${encodeURIComponent(pv)}">Open Flow →</a>
      </div>
      <div class="d-table">
        <div class="d-tr d-th"><div></div><div>${esc(DATA.actors[f.actor]?.name ?? f.actor)}</div><div>${term('system', 'System')}</div></div>
        ${main.steps
          .map(
            (s, i) => `<div class="d-tr">
              <div class="d-tn"><span class="d-num">${i + 1}</span></div>
              <div class="d-tc">${sides(s, true)}</div>
              <div class="d-tc d-tsys ${s.system ? '' : 'd-none'}">${esc(s.system ?? 'Nothing.')}</div>
            </div>`
          )
          .join('')}
        <div class="d-tfoot"><span class="d-lab green">Outcome</span>${esc(main.outcome)}</div>
      </div>
      ${
        variants.length
          ? `<div class="d-lab d-gap">${term('variant', plural(variants.length, 'Variant'))}</div>
        <div class="d-table">${variants
          .map(
            (p) => `<a class="d-vrow" href="/?flow=${encodeURIComponent(pv)}&path=${encodeURIComponent(p.id)}">
              <span class="d-vname">${esc(p.name)}</span>
              <span class="d-vwhen">${esc(p.when)}</span>
              <span class="d-rowm">${p.divergesAt == null ? '' : `leaves the main path at step ${p.divergesAt + 1}`}</span>
            </a>`
          )
          .join('')}</div>`
          : ''
      }`;
  } else if (show) {
    preview = `<div class="d-lab">Nothing to show</div>
      <div class="d-pvhead"><div>
        <div class="d-h2">No Flow matches</div>
        <div class="d-lead">${
          scope.length
            ? `${scope.length === 1 ? 'This is the last commit' : `These are ${lastN}`} on this branch. ${scope.length === 1 ? 'It did not change' : 'None of them changed'} a Flow.`
            : show === 'uncommitted'
              ? 'Every Flow is the same as in the last commit.'
              : 'This branch has no commit yet.'
        }</div>
      </div></div>
      ${scope.length ? `<div class="d-table">${scope.map(commitRow).join('')}</div>` : ''}`;
  } else {
    // No Flow written: what to do next, whether the Areas are there yet or not.
    const some = Object.keys(areas).length;
    preview = `<div class="d-lab">Nothing to show</div>
      <div class="d-pvhead"><div>
        <div class="d-h2">${some ? 'No Flow written yet' : 'Nothing mapped yet'}</div>
        <div class="d-lead">${
          some
            ? 'The Areas and the Flows to write are listed on the left. In Claude Code, type <span class="d-mono">/map-the-app</span> to carry on: Fledgy writes the Flows with you, one Area at a time.'
            : 'In Claude Code, type <span class="d-mono">/map-the-app</span>. Fledgy reads your code, proposes the Areas it sees for you to correct, then writes their Flows with you, one Area at a time. This page fills in as it goes.'
        }</div>
        <div class="d-chg"><a class="d-link" href="${GUIDE}" target="_blank" rel="noopener">New to the words? Read the guide →</a></div>
      </div></div>`;
  }

  // With no Flow written there is nothing to filter, and no change to explain.
  const written = Object.keys(flows).length > 0;
  const count = (things, word) => plural(Object.keys(things).length, word);
  return `${bar(
    [`<b>${esc(DATA.repo.name)}</b>`],
    `<span class="d-mono dim">· ${count(flows, 'Flow')} · ${count(areas, 'Area')}${TW.length ? ` · ${TW.length} to write` : ''}</span>`
  )}
  <div class="d-home">
    <div class="d-list">
      <div class="d-listhead">
        <div class="d-h1">What the app does</div>
        <div class="d-lead">Every ${term('flow', 'Flow')} in the knowledge base, grouped by ${term('area', 'Area')}.</div>
      </div>
      ${
        written
          ? `<div class="d-filters">${FILTERS.map(
              ([k, label]) => `<button class="d-filter ${k === show ? 'on' : ''}" ${set({ show: k || null, pv: null })}>${label}<span>${matching(k).length}</span></button>`
            ).join('')}</div>`
          : ''
      }
      ${
        show === 'uncommitted'
          ? '<div class="d-scope">Flows with a file that is new or has changes, staged or not.</div>'
          : scope.length
            ? `<div class="d-scope">Flows changed in ${lastN} on this branch, back to <span class="d-mono">${esc(short(scope.at(-1)))}</span> (${esc(ago(scope.at(-1).date))}).</div>`
            : ''
      }
      <div class="d-flows" data-pane="flows" data-key="${esc(show)}">
        ${list}
        ${written ? '<div class="d-listfoot"><b>What counts as a change.</b> A Flow changed when its own file changed, or any code it points to. The Flows to write have no file yet, so the filters skip them.</div>' : ''}
      </div>
      ${backlog}
    </div>
    <div class="d-preview" data-pane="preview" data-key="${esc(pv ?? '')}">${preview}</div>
  </div>`;
}

// ---------- flow page ----------

function anchor(a) {
  const [path, symbol] = a.at.split('#');
  return `<div class="d-anchor"><span>${esc(a.label)}</span>
    <a href="vscode://file/${encodeURI(DATA.repo.root + '/' + path)}" title="Open in VS Code">${esc(path)}${symbol ? `<b>#${esc(symbol)}</b>` : ''}</a></div>`;
}

// One row of the Parts container. Only the open Part shows its sentence and its Anchors; the others are a click away.
function partRow(id, p, cur, open) {
  const part = DATA.parts[id];
  const sec = `data-sec="part:${esc(id)}"`;
  if (!part) return `<div class="d-prow" ${sec}><span class="d-mono">${esc(id)}</span><span class="d-warn">No file at parts/${esc(id)}.yaml</span></div>`;
  const head = `<span class="d-pname">${esc(part.name)}</span>${part.entity ? `<span class="d-tag">${term('entity', 'Entity', id !== open)}</span>` : ''}`;
  if (id !== open)
    return `<button class="d-prow" ${sec} data-in="left" data-goto="part:${esc(id)}" ${set({ part: id, dp: null })}>${head}<span class="d-pteaser">${esc(part.is)}</span><span class="d-caret">Show ▾</span></button>`;
  const shown = q('dp') != null;
  const by = (side) => (part.anchors ?? []).filter((a) => a.side === side);
  const sided = [['screen', 'Screen'], ['backend', 'Backend']].filter(([k]) => by(k).length);
  const also = p.steps.map((s, j) => j).filter((j) => j !== cur && (p.steps[j].parts ?? []).includes(id));
  return `<div class="d-popen" ${sec}>
    <div class="d-partb">
      <div class="d-parth">${head}
        ${also.length ? `<span class="d-also">also in step ${also.map((j) => `<button ${set({ step: j, part: id, dp: null })}>${j + 1}</button>`).join(' ')}</span>` : ''}</div>
      <div class="d-pis">${esc(part.is)}</div>
      ${part.relations ? `<div class="d-prel">${part.relations.map(esc).join(' · ')}</div>` : ''}
    </div>
    <button class="d-atoggle" ${set({ dp: shown ? null : 1 })}>${term('anchor', 'Where it lives in the code', true)}
      <span class="d-mono dim">${sided.map(([k]) => `${by(k).length} ${k}`).join(' · ')}</span><span class="d-caret">${shown ? 'Hide ▴' : 'Show ▾'}</span></button>
    ${shown ? `<div class="d-anchs">${sided.map(([k, label]) => `<div class="d-aside"><div class="d-lab">${label}</div>${by(k).map(anchor).join('')}</div>`).join('')}</div>` : ''}
  </div>`;
}

// The table of contents of one pane. It floats over the other pane while this one is being scrolled.
function toc(pane, title, entries) {
  return `<div class="d-toc" data-toc="${pane}"><div class="d-lab">${esc(title)}</div>${entries
    .map((x) => `<button data-in="${pane}" data-goto="${esc(x.sec)}" ${x.set ? set(x.set) : ''}>${x.html}</button>`)
    .join('')}</div>`;
}

// A precondition is a sentence, or names the Flow that brings it about: one that has a file, or one still to write,
// which links to its entry on the home page. The Flow shows by its name; only one that is nowhere shows its id.
function precondition(pre) {
  if (typeof pre === 'string') return `<li>${esc(pre)}</li>`;
  const id = pre.flow ?? pre.flow_to_write;
  const name = esc(DATA.flows[id]?.name ?? toWrite().find((e) => e.id === id)?.name ?? id);
  return `<li>${esc(pre.so_that)} ${
    DATA.flows[id]
      ? `<a class="d-ref d-named" title="Open this Flow" href="/?flow=${encodeURIComponent(id)}">${name}</a>`
      : pre.flow_to_write
        ? `<a class="d-ref d-named missing" title="A Flow to write: see it on the home page" href="/?tw=${encodeURIComponent(id)}">${name} · not written</a>`
        : `<span class="d-ref missing" title="No Flow file with this id yet">${name}</span>`
  }</li>`;
}

// What has happened to the Flow since the results on this path were recorded: the result with the most to say.
// A change never clears a result: the Builder is told, and decides whether to reset.
function changedSince(fid, p) {
  const moved = p.qa.steps.map((qs) => result(fid, p, qs).since).filter((c) => c && (c.commits.length || c.uncommitted));
  if (!moved.length) return null;
  const most = moved.reduce((a, b) => (b.commits.length > a.commits.length ? b : a));
  return { commits: most.commits, byDate: most.byDate, uncommitted: moved.some((c) => c.uncommitted) };
}

function sinceBanner(c) {
  const n = c.commits.length;
  const text = n
    ? `${plural(n, 'commit')} ${n === 1 ? 'has' : 'have'} changed this Flow since this path was checked${c.uncommitted ? ', and it has changes that are not committed yet' : ''}.`
    : 'This Flow has changes that are not committed yet, made after this path was checked.';
  return `<div class="d-since" data-sec="since">
    <div class="d-lab">Changed since the last check</div>
    <div>${text}</div>
    ${n ? `<div>${c.commits.map(commitRow).join('')}</div>` : ''}
    ${n && c.byDate ? '<div class="d-sincef d-warn">The commit the check was recorded on is not in this branch’s history, so these are the commits made after the date of the check.</div>' : ''}
    <div class="d-sincef">A commit changes a Flow when it touches the Flow’s file, the file of a Part it names, or code one of those Parts’ Anchors points into. The results are kept as they are. Record a step again once you have looked, or reset them if they no longer hold.</div>
  </div>`;
}

function qaStep(fid, p, qs, i) {
  const r = result(fid, p, qs);
  const ref = esc(JSON.stringify({ flow: fid, path: p.id, step: qs.id }));
  const after = [
    r.since?.commits.length ? `${plural(r.since.commits.length, 'commit')} to this Flow since${r.since.byDate ? ', by date' : ''}` : '',
    r.since?.uncommitted ? 'uncommitted changes since' : '',
  ]
    .filter(Boolean)
    .join(' and ');
  return `<div class="d-card d-check s-${r.state}" data-sec="qa:${i}">
    <div class="d-checkh"><span class="d-num">${i + 1}</span><span class="d-st s-${r.state}">${STATE_LINE[r.state]}</span></div>
    <div class="d-dx">
      <span>Do</span><div class="d-do">${esc(qs.do)}</div>
      <span>Expect</span><div>${esc(qs.expect)}</div>
    </div>
    ${
      qs.id == null
        ? '<div class="d-rec d-warn">This QA Step has no id, so no result can be recorded on it.</div>'
        : `<div class="d-seg">${STATES.map(([st, label]) => `<button class="${r.state === st ? 'on' : ''}" data-result="${ref}" data-state="${st}">${st === 'could-not-perform' ? term('cnp', label, true) : label}</button>`).join('')}</div>`
    }
    ${
      r.state !== 'not-checked'
        ? `<div class="d-rec" title="${esc(new Date(r.date).toLocaleString())} · ${esc(r.commit)}">Recorded ${ago(r.date)} on ${esc(r.commit.slice(0, 7))}${r.uncommitted ? ' · <span class="d-warn">with changes to this Flow that were not committed</span>' : ''}${after ? ` · <span class="d-warn">${after}</span>` : ''}</div>
    <textarea data-note="${ref}" rows="2" placeholder="Optional note about what you saw">${esc(r.note)}</textarea>`
        : ''
    }
  </div>`;
}

function flowPage(fid) {
  const f = DATA.flows[fid];
  const a = DATA.actors[f.actor];
  const area = DATA.areas[areaOf(fid)];
  const P = f.paths;
  const p = P.find((x) => x.id === q('path')) ?? P[0];
  const cur = Math.min(Math.max(+(q('step') ?? p.divergesAt ?? 0) || 0, 0), p.steps.length - 1);
  const s = p.steps[cur];
  const actorName = a?.name ?? f.actor;
  const parts = s.parts ?? [];
  const open = parts.includes(q('part')) ? q('part') : parts[0];
  const t = tally(fid, [p]);
  const since = changedSince(fid, p);
  const { uncommitted, last } = changes(fid);
  const tallyLine = [['passed', 'passed'], ['failed', 'failed'], ['could-not-perform', 'could not perform'], ['not-checked', 'not checked']]
    .filter(([k]) => t[k])
    .map(([k, label]) => `<span class="d-st s-${k}">${t[k]} ${label}</span>`)
    .join('<span class="dim"> · </span>');

  const strip = p.steps
    .map(
      (st, i) => `<button class="d-cell ${i === cur ? 'on' : ''} ${st.shared ? 'shared' : ''}" ${set({ step: i, part: null, dp: null })}>
        <span class="d-cellh"><span class="d-num">${i + 1}</span>
          ${st.shared ? '<span class="d-tag">Same as main path</span>' : i === p.divergesAt ? `<span class="d-tag blue">${term('leaves', 'Leaves the main path', true)}</span>` : ''}</span>
        <span class="d-cellt">${esc(st.does ?? st.sees ?? st.system)}</span>
        <span class="d-who"><i class="${st.does ? 'y' : ''}">Does</i><i class="${st.sees ? 'y' : ''}">Sees</i><i class="${st.system ? 'y' : ''}">System</i><i class="y">${plural((st.parts ?? []).length, 'Part')}</i></span>
      </button>`
    )
    .join('');

  return `${bar(
    [
      `<a class="d-crumb" href="/?pv=${encodeURIComponent(fid)}">${esc(DATA.repo.name)} · Home</a>`,
      `<span class="d-crumbx">${esc(area?.name ?? (areaOf(fid) || 'No Area'))}</span>`,
      `<b>${esc(f.name)}</b>`,
    ],
    `${uncommitted ? '<span class="d-warn">· changes not committed</span>' : ''}<span class="d-mono dim">· ${
      last ? `last commit to change it ${esc(short(last))}, ${esc(ago(last.date))}` : 'never committed'
    }</span>`
  )}
  <div class="d-page">
    <div>
      <div class="d-h1 small">${esc(f.name)}</div>
      <div class="d-lead">${esc(f.goal)}</div>
    </div>
    <div class="d-factgrid">
      <div class="d-fact"><div class="d-lab">${term('actor', 'Actor')}</div><div><b>${esc(actorName)}</b></div><div class="d-sub">${esc(a?.is ?? '')}</div></div>
      <div class="d-fact"><div class="d-lab">${term('trigger', 'Trigger')}</div><div>${esc(f.trigger)}</div></div>
      <div class="d-fact"><div class="d-lab">Before it starts</div><ul>${(f.preconditions ?? []).map(precondition).join('')}</ul></div>
    </div>

    <div class="d-paths">${P.map(
      (x) => `<button class="d-path ${x.id === p.id ? 'on' : ''}" ${set({ path: x.id === 'main' ? null : x.id, step: null, part: null, dp: null })}>${x.id === 'main' ? term('mainpath', esc(x.name), true) : esc(x.name)}${qaChip(fid, [x])}</button>`
    ).join('')}</div>
    <div class="d-banner">${
      p.id === 'main'
        ? `<span class="d-lab">Outcome</span><span>${esc(p.outcome)}</span>`
        : `<span class="d-lab blue">${term('variant', 'Variant')}</span><span>${esc(p.when)}</span><span class="d-lab">Outcome</span><span>${esc(p.outcome)}</span>
           <span class="d-bannerr">${
             p.divergesAt == null
               ? '<span class="d-warn">Diverges at a Step the main path does not have</span>'
               : `Leaves the main path at step ${p.divergesAt + 1}`
           }</span>`
    }</div>

    <div class="d-strip">${strip}</div>

    <div class="d-cols" data-focus="${FOCUS ?? ''}">
      <div class="d-col d-colL">
        <div class="d-pane d-left" data-pane="left" data-key="${esc(`${fid}|${p.id}|${cur}`)}">
          <div class="d-qah" data-sec="step">
            <span class="d-lab">Step ${cur + 1} of ${p.steps.length}${s.shared ? ' · same as the main path' : ''}</span>
            <span class="d-nav">
              ${cur > 0 ? `<button class="d-btn2" ${set({ step: cur - 1, part: null, dp: null })}>← Step ${cur}</button>` : ''}
              ${cur < p.steps.length - 1 ? `<button class="d-btn2" ${set({ step: cur + 1, part: null, dp: null })}>Step ${cur + 2} →</button>` : ''}
            </span>
          </div>
          <div class="d-sides">
            <div class="d-box"><div class="d-lab">${esc(actorName)}</div>${sides(s)}</div>
            <div class="d-box"><div class="d-lab">${term('system', 'System')}</div><div class="d-sys ${s.system ? '' : 'd-none'}">${esc(s.system ?? 'Nothing.')}</div></div>
          </div>
          <div class="d-parts">
            <div class="d-lab">${term('part', plural(parts.length, 'Part'))} in this step</div>
            ${parts.map((id) => partRow(id, p, cur, open)).join('')}
          </div>
        </div>
        ${toc('right', `Manual QA Check · ${p.name}`, [
          ...(since ? [{ sec: 'since', html: '<span class="d-toct d-warn">Changed since the last check</span>' }] : []),
          { sec: 'prepare', html: '<span class="d-toct">Prepare</span>' },
          ...p.qa.steps.map((qs, i) => {
            const st = result(fid, p, qs).state;
            return { sec: `qa:${i}`, html: `<span class="d-num">${i + 1}</span><span class="d-toct">${esc(qs.do)}</span>${st === 'not-checked' ? '' : `<span class="d-st s-${st}">${STATE_LINE[st][0]}</span>`}` };
          }),
        ])}
      </div>

      <div class="d-col d-colR">
        <div class="d-pane d-right" data-pane="right" data-key="${esc(`${fid}|${p.id}`)}">
          <div class="d-qah"><span class="d-lab">${term('qa', 'Manual QA Check')} · ${esc(p.name)}</span>${t['not-checked'] < t.all ? `<button class="d-link" data-reset="${esc(JSON.stringify({ flow: fid, path: p.id }))}">Reset results</button>` : ''}</div>
          <div class="d-tally">${tallyLine}</div>
          ${REFUSED ? `<div class="d-rec d-warn">Not recorded: ${esc(REFUSED)}</div>` : ''}
          ${since ? sinceBanner(since) : ''}
          <div class="d-card" data-sec="prepare"><div class="d-lab">${term('prepare', 'Prepare')}</div><ol class="d-setup">${p.qa.setup.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
          ${p.qa.steps.map((qs, i) => qaStep(fid, p, qs, i)).join('')}
          <div class="d-rec">${
            DATA.resultsFile
              ? `Your results are yours alone and stay on this machine, outside the repo: <span class="d-file">${esc(DATA.resultsFile)}</span>`
              : 'Results cannot be recorded yet: they need a git repo with at least one commit.'
          }</div>
        </div>
        ${toc('left', `Step ${cur + 1}`, [
          { sec: 'step', html: `<span class="d-toct">${esc(actorName)} and System</span>` },
          ...parts.map((id) => ({
            sec: `part:${id}`,
            set: id === open ? null : { part: id, dp: null },
            html: `<span class="d-toct">${esc(DATA.parts[id]?.name ?? id)}</span>${id === open ? '<span class="d-mono dim">open</span>' : ''}`,
          })),
        ])}
      </div>
    </div>
  </div>`;
}

// ---------- the two panes of the flow page ----------

let FOCUS = null; // the pane being scrolled, "left" or "right": the other one is blurred and carries its table of contents
let focusTimer;
let quiet = false; // true while the page itself moves a pane, so that is not taken for the Builder scrolling
const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
function hush() {
  quiet = true;
  requestAnimationFrame(() => requestAnimationFrame(() => (quiet = false)));
}

// The blur lasts while the pane is being scrolled, a little longer, and for as long as the pointer is on the table of contents.
function setFocus(name) {
  FOCUS = name;
  const cols = document.querySelector('.d-cols');
  if (cols) cols.dataset.focus = name ?? '';
  clearTimeout(focusTimer);
  if (name)
    focusTimer = setTimeout(function idle() {
      if (document.querySelector('.d-toc:hover')) focusTimer = setTimeout(idle, 500);
      else setFocus(null);
    }, 2200);
}

// Mark, in a pane's table of contents, the section the pane is on: the last one to have started in its upper part.
function spy(name) {
  const el = pane(name);
  const entries = document.querySelectorAll(`[data-toc="${name}"] [data-goto]`);
  if (!el || !entries.length) return;
  const secs = [...el.querySelectorAll('[data-sec]')];
  const top = el.getBoundingClientRect().top;
  let cur = secs.findLast((x) => x.getBoundingClientRect().top - top <= el.clientHeight * 0.4) ?? secs[0];
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2 && el.scrollTop > 0) cur = secs.at(-1);
  for (const b of entries) b.classList.toggle('cur', b.dataset.goto === cur?.dataset.sec);
}

function goTo(name, sec, smooth) {
  const el = pane(name);
  const target = el?.querySelector(`[data-sec="${sec}"]`);
  if (!target) return;
  const top = target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 2;
  if (smooth) return el.scrollTo({ top, behavior: 'smooth' });
  // A Part opened by a click is only brought back into view if opening it pushed it out of the pane.
  if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - 120) {
    hush();
    el.scrollTop = top;
  }
}

// ---------- wiring ----------

function render() {
  const app = document.getElementById('app');
  if (DATA.error) {
    app.innerHTML = `<div class="d-error"><div class="d-lab d-warn">The knowledge base could not be read</div><pre>${esc(DATA.error)}</pre></div>`;
    return;
  }
  // Redrawing replaces the panes, so each keeps its scroll position as long as it still shows the same thing.
  const kept = Object.fromEntries([...document.querySelectorAll('[data-pane]')].map((el) => [el.dataset.pane, { key: el.dataset.key, top: el.scrollTop }]));
  const fid = q('flow');
  document.title = `Fledgy · ${DATA.repo.name}`;
  hideTip();
  app.innerHTML = DATA.flows[fid] ? flowPage(fid) : home();
  hush();
  for (const el of document.querySelectorAll('[data-pane]')) if (kept[el.dataset.pane]?.key === el.dataset.key) el.scrollTop = kept[el.dataset.pane].top;
  // A Flow to write reached from a Flow's precondition may sit below the fold of its list.
  for (const el of document.querySelectorAll('.d-bl.on, .d-bl.on + .d-blopen')) el.scrollIntoView({ block: 'nearest' });
  if (FOCUS && !pane(FOCUS)) setFocus(null);
  if (FOCUS) spy(FOCUS);
}

document.addEventListener('click', async (e) => {
  // A click on the blurred side, anywhere but its table of contents, brings it back.
  if (FOCUS && e.target.matches('.d-col')) return setFocus(null);
  const t = e.target.closest('[data-goto],[data-set],[data-result],[data-reset]');
  if (!t) return;
  if (t.dataset.set) setQ(JSON.parse(t.dataset.set));
  if (t.dataset.goto) goTo(t.dataset.in, t.dataset.goto, !!t.closest('.d-toc'));
  if (t.dataset.reset) await post('/api/result-reset', JSON.parse(t.dataset.reset));
  else if (t.dataset.result) {
    // Read the note from the page: a click on a state can land before the note's own change is saved.
    const note = t.closest('.d-check').querySelector('textarea')?.value ?? '';
    await post('/api/result', { ...JSON.parse(t.dataset.result), state: t.dataset.state, note });
  } else return;
  render();
});
// Saving a note redraws nothing, so a click that follows it straight away still lands on its button.
document.addEventListener('change', (e) => {
  if (e.target.matches('textarea[data-note]')) post('/api/note', { ...JSON.parse(e.target.dataset.note), note: e.target.value });
});

// Scroll events do not bubble, hence the capture.
document.addEventListener(
  'scroll',
  (e) => {
    const name = e.target.dataset?.pane;
    if ((name !== 'left' && name !== 'right') || quiet) return;
    setFocus(name);
    spy(name);
  },
  true
);
// Scrolling over the blurred side hands it the wheel back.
document.addEventListener('wheel', (e) => FOCUS && e.target.matches?.('.d-col') && setFocus(null), { passive: true });
document.addEventListener('keydown', (e) => e.key === 'Escape' && (setFocus(null), hideTip()));

// Read again on load and whenever the window comes back to the front, so an edit, a stage or a commit made elsewhere shows.
// A note being typed is left alone: redrawing would throw away what is not saved yet.
async function refresh() {
  if (document.activeElement?.matches('textarea[data-note]')) return;
  DATA = await fetch('/api/data').then((r) => r.json());
  render();
}
window.addEventListener('focus', refresh);
refresh();
