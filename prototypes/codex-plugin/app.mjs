import { areas, flows, parts, searchKnowledgeBase, recordQAResult } from './model.mjs';

// Three overview arrangements inside one Codex desktop shell: ?variant=atlas|outline|focus.
// All content and actions are fictional. State is intentionally reset on reload.
const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  exitFullscreen: '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l-4 3"/>',
  library: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="m16 5 4-1 3 15-4 1z"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 14h7v7h-7z"/>',
  fledgy: '<path d="M7 20V5h12M7 12h9"/><path d="m13 17 3 3 5-6"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 7v10m12-9v2c0 4-12 2-12 7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zm0 2h18"/>',
  workspace: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 10v10"/>',
  people: '<path d="M3 21v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3m3-7a4 4 0 0 1 3 4v3"/><circle cx="9" cy="6" r="4"/><path d="M17 2a4 4 0 0 1 0 8"/>',
  key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-5-5 3-3m-1 5 3-3"/>',
  overview: '<rect x="3" y="3" width="7" height="8" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="3" y="15" width="7" height="6" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/>',
  flow: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 7v5a3 3 0 0 0 3 3h8a3 3 0 0 1 3 2M12 3h7v7m0-7-7 7"/>',
  part: '<path d="m12 3 9 5v9l-9 5-9-5V8zm-9 5 9 5 9-5m-9 5v9M7 5l10 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  circleCheck: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  qa: '<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m8 13 3 3 5-6"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
  external: '<path d="M14 3h7v7m0-7L10 14m0-11H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  backend: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6h.01M7 17h.01"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5m0 3v.1"/>',
  pencil: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z"/>',
  leaf: '<path d="M5 19C0 5 13 2 21 3c0 12-5 18-13 15M3 21 15 9"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.part}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const btn = (label, action, cls = '', glyph = '', extra = '') => `<button class="${cls}" data-action="${action}" ${extra}>${glyph ? icon(glyph) : ''}${label}</button>`;
const ibtn = (label, action, glyph, cls = '', extra = '') => btn('', action, `icon-button ${cls}`, glyph, `aria-label="${label}" title="${label}" ${extra}`);
const areaFor = flow => areas.find(area => area.id === flow.area);
const flowFor = id => flows.find(flow => flow.id === id);
const variants = ['atlas', 'outline', 'focus'];
let variant = new URLSearchParams(location.search).get('variant') || 'atlas';
if (!variants.includes(variant)) variant = 'atlas';
let page = location.hash.slice(1) || 'overview';
let filter = 'all';
let areaFilter = '';
let flowTab = 'steps';
let pathIndex = -1;
let shell = 'fledgy';
let collapsed = false;
let checking = false;
let refreshed = false;
let dialog = null;
let previousFocus = null;
let results = recordQAResult({}, 'invite', 0, 'passed');
results = recordQAResult(results, 'invite', 1, 'passed');
results = recordQAResult(results, 'mention', 0, 'failed', 'The mentioned teammate did not receive a notification.');
const notes = {};
const chats = [];
let toastTimer;

function go(next) {
  shell = 'fledgy';
  flowTab = 'steps'; pathIndex = -1;
  if (page === next) render();
  else location.hash = next;
}
window.addEventListener('hashchange', () => { page = location.hash.slice(1) || 'overview'; flowTab = 'steps'; pathIndex = -1; render(); });

function rail() {
  return `<nav class="app-rail" aria-label="Codex applications">
    ${ibtn('Codex home', 'shell:home', 'home', shell === 'home' ? 'selected' : '')}
    ${ibtn('Library · outside this prototype', 'unavailable', 'library')}
    ${ibtn('Recent chats · outside this prototype', 'unavailable', 'clock')}
    ${ibtn('Collections · outside this prototype', 'unavailable', 'folder')}
    ${ibtn('Connected apps · outside this prototype', 'unavailable', 'globe')}
    ${ibtn('More · prototype information', 'about', 'more')}
    <span class="rail-rule"></span>
    ${ibtn('Code · outside this prototype', 'unavailable', 'branch')}
    ${ibtn('Sites', 'shell:sites', 'apps', shell === 'sites' ? 'selected' : '')}
    ${ibtn('Fledgy', 'shell:fledgy', 'fledgy', shell === 'fledgy' ? 'selected fledgy-selected' : '')}
    <div class="rail-bottom">${ibtn('About this prototype', 'about', 'circleCheck')}<button class="avatar" data-action="about" aria-label="Alex · prototype information">A</button></div>
  </nav>`;
}

