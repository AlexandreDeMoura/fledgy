# Fledgy

Fledgy keeps a plain-words map of an app (its Flows, Areas and Parts) true to the code, for a Builder who rarely reads that code.

- **Words**: `GLOSSARY.md` defines every term. Use them exactly as defined, in code, skills and docs. If a change needs a new term or changes what one means, say so instead of inventing one.
- **Where things are**: `src/` is the CLI (`init`, `check`, `view`, `uninstall`, the Stop hook), with its tests beside each file. `skills/` holds the Claude Code skills that write and maintain the map. `view/` is the web view, served as it is, with no build step. `.claude-plugin/` is the plugin manifest.
- **Tests**: run `npm test`. It builds first, then runs vitest. Write the test before the change.
- **Releases**: before preparing a release or changing a version, read and follow `docs/releasing.md`. Keep the Claude Code plugin version in `.claude-plugin/plugin.json` equal to the npm package version in `package.json` and `package-lock.json`.
- **Dogfooding**: `.fledgy/`, `.claude/skills/` and `knowledge-base/` may be a private install of released Fledgy on this repo (see `docs/dogfooding.md`). Change skills in `skills/`, never in `.claude/skills/`.
- **UI**: leave UI verification to the Builder for manual QA.
- **Packages**: give the Builder the install command; do not install packages yourself.
- **Commits**: give the Builder a suggested commit message; leave staging and committing to the Builder.
