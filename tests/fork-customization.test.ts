import assert from 'node:assert/strict';
import { normalizeChoiceAnswer } from '../packages/core/src/core/worker/utils';
import { resolveSingle } from '../packages/core/src/core/worker/resolvers/single';
import { resolveMultiple } from '../packages/core/src/core/worker/resolvers/multiple';

const normalization = [
	['答案：B. 原码', 'B'],
	['<think>reasoning</think> 答案：C. -101', 'C'],
	['A, C', 'AC'],
	['a # d', 'AD'],
	['选B', 'B'],
	['正确', '正确'],
	['原码', '原码'],
	['A', 'A']
] as const;

for (const [input, expected] of normalization) {
	assert.equal(normalizeChoiceAnswer(input), expected, input);
}
const answers = ['真值', '补码', '原码', '反码'];
assert.equal(resolveSingle(['答案：C. 原码'], answers).option, '原码');
assert.equal(resolveSingle(['b'], answers).option, '补码');
const multiple = resolveMultiple(['答案：A,C'], answers);
assert.equal(multiple.finish, true);
const matched = multiple.options || multiple.plainOptions || [];
assert.deepEqual(matched.sort(), ['真值', '原码'].sort());

console.log('Fork choice normalization tests: PASS (' + normalization.length + ' normalization + 3 resolver assertions)');
