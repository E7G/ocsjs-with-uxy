# OCS-with-uxy: 5.x migration

This fork tracks the upstream `ocsjs/ocsjs` 5.0 branch while preserving selected customizations from E7G's 4.0 branch.

## Preserved features

- ULearning (优学院) project, including course video controls and question worker migrated to 5.x APIs.
- Longjiang YukeTang (长江雨课堂) exam script and position synchronization.
- Chaoxing (学习通) option de-duplication, selected-state handling, and font-text fallback.
- Choice-answer normalization for local answer banks and AI responses.
- Optional local question bank preset at `http://localhost:8060/adapter-service/search?use=local` (requires your own running server).
- Separate `OCS-with-uxy` userscript identity and update link.

## Checks

From the repository root, with Node.js and pnpm available:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec tsc -p packages/utils/tsconfig.json
corepack pnpm exec tsc -p packages/core/tsconfig.json
corepack pnpm exec tsc --noEmit -p packages/scripts/tsconfig.json
corepack pnpm test
corepack pnpm test:fork
corepack pnpm build
```

The original fork's `4.0` branch is retained for rollback. Browser compatibility with each live learning platform still requires manual validation; automated compile and resolver tests do not establish live-site compatibility.

## GitHub Actions build and Release distribution

Generated `dist/` files are ignored and **not tracked in git**. `.github/workflows/build-and-publish.yml` builds and tests every push to `5.0` (with downloadable CI artifacts), and publishes a GitHub Release when a `v5.*` tag is pushed. Manual workflow dispatch compiles only. The old upstream release-please workflows have been removed.

- Standard install: https://github.com/E7G/ocsjs-with-uxy/releases/latest/download/ocs.user.js
- Standard update metadata: https://github.com/E7G/ocsjs-with-uxy/releases/latest/download/ocs.meta.js
- All-domain install: https://github.com/E7G/ocsjs-with-uxy/releases/latest/download/ocs.common.user.js
- All-domain update metadata: https://github.com/E7G/ocsjs-with-uxy/releases/latest/download/ocs.common.meta.js

Build verification checks the standard, all-domain, and developer variants. The developer script contains local file paths and is neither published nor assigned public auto-update URLs. The original OCS author and contributors are credited; MIT license is retained.

### Publish a new version

1. Increment the version suffix in `scripts/fork-version.js` for fork-only changes (e.g. `5.2.3.2` to `5.2.3.3`).
2. Push source changes to `5.0` and confirm GitHub Actions build passed.
3. Tag the intended commit with the userscript `@version` and push the tag, e.g. `git tag v5.2.3.3 && git push origin v5.2.3.3`.
4. GitHub Actions checks the release tag/version, recompiles, publishes the four script and metadata files as Release assets, and marks this release Latest. Never publish the compiled files to the source branch.

Users who installed the previous raw-GitHub `5.0/dist/` build must reinstall once from a Release link to migrate their auto-update URL. New installations update through GitHub Release Latest assets.
