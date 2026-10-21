# Handoff: rework the Overview and Changes pages of the web view

This brief is for the session that builds the last two pages of the web view rework. The sidebar, the Flow page ("Read the Flow") and the "Check by hand" tab are done. The Overview and the Changes pages still show the former home page, inside the new layout. This brief says what to build, what was decided, and how to check it.

Read `CLAUDE.md` and `GLOSSARY.md` first. Every term on screen and in code is used exactly as `GLOSSARY.md` defines it. Text the Builder reads follows `docs/words.md`, the plain-words guide that the underlined terms link to.

## Rules for this work

- **No commit and no push** unless the user asks. When the work is done, give a commit message and let them commit.
- **Tests.** `npm test` builds, then runs vitest. Write the test before the change wherever there is a test seam. The web view (`view/`) has no test setup. If these pages need nothing new from the server, there is no test to write, so check them by hand as described in "How to check it".
- **No build step for `view/`.** It is plain `view.js` and `view.css`, served as they are. A change shows on the next reload.
- **Words.** If a page seems to need a new term, or a term with a new meaning, say so to the user rather than inventing one.

## What is already there

All of it is in `view/view.js` and `view/view.css`:

- **Frame:** `render()` draws `<div class="d-shell">` with `sidebar(fid)` on the left and `<main class="d-main">` on the right, then the Flow to write popover (`twPopover()`). The main area shows `flowPage(fid)` when `?flow=` names a written Flow, and `home()` otherwise.
- **The former home page:** `home()`, with `FILTERS`, `matching()` and the `pv` preview, plus the `.d-home`, `.d-list`, `.d-row`, `.d-preview`, `.d-table` and similar styles. It is shown for both the Overview (`/`) and the Changes (`/?show=10`). **Replace it with the two new pages, then delete it and its styles.**
- **The sidebar's Changes link:**
  - `href="/?show=10"` near view.js:317.
  - The `page` detection near view.js:265: `q('show') ? 'changes' : 'overview'`.
  - Give the Changes page its own address, for example `/?page=changes`, and update both places.
- **Conventions:**
  - State lives in the URL. `setQ(obj)` replaces the address and redraws; `go(href)` adds a history entry. Links whose `href` starts with `/` are intercepted and go through `go()`.
  - Buttons carry `data-set='{…}'`, which the shared click handler passes to `setQ`.
  - `term(key, html, inControl)` underlines a term and gives it the tooltip from `WORDS`. Every term the Builder meets should go through it.
  - Panes with `data-pane` and `data-key` keep their scroll position across redraws.
  - `data-tw="<id>"` on any button opens that Flow to write's popover.
- **Helpers to reuse:**
  - `areaList()`, `flowOrder()`, `toWrite()` (each entry has `waited`, the written Flows whose preconditions wait for it).
  - `areaName()`, `actorName()`, `changes(fid)`, `flowHref(fid, extra)`, `result()`, `tally()`, `moved(r)`, `ago()`, `plural()`, `short()`, `esc()`.
- **Colours** (the comment at the top of `view.css`): blue marks what is selected, green what passed, red what failed, and amber what could not be performed, what changed and what is wrong. Use the CSS variables on `.D`.

## The data, from `GET /api/data`

```
repo:     { name, root }
actors:   { [id]: { name, is } }
areas:    { [id]: { name, is, flows_to_write?: { [id]: { name, is } } } }
flows:    { [id]: { name, area, actor, goal, trigger, preconditions, paths: [main, ...variants] } }
parts:    { [id]: { name, is, entity?, relations?, anchors } }
changes:
  flows:       { [flowId]: { uncommitted: boolean, last?: Commit } }   // last searches the whole history
  recent:      Commit[]   // the last 30 first-parent commits, newest first, even those that changed no Flow
  uncommitted: { flows: [flowId], near: [flowId], files: [...] }
results:  { [flow]: { [path]: { [qaStep]: { state, note, commit, date, uncommitted,
            since: { commits: Commit[], nearCommits, uncommitted: boolean, nearUncommitted, byDate } } } } }
resultsFile: string | null
```

- A `Commit` in `recent` is `{ sha, date, subject, body, flows: [flowId], near: [flowId], files, anchorsFrom }`.
- `recent[0]` is HEAD.
- `near` means the commit changed a file a Flow points into, but not the code its Anchors point to. The mockups do not show it, and these pages should not show it either.
- These pages need nothing more from the server. If one seems to, stop and tell the user before changing `src/`.

## Decisions already made with the user

- **What counts as a change.** A Flow changed when the code one of its Parts' Anchors points to changed. An edit to a `.yaml` file of the knowledge base never counts, in either install, and never shows on the Changes page. `docs/words.md` already says so.
- **Footnote of the Changes page.** The mockup's footnote was wrong. Use this wording: "**What counts as a change.** A Flow changed when the code its Parts point to changed. Rewording the Flow doesn't count: nothing changed in the app. More in the guide ↗". Link to the "Not committed" entry of the guide (`GUIDE + '#not-committed'`).
- **No "Look back" menu.** The Changes page shows `changes.recent`, the last 30 commits, with no control to change that.
- **No commit id in the sidebar footer.** It stays "Live from knowledge-base/" and "read N s ago".
- **No undo.**

## The two pages, as the user's mockups show them

The mockups are images that are not in the repo. If the user can attach them again, ask for them; otherwise this section is the spec. Both pages sit in the main area, beside the sidebar. Their sample data is auxilia's.

### Overview (`/`)

A single centred column, about 680px wide, with generous space above it.

