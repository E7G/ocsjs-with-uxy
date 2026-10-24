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

## Userscript distribution and updates

The standard and all-domain scripts are published as **tracked files under `5.0/dist/`** so userscript managers can download them from stable raw GitHub links. This is separate from the old GitHub Releases artifacts and does not overwrite historical releases.

- Standard install: https://raw.githubusercontent.com/E7G/ocsjs-with-uxy/5.0/dist/ocs.user.js
- Standard update metadata: https://raw.githubusercontent.com/E7G/ocsjs-with-uxy/5.0/dist/ocs.meta.js
- All-domain install: https://raw.githubusercontent.com/E7G/ocsjs-with-uxy/5.0/dist/ocs.common.user.js
- All-domain update metadata: https://raw.githubusercontent.com/E7G/ocsjs-with-uxy/5.0/dist/ocs.common.meta.js

Metadata credits E7G for this fork and enncy / OCS contributors for the original, points the homepage/source/support to this fork, and uses a distinct userscript version suffix (`5.2.3.1` initially). Whenever publishing new fork changes without changing the upstream version, increase the suffix in `scripts/build-core.js` before rebuilding, and commit the four generated files above via `git add -f dist/ocs.user.js dist/ocs.meta.js dist/ocs.common.user.js dist/ocs.common.meta.js`. The development userscript contains local file paths and is deliberately not published or assigned public auto-update URLs.

The build automatically verifies metadata across standard, all-domain, and development variants.
