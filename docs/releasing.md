# Releasing

A release is a version tag pushed to GitHub. The `Release` workflow (`.github/workflows/release.yml`) then publishes the package to npm through trusted publishing: no token, and provenance is added on its own.

The Claude Code plugin and the npm package always use the same version. Keep `version` in `.claude-plugin/plugin.json` and `package.json` in sync with the top-level and root package versions in `package-lock.json`. Include all three files in the release commit before creating the tag.

## Steps

1. **Start from a clean, up-to-date `main`**, and run `npm test`.
2. **Choose the version.** Fledgy stays on `0.x`: a patch (`0.1.1`) for fixes and small changes, a minor (`0.2.0`) for new features or anything that breaks how it is used.
3. **Bump it:**
   ```sh
   npm version patch --no-git-tag-version   # or: npm version minor --no-git-tag-version
   ```
   This sets the version in `package.json` and `package-lock.json` without committing or tagging. Then set `version` in `.claude-plugin/plugin.json` to that same version; `npm version` does not update this file.
4. **Review and commit the three version files, then create the tag**, replacing `X.Y.Z` with the chosen version:
   ```sh
   git diff -- package.json package-lock.json .claude-plugin/plugin.json
   git add package.json package-lock.json .claude-plugin/plugin.json
   git commit -m "chore: release X.Y.Z"
   git tag -a vX.Y.Z -m "X.Y.Z"
   ```
   Confirm that all three files use the same release version before committing. The Builder runs the commit and tag commands.
5. **Push the commit and the tag:**
   ```sh
   git push --follow-tags
   gh run watch
   ```
   The workflow installs, checks that the tag matches `package.json`, runs `npm test`, then runs `npm publish`.
6. **Check npm:** `npm view fledgy --prefer-online dist-tags` shows the new version as `latest`. Without `--prefer-online`, npm may answer from its cache.
7. **Write the changelog** in GitHub Releases, by hand:
   ```sh
   gh release create vX.Y.Z --title "X.Y.Z" --notes "<what changed, for a Builder>"
   ```

Builders get the new version with `npx fledgy@latest init`.

## If something goes wrong

- **The workflow fails before `npm publish`** (tag mismatch, failing test): nothing was published. Delete the tag (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), fix on `main`, then tag again.
- **The workflow fails at `npm publish`**: check on npm whether the version went out. npm never accepts the same version twice, so if it did, release the fix as the next version.
- **CI can't publish at all**: `npm publish` by hand, logged in and with your 2FA code. That version has no provenance.

## npm settings that must stay as they are

On npmjs.com, in the package's Settings:

- **Trusted Publisher**: GitHub Actions, owner `AlexandreDeMoura`, repository `fledgy`, workflow `release.yml`, no environment. Renaming the workflow file breaks publishing until this is updated.
- **Publishing access**: "Require two-factor authentication and disallow tokens".
- **Staged versions**: `0.0.1-bootstrap` sits in staging from the first release. Never approve it, which would publish it, and never reject it.
