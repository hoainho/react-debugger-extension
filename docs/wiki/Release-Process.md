# Release Process

Maintainer-only checklist for cutting a release. This is for the *extension* version (e.g., 2.0.3 → 2.1.0). The CLI version (`@nhonh/react-debugger`) bumps independently.

## Versioning policy

We follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **PATCH** (2.0.3 → 2.0.4) — bugfixes, performance improvements, no new features, no breaking changes
- **MINOR** (2.0.3 → 2.1.0) — new features, no breaking changes
- **MAJOR** (2.0.3 → 3.0.0) — breaking changes to user-visible behavior (UI restructuring, tab removal, API contract changes)

**Pre-1.0 we treated minors as breaking. Since 2.0.0 we honor semver strictly.**

## Pre-release checklist

Before tagging the release:

- [ ] All planned PRs merged to `main`
- [ ] CHANGELOG.md updated with the new version section
  - Sections: `Added`, `Changed`, `Fixed`, `Security`, `Removed`, `Deprecated`
  - Reference PR numbers and contributor handles
- [ ] `public/manifest.json` `version` bumped
- [ ] `package.json` `version` bumped (matches manifest)
- [ ] `cli/package.json` `version` bumped if CLI changed
- [ ] `cli/bin/cli.js` `VERSION` constant matches `cli/package.json`
- [ ] README.md "Extension version" line updated
- [ ] `npm run test:run` passes (or expected pre-existing failures noted)
- [ ] `npm run build` succeeds clean
- [ ] Manual smoke test on at least one real React app:
  - All 8 tabs render
  - AI Analysis tab calls succeed (use a real subscription key from your dev env)
  - No new console errors on the inspected page
  - No new console errors in the DevTools panel
- [ ] If a security-sensitive change shipped: update SECURITY.md "Supported Versions" table

## Cutting the release

```bash
# 1. Verify clean main with all commits in
git checkout main
git pull
git status  # should be clean except local DS_Store noise

# 2. Bump versions (manually edit the files above), commit
git add public/manifest.json package.json cli/package.json cli/bin/cli.js README.md CHANGELOG.md
git commit -m "release: v2.X.Y — <theme>"
git push

# 3. Tag the release (this triggers the .github/workflows/release.yml job)
git tag v2.X.Y
git push origin v2.X.Y

# 4. The release.yml workflow will:
#    - Run tests
#    - Build the extension
#    - Create react-debugger.zip from dist/
#    - Create a GitHub Release with auto-generated notes
#    - Attach the zip to the release
```

## Post-release

- [ ] Verify the GitHub Release page shows up at https://github.com/hoainho/react-debugger-extension/releases/tag/v2.X.Y
- [ ] Verify `react-debugger.zip` is attached
- [ ] Verify CHANGELOG section is reflected in the release notes
- [ ] If the CLI bumped, publish the CLI separately:
  ```bash
  cd cli
  npm publish --access public
  ```
  Verify with `npm view @nhonh/react-debugger version`.
- [ ] Post a release announcement in [Discussions / Announcements](https://github.com/hoainho/react-debugger-extension/discussions/categories/announcements) using the announcement template
- [ ] Update the [Roadmap discussion](https://github.com/hoainho/react-debugger-extension/discussions/categories/announcements) to mark this milestone done
- [ ] If the release closes a milestone, close the GitHub milestone

## Hotfix process

For urgent fixes (security, critical regression):

1. Branch from the release tag, not `main`:
   ```bash
   git checkout -b hotfix/v2.X.Z v2.X.Y
   ```
2. Make the minimal fix
3. Bump patch version
4. Cherry-pick the fix to `main` if it didn't originate there
5. Tag and release as normal

Hotfixes still go through CI; the only short-circuit is skipping the planning/spec phase.

## Rollback

If a release breaks something critical:

1. Don't unpublish the npm package or delete the GitHub Release (audit trail).
2. Cut a new patch release (`v2.X.Y+1`) that reverts the breaking commits.
3. Update the README's install command to pin a known-good version temporarily if needed:
   ```
   npx @nhonh/react-debugger@2.X.Y-1
   ```
4. Open a post-mortem discussion in Announcements explaining what broke and what the fix was.

## Release cadence

We don't have a fixed cadence. Targets:
- **Patch releases**: as needed, no schedule
- **Minor releases**: roughly every 4–8 weeks
- **Major releases**: roughly annually, tied to React major versions

## Why this is a wiki page and not a script

The release process is intentionally manual. A solo-maintainer project benefits more from "the maintainer has a clear checklist they actually read" than from "a script that automates things but obscures what's happening." If this project ever has 2+ maintainers, automate this with a release-please bot or similar.
