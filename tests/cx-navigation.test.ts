import assert from 'node:assert/strict';
import { shouldAutoSelectUnfinishedChapter } from '../packages/scripts/src/projects/cx-navigation';

const cases = [
	{ mode: 'manually', enabled: true, expected: false },
	{ mode: 'manually', enabled: false, expected: false },
	{ mode: 'job', enabled: true, expected: true },
	{ mode: 'job', enabled: false, expected: false },
	{ mode: 'next', enabled: true, expected: true },
	{ mode: 'next', enabled: false, expected: false }
] as const;

for (const { mode, enabled, expected } of cases) {
	assert.equal(shouldAutoSelectUnfinishedChapter(mode, enabled), expected, `${mode} / autoJump=${enabled}`);
}

console.log(`Chaoxing navigation mode tests: PASS (${cases.length} cases)`);
