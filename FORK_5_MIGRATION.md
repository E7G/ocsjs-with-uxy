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
