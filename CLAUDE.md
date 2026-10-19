# Fledgy

Fledgy keeps a plain-words map of an app (its Flows, Areas and Parts) true to the code, for a Builder who rarely reads that code.

- **Words**: `GLOSSARY.md` defines every term. Use them exactly as defined, in code, skills and docs. If a change needs a new term or changes what one means, say so instead of inventing one.
- **Where things are**: `src/` is the CLI (`init`, `check`, `view`, `uninstall`, the Stop hook), with its tests beside each file. `skills/` holds the Claude Code skills that write and maintain the map. `view/` is the web view, served as it is, with no build step. `.claude-plugin/` is the plugin manifest.
- **Tests**: run `npm test`. It builds first, then runs vitest. Write the test before the change.