1. **An eyebrow**, small mono capitals: "AUXILIA · KNOWLEDGE BASE", using the repo name.
2. **A headline of three lines**, large and semibold, with the numbers in white and the rest in grey:
   - "**2** **Flows** are written." ("Flows" is the `flow` term.)
   - "**12 more** are waiting to be written." (the Flows to write)
   - "**1** changed on your computer since the last commit." (the number is amber; the count is `changes.uncommitted.flows`)

   Drop or reword a line whose count is 0. For example, leave out the third line when nothing is uncommitted.
3. **"● Not committed yet"**, with an amber dot and the `uncommitted` term. Under it, one card per Flow not committed, with an amber border: the Flow's name on the left and "Open →" on the right.
4. **"● In the last commit `b0e069c` “flows” · 2 days ago"**, with a blue dot, the short sha in mono, the subject in quotes and the time. This is `recent[0]`. Under it, cards for the Flows it changed, two per row, each with its name and "Open →". When the last commit changed no Flow, say so in one line instead, still naming the commit.
5. **"◌ Still to write"**, with a dashed circle. Under it:
   - "11 in Agents, 1 in Sign-in." (the count per Area)
   - "Start with **Sign in** and **Share an agent**: written Flows already depend on them." These are the Flows to write whose `waited` is not empty. Each name is underlined and opens its popover with `data-tw`.
   - A smaller line: "To write them, type `/map-the-app` in Claude Code."
6. **A divider, then the words.** "Not sure what a word means? The guide explains each one in more depth." Then pill chips that each link to a guide heading: The knowledge base (`#knowledge-base`), Flow (`#flow`), Main path and Variants (`#main-path`), Part (`#part`), Manual QA Check (`#manual-qa-check`). End with a "Whole guide ↗" link. The links open in a new tab.

Empty states: keep the wording of the former home page.

- With no Area at all: "In Claude Code, type `/map-the-app`. Fledgy reads your code, proposes the Areas it sees for you to correct, then writes their Flows with you, one Area at a time. This page fills in as it goes."
- With Areas but no Flow written yet: "The Areas and the Flows to write are listed on the left. In Claude Code, type `/map-the-app` to carry on…"

### Changes (the sidebar's "Changes")

A column about 820px wide.

1. **The title.** "Changes", with the sub-line "Which **Flows** changed, newest first." There is no Look back menu (see above).
2. **A vertical timeline down the left**, one dot per group, joined by a thin line, newest first:
   - **Amber filled dot: "Not committed"** (the `uncommitted` term), then "on your computer, now · 1 Flow". It is shown only when `changes.uncommitted.flows` is not empty. Under it, an amber-bordered card with one row per Flow:
     - On the left, the name and a second line "Agents · done by a Member": the Area's name, then the Actor's name with "a" or "an".
     - On the right, "Open →".
     - When some of that Flow's QA Results were recorded before this change (`results[f][path][step].since.uncommitted`), an amber strip inside the card says "↻ 2 **QA results** on its Main path were recorded before this change." (the `qachip` term, or another fitting one from `WORDS`). On its right is "Check again →", which opens `flowHref(f, { path, tab: 'check' })` on the path concerned.
   - **Blue dot: one group per commit that changed a Flow.** The short sha in mono, the subject in bold, then "2 days ago · 2 Flows". On the first group only, when it is `recent[0]`, a dim "last commit" sits on the right. Under it, a card with one row per Flow the commit changed (`commit.flows`), laid out like the rows above.
   - **Hollow dot: commits in a row that changed no Flow, folded into one group.** "8 commits changed no Flow", their date range ("Oct 12 – Oct 16") and a "Show ▾" toggle. Under it, one dim line of their subjects joined with " · ", ending "and 5 more". "Show" unfolds the full list, one commit per line. Keep the unfolded state in the URL or in memory, your choice.
3. **A divider, then the footnote** in the wording given above.

When `recent` is empty (no commit yet) or nothing changed a Flow, say so plainly. The former home page has the sentences for these cases.

## How to check it

- **`npm run demo`** creates a made-up app, Pantry, in a temp folder and serves the view at http://localhost:4174 (`-- --port N` for another port). Its knowledge base passes the check. It has:
  - two Areas with Flows, an Area with only a Flow to write, and Flows to write waited for by written Flows;
  - "Create a recipe", whose QA Results were recorded before a later commit that changed its code;
  - "Find a recipe", with code that is not committed and results recorded before that change;
  - 40 commits that changed no Flow, then 2 that did.

  So both pages have every state to show. Each run starts afresh. The source is `scripts/demo.mjs`. Check that it is committed: at the time of writing it was not, though `package.json` already has the `demo` script.
- **Screenshots:** `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=4000 --screenshot=<file>.png '<url>'`. Read the PNG to look at it.
- **Clicks and keys:** `puppeteer-core` is in the npx cache. Find it with `ls -d ~/.npm/_npx/*/node_modules/puppeteer-core`, `require()` it from a script in your scratchpad, and launch it with `executablePath` set to the Chrome path above. Collect `pageerror` events and report any.
- Run `npm test` once at the end, even if `src/` did not change.

## When it is done

- `home()`, `FILTERS`, `matching()`, the `pv` preview and their styles are gone. So is any `show` parameter the new pages do not use.
- The comment at the top of `view.js` describes the Overview and the Changes, not the former home page.
- `docs/words.md` no longer speaks of "change filters" in the "Flow to write" entry, since the filters are gone.
- The user gets a short summary, anything that differs from this brief and why, and a commit message.
- This file can then be deleted.
