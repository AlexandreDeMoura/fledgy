# Dogfooding

Fledgy can map Fledgy itself: a private install on this repo gives it a **Knowledge base** of its own Flows, Areas and Parts, kept true by the same Stop hook a **Builder** gets.

## Two copies of Fledgy

Keep them apart:

- **The copy you use** is a released version, installed in `.fledgy/`, with its skills copied into `.claude/skills/`. This is what runs when you type `/map-the-app` or when the Stop hook fires.
- **The copy you change** is the source: `src/`, `skills/`, `view/`.

Editing `skills/` changes nothing in how Fledgy behaves on this repo until you install that copy (see below). Never edit `.claude/skills/`: the next install replaces it.

## Install

From the repo root, on a commit whose version is published on npm:

```sh
npm run build
node dist/cli.js init
```

`npx fledgy init` does not work here: inside the `fledgy` package, npx considers the package already installed and finds no `fledgy` command to run.

`init` installs `fledgy@<version in package.json>` from npm into `.fledgy/`, not your working copy. Everything it writes, `knowledge-base/` included, is hidden by the local exclude (`.git/info/exclude`), so `git status` stays clean and nothing reaches a commit.

Then open a new Claude Code session and type `/map-the-app`. Read what it writes with `git fledgy view`.

## Try unreleased skills or code

```sh
npm pack
FLEDGY_PACKAGE=./fledgy-X.Y.Z.tgz node dist/cli.js init
```

Run `node dist/cli.js init` again, without `FLEDGY_PACKAGE`, to go back to the released version.

## Upgrade

After a release, on the release commit: `npm run build && node dist/cli.js init`.

Not between the version bump and the publish: `init` would ask npm for a version that does not exist yet, and stop without writing anything.

## What to expect

- Every coding session on this repo ends with the agent following `maintain-knowledge-base` and running `git fledgy check`. That cost is part of what you are testing.
- Fledgy is a CLI and a set of agent skills, not the web app the glossary has in mind. When a word does not fit (an Anchor's side for terminal output, an agent as **Actor**, a skill as **Entry point**), write it down and raise it as a question about `GLOSSARY.md` instead of bending the word.

## Remove

`git fledgy uninstall` removes the install and keeps `knowledge-base/`.