function sidebar() {
  const active = page.split(':')[0];
  const nav = [['overview', 'Overview', 'overview', ''], ['flows', 'Flows', 'flow', flows.length], ['parts', 'Parts', 'part', parts.length], ['qa', 'QA Results', 'qa', ''], ['history', 'History', 'clock', '']];
  return `<aside class="sidebar">
    <div class="brand"><span class="brand-symbol">${icon('fledgy')}</span><span>Fledgy</span><span class="plugin-label">PLUGIN</span></div>
    <button class="project-switch" data-action="project"><span class="project-logo">n<span>·</span></span><span><strong>nuée</strong><small>Team workspace app</small></span>${icon('down')}</button>
    <button class="sidebar-search" data-action="search">${icon('search')}<span>Search knowledge base</span><kbd>⌘ K</kbd></button>
    <div class="nav-label">KNOWLEDGE BASE</div>
    <nav class="primary-nav" aria-label="Fledgy">${nav.map(([id, label, glyph, count]) => `<button data-action="nav:${id}" class="${active === id || (active === 'flow' && id === 'flows') || (active === 'part' && id === 'parts') ? 'active' : ''}">${icon(glyph)}<span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ''}${id === 'qa' && Object.values(results).some(r => r.outcome === 'failed') ? '<span class="unread-dot"></span>' : ''}</button>`).join('')}</nav>
    <div class="nav-label area-label">AREAS <span>${areas.length}</span></div>
    <nav class="area-nav" aria-label="Areas">${areas.map(area => `<button data-action="area:${area.id}" class="${areaFilter === area.id && active === 'flows' ? 'active' : ''}"><span class="area-dot ${area.color}"></span><span>${area.name}</span><span class="nav-count">${flows.filter(f => f.area === area.id).length}</span></button>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="local-status"><span class="status-dot"></span>Connected to this computer</div><div class="repo">${icon('branch')}<span>main</span><code>a81f2c9</code></div><button class="sidebar-help" data-action="about">${icon('leaf')}<span>A little clarity goes a long way.</span></button></div>
  </aside>`;
}

function header() {
  let title = ({ overview: 'Overview', flows: 'Flows', parts: 'Parts', qa: 'QA Results', history: 'History' })[page] || (page.startsWith('flow:') ? 'Flows' : 'Parts');
  return `<header class="content-header"><div class="breadcrumb">${ibtn('Toggle sidebar', 'sidebar', 'panel')}<span>nuée</span>${icon('chevron')}<strong>${title}</strong></div><div class="header-actions"><span class="demo-label"><span></span>Prototype · fake data</span>${ibtn('Search knowledge base', 'search', 'search')}${btn('Ask Codex', 'chat', 'button subtle', 'spark')}</div></header>`;
}

function flowRow(flow, compact = false) {
  return `<button class="flow-row ${compact ? 'compact' : ''}" data-action="flow:${flow.id}"><span class="flow-row-icon ${flow.toWrite ? 'unwritten' : ''}">${icon(flow.toWrite ? 'pencil' : 'flow')}</span><span class="flow-row-name">${flow.name}${!compact ? `<small>${flow.description}</small>` : ''}</span>${flow.toWrite ? '<span class="tag amber">To write</span>' : compact ? '' : `<span class="row-meta">${flow.steps.length} Steps</span>`}${icon('chevron', 'row-chevron')}</button>`;
}

function areaCard(area) {
  const list = flows.filter(flow => flow.area === area.id);
  return `<article class="area-card"><button class="area-card-heading" data-action="area:${area.id}"><span class="area-icon ${area.color}">${icon(area.icon)}</span><span><h3>${area.name}</h3><p>${area.description}</p></span>${icon('arrow')}</button><div class="area-flows">${list.map(f => flowRow(f, true)).join('')}</div><footer><span>${list.filter(f => !f.toWrite).length} written${list.some(f => f.toWrite) ? ` <span class="middle-dot">·</span> ${list.filter(f => f.toWrite).length} to write` : ''}</span><span class="mini-progress">${list.map(f => `<i class="${f.toWrite ? 'empty' : ''}"></i>`).join('')}</span></footer></article>`;
}

function attention() {
  const failed = Object.values(results).filter(r => r.outcome === 'failed').length;
  return `<div class="attention"><div class="section-heading"><h2>A little attention</h2><span class="count-pill">${failed ? 2 : 1}</span></div>
    <button class="attention-item" data-action="to-write"><span class="attention-icon amber">${icon('pencil')}</span><span><strong>3 Flows to write</strong><p>The app can do more than the<br class="wide-only"> Knowledge base describes.</p><em>See Flows to write ${icon('arrow')}</em></span></button>
    ${failed ? `<button class="attention-item" data-action="failed-qa"><span class="attention-icon coral">${icon('alert')}</span><span><strong>${failed} QA ${failed === 1 ? 'Step needs' : 'Steps need'} another look</strong><p>A recorded result didn’t match<br class="wide-only"> what you expected.</p><em>Review QA Results ${icon('arrow')}</em></span></button>` : '<div class="all-good">'+icon('circleCheck')+' No failed QA Results</div>'}
  </div><div class="activity"><div class="section-heading"><h2>Recently in your app</h2>${btn('View all', 'nav:history', 'text-button')}</div><div class="timeline"><div><i class="timeline-dot success"></i><small>12 minutes ago</small><button data-action="flow:invite">Invite a teammate</button><p>Steps updated after an invitation change.</p><span class="activity-agent">${icon('spark')} Codex <span>·</span> a81f2c9</span></div><div><i class="timeline-dot"></i><small>48 minutes ago</small><button data-action="flow:archive-project">Archive a project</button><p>Flow added to Projects.</p><span class="activity-agent">${icon('spark')} Codex <span>·</span> 6e24b10</span></div><div><i class="timeline-dot"></i><small>Today, 10:32</small><button data-action="nav:qa">Manual QA, made by you</button><p>Invitation form and sending passed.</p><span class="activity-agent"><span class="tiny-avatar">A</span> Alex</span></div></div></div><div class="quiet-note">${icon('leaf')}<p>Your app, in plain words.<br><span>Kept alongside the code.</span></p></div>`;
}

function overview() {
  const written = flows.filter(f => !f.toWrite).length;
  const metrics = `<div class="metrics">${[[areas.length, 'Areas', 'The big picture', 'overview'], [flows.length, 'Flows', `${written} written · 3 to write`, 'flows'], [parts.length, 'Parts', 'Connected to the code', 'parts'], [Object.values(results).filter(r => r.outcome === 'passed').length, 'QA Steps passed', `${Object.keys(results).length} tried by you`, 'qa']].map(([count, name, desc, target]) => `<button data-action="nav:${target}"><span class="metric-value">${count}<span>${name}</span></span><small>${desc}</small>${icon('arrow')}</button>`).join('')}</div>`;
  const mapHeading = `<div class="section-heading map-heading"><div><h2>Explore your app</h2><p>Start with an Area. Follow a Flow. See how it works.</p></div><span class="quiet-label">${areas.length} Areas</span></div>`;
  const atlas = `${mapHeading}<div class="area-grid">${areas.map(areaCard).join('')}</div>`;
  const outline = `${mapHeading}<div class="outline">${areas.map(area => `<section><button class="outline-title" data-action="area:${area.id}"><span class="area-dot ${area.color}"></span>${area.name}<span>3 Flows</span></button>${flows.filter(f => f.area === area.id).map(f => flowRow(f, true)).join('')}</section>`).join('')}</div>`;
  const focus = `<div class="focus-feature"><div class="eyebrow">PICK UP WHERE YOU LEFT OFF</div><span class="area-icon violet">${icon('people')}</span><h2>Invite a teammate</h2><p>From an email address to a new teammate.<br>See what happens at every Step.</p><div class="focus-steps">${['Open form', 'Choose teammate', 'Send invitation', 'See pending'].map((s,i)=>`<span><i>${i+1}</i>${s}</span>`).join('')}</div>${btn('Explore this Flow', 'flow:invite', 'button primary', 'arrow')}</div><div class="section-heading"><h2>Find your way around</h2></div><div class="focus-areas">${areas.map(a => `<button data-action="area:${a.id}"><span class="area-icon ${a.color}">${icon(a.icon)}</span><strong>${a.name}</strong><span>3 Flows</span>${icon('arrow')}</button>`).join('')}</div>`;
  return `<div class="page overview-page"><div class="page-intro"><div><div class="eyebrow">YOUR APP, UNDERSTOOD</div><h1>A clear picture of nuée<span class="accent-text">.</span></h1><p>What it does. How it works. All in plain words.</p></div><span class="hero-mark">${icon('leaf')}</span></div>
    <div class="health-bar"><span class="health-symbol">${icon('circleCheck')}</span><div><strong>${checking ? 'Running the demo Deterministic Check…' : 'Your Knowledge base is connected'}</strong><span>${refreshed ? 'Deterministic Check passed just now' : 'Deterministic Check passed 12 minutes ago'} <i>·</i> <code>main</code> <i>·</i> <code>a81f2c9</code></span></div>${btn(checking ? 'Checking…' : 'Run again', 'refresh', 'button quiet', 'refresh', checking ? 'disabled' : '')}</div>
    ${metrics}<div class="overview-columns"><section class="map-column">${variant === 'atlas' ? atlas : variant === 'outline' ? outline : focus}</section><aside class="insights">${attention()}</aside></div><div class="overview-footnote">${icon('code')} Fictional app. Real possibilities. Explore freely — everything here is a demo.</div>
    <div class="prototype-switcher" aria-label="Overview layout variations"><span>OVERVIEW EXPLORATIONS</span>${ibtn('Previous overview layout', 'variant:previous', 'back')}<strong>${{ atlas: '01 · Areas', outline: '02 · Outline', focus: '03 · Flow first' }[variant]}</strong>${ibtn('Next overview layout', 'variant:next', 'arrow')}</div></div>`;
}

function flowList() {
  const list = flows.filter(f => (!areaFilter || f.area === areaFilter) && (filter === 'all' || (filter === 'to-write' ? f.toWrite : !f.toWrite)));
  return `<div class="page"><div class="page-title"><div><div class="eyebrow">KNOWLEDGE BASE</div><h1>${areaFilter ? areas.find(a => a.id === areaFilter).name : 'Every goal, a Flow.'}</h1><p>From the moment something starts to an outcome you can see.</p></div>${btn('Write a Flow', 'write-flow', 'button primary', 'plus')}</div><div class="list-toolbar"><div class="segmented">${[['all', 'All Flows'], ['written', 'Written'], ['to-write', 'To write']].map(([id,label]) => btn(label, `filter:${id}`, filter === id ? 'active' : '')).join('')}</div><label class="select-label">Area <select id="area-filter"><option value="">All Areas</option>${areas.map(a => `<option value="${a.id}" ${a.id === areaFilter ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label></div><div class="flow-list">${areas.filter(a => !areaFilter || areaFilter === a.id).map(a => { const group = list.filter(f => f.area === a.id); return group.length ? `<section><div class="list-group-title"><span class="area-dot ${a.color}"></span><h2>${a.name}</h2><span>${group.length}</span></div>${group.map(f => flowRow(f)).join('')}</section>` : ''; }).join('') || '<div class="empty-state">No Flows match these filters.</div>'}</div></div>`;
}

function flowDetail(flow) {
  if (!flow) return notFound();
  const area = areaFor(flow);
  if (flow.toWrite) return `<div class="page detail-page">${btn('Back to Flows', 'nav:flows', 'text-button back-link', 'back')}<div class="eyebrow">${area.name} <span>/</span> FLOW TO WRITE</div><h1>${flow.name}</h1><p class="lead">${flow.description}</p><div class="to-write-state"><span class="area-icon amber">${icon('pencil')}</span><h2>A goal we know about.<br>A story still to write.</h2><p>This Flow is named in the Knowledge base. Codex can follow the code to describe its Steps, Parts, and Manual QA Check.</p>${btn('Write this Flow with Codex', 'write-flow', 'button primary', 'spark')}<small>Prototype: opens a simulated conversation.</small></div></div>`;
  const selectedPath = pathIndex < 0 ? flow : flow.variants?.[pathIndex] || flow;
  const namedParts = [...new Set(selectedPath.steps.flatMap(s => s.parts))].map(id => parts.find(p => p.id === id));
  return `<div class="page detail-page">${btn('All Flows', 'nav:flows', 'text-button back-link', 'back')}<div class="eyebrow"><span class="area-dot ${area.color}"></span>${area.name} <span>/</span> FLOW</div><div class="page-title"><div><h1>${flow.name}</h1><p>${flow.description}</p></div>${btn('Discuss this Flow', 'chat', 'button subtle', 'spark')}</div><div class="flow-metadata"><span>${icon('people')}${flow.actor}</span><span>${icon('flow')}${flow.steps.length} Steps</span><span>${icon('branch')}${flow.variants?.length || 0} Variants</span><span class="muted">Updated ${flow.updated || 'today'}</span></div>
    <div class="detail-tabs" role="tablist">${btn('Steps', 'tab:steps', flowTab === 'steps' ? 'active' : '', 'flow', `role="tab" aria-selected="${flowTab === 'steps'}"`)}${btn('Manual QA Check', 'tab:qa', flowTab === 'qa' ? 'active' : '', 'qa', `role="tab" aria-selected="${flowTab === 'qa'}"`)}</div>
    ${flow.variants?.length ? `<div class="path-picker"><span>Path</span>${btn('Main path', 'path:-1', pathIndex < 0 ? 'active' : '')}${flow.variants.map((v,i) => btn(v.name, `path:${i}`, pathIndex === i ? 'active' : '', 'branch')).join('')}</div>` : ''}
    <div class="detail-columns"><div>${flowTab === 'steps' ? `<div class="trigger-block"><span>${icon(pathIndex < 0 ? 'flow' : 'branch')}${pathIndex < 0 ? 'THE TRIGGER' : `VARIANT · DIVERGES AT STEP ${selectedPath.at}`}</span><p>${pathIndex < 0 ? flow.trigger : selectedPath.condition}</p></div><div class="steps">${selectedPath.steps.map((s,i) => `<article class="step"><span class="step-number">${i+1}</span><div class="step-content"><h2>${s.title}</h2>${s.actor ? `<div class="step-line"><span>Does</span><p>${s.actor}</p></div>` : ''}${s.sees ? `<div class="step-line"><span>Sees</span><p>${s.sees}</p></div>` : ''}<div class="step-line system-line"><span>System</span><p>${s.system}</p></div><div class="step-parts">${s.parts.map(id => btn(parts.find(p => p.id === id).name, `part:${id}`, 'part-chip', 'part')).join('')}</div></div></article>`).join('')}</div><div class="outcome-block">${icon('circleCheck')}<div><span>THE OUTCOME</span><p>${selectedPath.outcome}</p></div></div>` : qaCheck(flow, selectedPath)}
    </div><aside class="detail-aside"><div class="side-section"><div class="section-heading"><h2>Before this starts</h2>${icon('key')}</div><p>${flow.preconditions}</p></div><div class="side-section"><div class="section-heading"><h2>Parts in this path</h2><span class="count-pill">${namedParts.length}</span></div><p class="aside-caption">The pieces that make it happen.</p>${namedParts.map(p => `<button class="aside-part" data-action="part:${p.id}">${icon('part')}<span>${p.name}<small>${p.anchors.length} Anchor${p.entity ? ' · Entity' : ''}</small></span>${icon('chevron')}</button>`).join('')}</div><div class="context-card">${icon('spark')}<h3>Stay curious.</h3><p>Ask what would change if an invitation expired, or why a Part is involved.</p>${btn('Ask Codex about this', 'chat', 'text-button', 'arrow')}</div></aside></div></div>`;
}

function qaKey(flow) { return pathIndex < 0 ? flow.id : `${flow.id}-variant-${pathIndex}`; }
function qaCheck(flow, selectedPath) {
  const key = qaKey(flow);
  const passed = selectedPath.qa.filter((_, i) => results[`${key}:${i}`]?.outcome === 'passed').length;
  return `<div class="qa-intro"><div><h2>Try it for yourself.</h2><p>Follow each QA Step and record what you observe.</p></div><span class="tag success">${passed} / ${selectedPath.qa.length} passed</span></div><div class="qa-setup"><strong>Setup</strong><p>${flow.preconditions}${pathIndex >= 0 ? ` ${selectedPath.condition}` : ''}</p></div><div class="qa-steps">${selectedPath.qa.map((q,i) => { const r = results[`${key}:${i}`]; return `<article class="qa-step"><span class="step-number ${r?.outcome === 'passed' ? 'done' : ''}">${r?.outcome === 'passed' ? icon('check') : i+1}</span><div><h3>${q.action}</h3><p><span>Expect</span>${q.expected}</p><div class="qa-buttons">${[['passed', 'Passed', 'check'], ['failed', 'Failed', 'close'], ['could not perform', 'Could not perform', 'more']].map(([outcome,label,glyph]) => btn(label, `result:${key}:${i}:${outcome}`, `${r?.outcome === outcome ? `chosen ${outcome === 'passed' ? 'success' : outcome === 'failed' ? 'coral' : 'amber'}` : ''}`, glyph)).join('')}${r ? btn('Reset', `reset:${key}:${i}`, 'reset-result') : ''}</div><input class="qa-note" data-note="${key}:${i}" aria-label="Optional note for QA Step ${i+1}" placeholder="Add a note about what you observed…" value="${esc(notes[`${key}:${i}`] ?? r?.note ?? '')}">${r ? `<small class="qa-recorded">Recorded by you · a81f2c9 · no uncommitted changes</small>` : ''}</div></article>`; }).join('')}</div><div class="privacy-note">${icon('key')}QA Results belong to you. Demo results reset when you reload.</div>`;
}

function partsList() {
  return `<div class="page"><div class="eyebrow">KNOWLEDGE BASE</div><h1>The pieces behind the picture.</h1><p class="lead">Every Part has a job. Every Anchor takes you to the code.</p><div class="parts-grid">${parts.map(p => `<button class="part-card" data-action="part:${p.id}"><div>${icon('part')}<span class="tag">${p.entity ? 'Entity' : 'Part'}</span></div><h2>${p.name}</h2><p>${p.description}</p><footer><span>${icon(p.anchors[0].side)}${p.anchors[0].side}</span><span>${flows.filter(f => f.steps?.some(s => s.parts.includes(p.id))).length} Flows ${icon('arrow')}</span></footer></button>`).join('')}</div></div>`;
}

function partDetail(part) {
  if (!part) return notFound();
  const related = flows.filter(f => f.steps?.some(s => s.parts.includes(part.id)));
  return `<div class="page narrow-page">${btn('All Parts', 'nav:parts', 'text-button back-link', 'back')}<div class="eyebrow">${part.entity ? 'ENTITY · A PART THE APP STORES' : 'PART'}</div><h1>${part.name}</h1><p class="lead">${part.description}</p><div class="part-explainer">${icon('part')}<p>A Part connects the plain-words Knowledge base to the code through its Anchors.</p></div><div class="section-heading"><h2>Anchors</h2><span class="tag">Fictional code</span></div>${part.anchors.map(a => `<button class="anchor-card" data-action="anchor:${part.id}">${icon(a.side)}<span><strong>${a.label}</strong><code>${a.path}</code></span><span class="tag">${a.side}</span>${icon('external')}</button>`).join('')}<div class="section-heading related-heading"><h2>Where this Part appears</h2><span>${related.length} Flows</span></div>${related.map(f => flowRow(f)).join('')}<div class="context-card horizontal">${icon('spark')}<div><h3>What would happen if this changed?</h3><p>Explore the Flows that rely on this Part.</p></div>${btn('Ask Codex', 'chat', 'button subtle')}</div></div>`;
}

function resultsPage() {
  const entries = Object.entries(results);
  return `<div class="page"><div class="eyebrow">YOUR PERSONAL RECORD</div><h1>Confidence, one Step at a time.</h1><p class="lead">What you observed when you tried your app. Kept just for you.</p><div class="qa-summary">${[['passed', 'Passed', 'success'], ['failed', 'Failed', 'coral'], ['could not perform', 'Could not perform', 'amber']].map(([outcome,label,color]) => `<div><span class="${color}">${entries.filter(([,r]) => r.outcome === outcome).length}</span><strong>${label}</strong></div>`).join('')}</div><div class="section-heading"><h2>Recorded QA Results</h2><span class="quiet-label">On app commit <code>a81f2c9</code></span></div><div class="results-list">${entries.map(([key,r]) => { const split = key.lastIndexOf(':'); const flowId = key.slice(0,split); const i = Number(key.slice(split+1)); const [id,v] = flowId.split('-variant-'); const flow = flowFor(id); const selectedPath = v === undefined ? flow : flow.variants[Number(v)]; return `<button class="result-row" data-action="open-qa:${id}:${v ?? '-1'}"><span class="result-icon ${r.outcome === 'passed' ? 'success' : r.outcome === 'failed' ? 'coral' : 'amber'}">${icon(r.outcome === 'passed' ? 'check' : r.outcome === 'failed' ? 'close' : 'more')}</span><span><strong>${flow.name}${v === undefined ? '' : ` · ${selectedPath.name}`}</strong><p>QA Step ${i+1} · ${selectedPath.qa[i].action}</p>${r.note ? `<small class="result-note">“${esc(r.note)}”</small>` : ''}</span><span class="result-outcome">${r.outcome}</span>${icon('chevron')}</button>`; }).join('') || '<div class="empty-state"><h2>A fresh start.</h2><p>Open a Flow’s Manual QA Check to record your first QA Result.</p></div>'}</div><div class="privacy-note">${icon('key')}These demo results stay in this tab and reset on reload.</div></div>`;
}

const versions = [
  ['a81f2c9', '12 minutes ago', 'Invitation behavior clarified', 'The invitation now expires in 7 days. Steps and the Manual QA Check were updated to describe this.', 'Invite a teammate', 'invite'],
  ['6e24b10', '48 minutes ago', 'Project archiving mapped', 'Archive a project was written, including the Project archive Part and its backend Anchor.', 'Archive a project', 'archive-project'],
  ['50c8d31', 'Yesterday, 16:42', 'Mentions connected to notifications', 'Mention a teammate now describes notification delivery after a Comment is published.', 'Mention a teammate', 'mention'],
  ['2d97a64', 'Yesterday, 11:08', 'The first picture of nuée', 'Four Areas and twelve Flows were identified. Three Flows remain to write.', 'Create a workspace', 'create-workspace'],
];
function historyPage() {
  return `<div class="page narrow-page"><div class="eyebrow">KNOWLEDGE BASE VERSIONS</div><h1>Your app has a story.</h1><p class="lead">Saved copies of the Knowledge base, alongside the app commits they describe.</p><div class="history-list">${versions.map((v,i) => `<article><span class="history-dot">${icon(i === 0 ? 'circleCheck' : 'clock')}</span><div><div class="history-meta"><span>${v[1]}</span><code>${v[0]}</code>${i === 0 ? '<span class="tag success">Latest</span>' : ''}</div><h2>${v[2]}</h2><p>${v[3]}</p>${btn(v[4], `flow:${v[5]}`, 'part-chip', 'flow')}${btn('View saved version', `version:${i}`, 'text-button', 'arrow')}</div></article>`).join('')}</div><div class="privacy-note">${icon('key')}Knowledge base versions live in your History store. This timeline is fictional.</div></div>`;
}

function notFound() { return `<div class="page empty-state"><h1>Nothing here yet.</h1>${btn('Back to Overview', 'nav:overview', 'button primary')}</div>`; }
function content() {
  if (page.startsWith('flow:')) return flowDetail(flowFor(page.slice(5)));
  if (page.startsWith('part:')) return partDetail(parts.find(p => p.id === page.slice(5)));
  return ({ overview, flows: flowList, parts: partsList, qa: resultsPage, history: historyPage })[page]?.() || notFound();
}

function shellPlaceholder() {
  return `<aside class="sidebar codex-sidebar"><div class="brand">Codex ${icon('down')}</div>${btn('New chat', 'shell:home', 'new-chat', 'pencil')}<div class="nav-label">Projects</div><div class="shell-project">${icon('folder')}fledgy</div><div class="shell-project">${icon('folder')}nuée</div><div class="nav-label">Recents</div><p>Explore Fledgy in Codex Desktop</p><p>Map the invitation Flows</p><p>Build a calmer workspace</p></aside><main class="main placeholder-main"><div class="demo-label">Prototype · fake data</div><div class="shell-welcome"><span class="welcome-icon">${icon(shell === 'sites' ? 'apps' : 'spark')}</span><h1>${shell === 'sites' ? 'Your ideas, on the web.' : 'What should we build in nuée?'}</h1><p>${shell === 'sites' ? 'Sites sits right above Fledgy in your app rail.' : 'Understand what you build, right where you build it.'}</p>${btn('Open Fledgy', 'shell:fledgy', 'button primary', 'fledgy')}<small>This screen is part of the prototype, too.</small></div></main>`;
}

function render() {
  document.getElementById('app').innerHTML = `<div class="desktop-toolbar">${ibtn('Go back', 'back', 'back')}${ibtn('Go forward', 'forward', 'arrow')}${ibtn('Toggle sidebar', 'sidebar', 'panel')}<span class="window-title">${shell === 'fledgy' ? 'Fledgy' : 'Codex'}<span> / </span>nuée</span>${ibtn(document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen', 'fullscreen', document.fullscreenElement ? 'exitFullscreen' : 'fullscreen', 'fullscreen-button', `aria-pressed="${Boolean(document.fullscreenElement)}"`)}${ibtn('About this prototype', 'about', 'plus')}</div><div class="desktop-body ${collapsed ? 'sidebar-collapsed' : ''}">${rail()}<div class="window">${shell === 'fledgy' ? `${sidebar()}<main class="main">${header()}<div class="scroll-content" id="main-scroll">${content()}</div></main>` : shellPlaceholder()}</div></div>`;
  document.title = `${page.startsWith('flow:') ? flowFor(page.slice(5))?.name || 'Fledgy' : 'Fledgy'} — Codex prototype`;
}

function toast(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3600); }
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
    else toast('Fullscreen is unavailable here. Open the prototype with the desktop launcher.');
  } catch {
    toast('The browser could not enter fullscreen. Try the desktop launcher instead.');
  }
}
document.addEventListener('fullscreenchange', () => {
  const button = document.querySelector('[data-action="fullscreen"]');
  if (!button) return;
  const active = Boolean(document.fullscreenElement);
  const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(active));
  button.title = label;
  button.innerHTML = icon(active ? 'exitFullscreen' : 'fullscreen');
});
function closeDialog() { dialog = null; document.getElementById('overlay').innerHTML = ''; previousFocus?.focus(); }
function openDialog(kind, detail) {
  if (!dialog) previousFocus = document.activeElement;
  dialog = kind;
  const overlay = document.getElementById('overlay');
  let markup = '';
  if (kind === 'search') markup = `<div class="search-dialog" role="dialog" aria-modal="true" aria-label="Search knowledge base"><div class="search-input-wrap">${icon('search')}<input id="global-search" placeholder="Find a Flow or Part…" aria-label="Search Flows and Parts" autocomplete="off">${ibtn('Close search', 'close', 'close')}</div><div id="search-results"><div class="search-hint">A little direction goes a long way.</div><div class="search-group-label">TRY A FLOW</div>${flows.slice(0,2).map(f => `<button class="search-result" data-action="search-flow:${f.id}">${icon('flow')}<span>${f.name}<small>Flow · ${areaFor(f).name}</small></span>${icon('arrow')}</button>`).join('')}</div><footer><span>Search the fictional nuée Knowledge base</span><kbd>esc</kbd> to close</footer></div>`;
  if (kind === 'chat') markup = chatMarkup();
  if (kind === 'about') markup = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${ibtn('Close', 'close', 'close', 'modal-close')}<span class="big-brand">${icon('fledgy')}</span><div class="eyebrow">A POSSIBLE FUTURE</div><h2 id="dialog-title">Fledgy, at home in Codex.</h2><p>An interactive design prototype of a Fledgy plugin in the Codex desktop app. Nuée, its code, and its Knowledge base are fictional.</p><p>Explore Flows and Parts, record demo QA Results, and try a simulated conversation. All changes reset on reload. No repository, account, or agent is connected.</p><div class="modal-tip">Switch between three Overview arrangements with the control at the bottom of the Overview.</div>${btn('Let’s explore', 'close', 'button primary')}</div>`;
  if (kind === 'project') markup = `<div class="modal small-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${ibtn('Close', 'close', 'close', 'modal-close')}<h2 id="dialog-title">Your app</h2><button class="project-option" data-action="close"><span class="project-logo">n·</span><span><strong>nuée</strong><small>Fictional team workspace app</small></span>${icon('check')}</button><p>This prototype explores one app’s Knowledge base. Connecting another repository would happen here.</p></div>`;
  if (kind === 'anchor') { const p = parts.find(p => p.id === detail); markup = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${ibtn('Close', 'close', 'close', 'modal-close')}<div class="eyebrow">ANCHOR PREVIEW · FICTIONAL CODE</div><h2 id="dialog-title">${p.name}</h2><p>${p.description}</p><div class="code-preview"><div>${icon(p.anchors[0].side)}${p.anchors[0].path}</div><pre><span>01</span> // ${p.name}
<span>02</span> // ${p.anchors[0].side === 'screen' ? 'Screen' : 'Backend'} Anchor for this Part.
<span>03</span> // In a connected plugin, this would
<span>04</span> // open the corresponding source code.</pre></div><p class="muted">Only Parts point to code. Flows describe what happens in plain words.</p>${btn('Back to the Part', 'close', 'button subtle')}</div>`; }
  if (kind === 'version') { const v = versions[detail]; markup = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${ibtn('Close', 'close', 'close', 'modal-close')}<div class="eyebrow">SAVED KNOWLEDGE BASE VERSION</div><h2 id="dialog-title">${v[2]}</h2><div class="history-meta"><span>${v[1]}</span><code>${v[0]}</code></div><p>${v[3]}</p><div class="version-change"><span>What changed</span><strong>${v[4]}</strong><p>${detail === 0 ? 'The invitation lifetime changed from 3 days to 7 days. The sending Step, outcome, and expected email text now describe the new lifetime.' : 'The saved Knowledge base describes the behavior at this app commit.'}</p></div><p class="muted">This is a fictional saved-version preview.</p>${btn('Open the current Flow', `search-flow:${v[5]}`, 'button primary', 'arrow')}</div>`; }
  overlay.innerHTML = `<div class="overlay-backdrop ${kind === 'chat' ? 'drawer-backdrop' : ''}" data-backdrop>${markup}</div>`;
  requestAnimationFrame(() => overlay.querySelector('input, textarea, button')?.focus());
}

function chatMarkup() {
  const context = page.startsWith('flow:') ? flowFor(page.slice(5))?.name : page.startsWith('part:') ? parts.find(p => p.id === page.slice(5))?.name : 'nuée’s Knowledge base';
  return `<aside class="chat-drawer" role="dialog" aria-modal="true" aria-labelledby="chat-title"><header><span class="chat-brand">${icon('spark')}<strong id="chat-title">Ask Codex</strong></span>${ibtn('Close conversation', 'close', 'close')}</header><div class="chat-context">${icon('fledgy')}Fledgy <span>/</span> ${context}</div><div class="chat-transcript" id="chat-transcript"><div class="chat-greeting"><span class="chat-spark">${icon('spark')}</span><h2>Let’s make it clear.</h2><p>Explore how your app works, with the Knowledge base as context.</p><span class="tag amber">Simulated conversation</span></div>${chats.map(m => `<div class="chat-message ${m.role}">${m.role === 'assistant' ? `<span class="message-label">${icon('spark')}Codex · demo response</span>` : ''}<p>${esc(m.text).replace(/\n/g, '<br>')}</p></div>`).join('')}${!chats.length ? `<div class="chat-suggestions">${['How does inviting a teammate work?', 'Which Flows still need to be written?', 'What should I try in Manual QA?'].map(q => btn(q, `question:${q}`, 'suggestion', 'arrow')).join('')}</div>` : ''}</div><form id="chat-form"><label for="chat-input" class="sr-only">Ask about your app</label><textarea id="chat-input" placeholder="Ask about your app…" rows="3" required></textarea><div><span>${icon('part')}Knowledge base attached</span><button class="send-button" aria-label="Send demo message">${icon('arrow')}</button></div></form><footer>Fake responses · no messages sent to Codex</footer></aside>`;
}

function answer(question) {
  const q = question.toLowerCase();
  let response;
  if (/write|written|missing/.test(q)) response = 'Three Flows are named but still need to be written:\n\n• Change a member’s role — Workspace\n• Manage notifications — Collaboration\n• Delete your account — Account & access\n\nThey have a name and description, but no Steps, Parts, or Manual QA Check yet. In a connected plugin, I would read the code to write them. This prototype leaves the fictional Knowledge base unchanged.';
  else if (/qa|try|test/.test(q)) response = 'Start with “Invite a teammate”. Open its Manual QA Check, follow the four QA Steps, and record what you observe.\n\nThere are also two Variants to try: an existing member, and an email delivery failure. Each has its own Manual QA Check.\n\nYour QA Results belong to you. The failed result for “Mention a teammate” is a useful next place to investigate.';
  else if (/chang|impact|part/.test(q)) response = 'In this sample, Invitation delivery sends the email used by “Invite a teammate”. A change to delivery behavior could affect the sending Step and the “Email delivery fails” Variant.\n\nThe Part’s backend Anchor is src/invitations/send.ts. The next step would be to inspect that code, update the Flow if its behavior changed, and try its Manual QA Check.\n\nThis is an illustrative response; no code has been inspected.';
  else response = 'In the fictional nuée app, a Workspace owner opens the Invitation form, enters an email address, chooses a role, and sends the invitation.\n\nThe system creates an Invitation and uses Invitation delivery to send an email. It expires in 7 days. The teammate then appears as Invited in the members list.\n\nIf the person is already a member, no invitation is created. If delivery fails, the owner can retry. Both are described as Variants of the same Flow.';
  chats.push({ role: 'person', text: question }, { role: 'assistant', text: response });
  openDialog('chat');
  const transcript = document.getElementById('chat-transcript'); transcript.scrollTop = transcript.scrollHeight;
}

document.addEventListener('click', event => {
  if (event.target.matches('[data-backdrop]')) { closeDialog(); return; }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const [type, value, ...rest] = action.split(':');
  if (type === 'nav') { areaFilter = ''; filter = 'all'; go(value); }
  else if (type === 'flow' || type === 'part') go(action);
  else if (type === 'area') { areaFilter = value; filter = 'all'; go('flows'); }
  else if (type === 'filter') { filter = value; render(); }
  else if (type === 'tab') { flowTab = value; render(); }
  else if (type === 'path') { pathIndex = Number(value); render(); }
  else if (type === 'search-flow' || type === 'search-part') { closeDialog(); go(`${type === 'search-flow' ? 'flow' : 'part'}:${value}`); }
  else if (type === 'shell') { shell = value; render(); }
  else if (type === 'sidebar') { collapsed = !collapsed; render(); }
  else if (type === 'fullscreen') void toggleFullscreen();
  else if (type === 'close') closeDialog();
  else if (['search', 'about', 'project', 'chat'].includes(type)) openDialog(type);
  else if (type === 'anchor' || type === 'version') openDialog(type, type === 'version' ? Number(value) : value);
  else if (type === 'to-write') { filter = 'to-write'; areaFilter = ''; go('flows'); }
  else if (type === 'write-flow') { openDialog('chat'); answer(`Write ${page.startsWith('flow:') ? flowFor(page.slice(5))?.name : 'a Flow that is still to write'}`); }
  else if (type === 'failed-qa') go('qa');
  else if (type === 'open-qa') { shell = 'fledgy'; page = `flow:${value}`; history.pushState(null, '', `#${page}`); flowTab = 'qa'; pathIndex = Number(rest[0]); render(); }
  else if (type === 'result') { const key = `${value}:${rest[0]}`; const scroll = document.getElementById('main-scroll').scrollTop; results = recordQAResult(results, value, Number(rest[0]), rest[1], notes[key] ?? results[key]?.note ?? ''); render(); document.getElementById('main-scroll').scrollTop = scroll; toast(`QA Result recorded: ${rest[1]}. Demo only.`); }
  else if (type === 'reset') { const key = `${value}:${rest[0]}`; const scroll = document.getElementById('main-scroll').scrollTop; delete results[key]; delete notes[key]; render(); document.getElementById('main-scroll').scrollTop = scroll; toast('QA Result reset.'); }
  else if (type === 'question') answer(action.slice(9));
  else if (type === 'refresh' && !checking) { checking = true; render(); setTimeout(() => { checking = false; refreshed = true; render(); toast('Demo Deterministic Check passed. No repository was accessed.'); }, 1200); }
  else if (type === 'variant') { variant = variants[(variants.indexOf(variant) + (value === 'next' ? 1 : 2)) % variants.length]; const url = new URL(location.href); url.searchParams.set('variant', variant); history.replaceState(null, '', url); render(); }
  else if (type === 'back') history.back();
  else if (type === 'forward') history.forward();
  else if (type === 'unavailable') toast('This Codex control is outside the Fledgy prototype.');
});

document.addEventListener('input', event => {
  if (event.target.id === 'global-search') {
    const query = event.target.value;
    const found = searchKnowledgeBase(query);
    document.getElementById('search-results').innerHTML = found.length ? `<div class="search-group-label">${found.length} RESULTS</div>${found.map(item => `<button class="search-result" data-action="search-${item.kind.toLowerCase()}:${item.id}">${icon(item.kind.toLowerCase())}<span>${item.name}<small>${item.kind}${item.toWrite ? ' · To write' : ''}</small></span>${icon('arrow')}</button>`).join('')}` : `<div class="search-hint">${query.trim() ? `No Flows or Parts found for “${esc(query)}”.` : 'Search by a name or something your app does.'}</div>`;
  }
  if (event.target.dataset.note) {
    const key = event.target.dataset.note; notes[key] = event.target.value;
    if (results[key]) results[key] = { ...results[key], note: event.target.value };
  }
});
document.addEventListener('change', event => { if (event.target.id === 'area-filter') { areaFilter = event.target.value; render(); } });
document.addEventListener('submit', event => { if (event.target.id === 'chat-form') { event.preventDefault(); const value = document.getElementById('chat-input').value.trim(); if (value) answer(value); } });
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openDialog('search'); }
  if (event.key === 'Escape' && dialog) closeDialog();
  if (event.target.id === 'chat-input' && event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); const value = event.target.value.trim(); if (value) answer(value); }
  if (!dialog && page === 'overview' && !event.target.matches('input, textarea, select, [contenteditable]') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); document.querySelector(`[data-action="variant:${event.key === 'ArrowRight' ? 'next' : 'previous'}"]`)?.click(); }
  if (event.key === 'Tab' && dialog) {
    const focusable = [...document.getElementById('overlay').querySelectorAll('button, input, textarea, select, [tabindex="0"]')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
render();
