import assert from 'node:assert/strict';
import { getSearchConcurrency } from '../packages/core/src/core/worker/search-concurrency';

for (const [requested, questions, expected] of [
	[1, 100, 1],
	[3, 100, 3],
	[10, 100, 10],
	[100, 100, 100],
	[1000, 12, 12],
	['20', 30, 20],
	[3.9, 10, 3],
	[0, 10, 1],
	[-5, 10, 1],
	[Infinity, 10, 1],
	[NaN, 10, 1],
	[undefined, 10, 1],
	[20, 0, 0]
] as const) {
	assert.equal(getSearchConcurrency(requested, questions), expected);
}
console.log('Search concurrency tests: PASS (13 cases)');
