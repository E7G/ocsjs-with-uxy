import assert from 'node:assert/strict';
import { applyChoiceSelection } from '../packages/core/src/core/worker/choice-selection';
import {
	planCompoundAnswer,
	replaceSelectAnswer,
	replaceTextAnswer
} from '../packages/core/src/core/worker/answer-state';
import { createDefaultQuestionResolver } from '../packages/core/src/core/worker/question.resolver';

require('browser-env')();

function nativeOptions(type: 'checkbox' | 'radio', selected: number[]) {
	const root = document.createElement('div');
	document.body.appendChild(root);
	const options = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((text, i) => {
		const label = document.createElement('label');
		const input = document.createElement('input');
		input.type = type;
		input.name = 'test';
		label.appendChild(input);
		label.appendChild(document.createTextNode(text));
		root.appendChild(label);
		input.checked = selected.includes(i);
		return label;
	});
	return {
		options,
		read: () => options.flatMap((o, i) => (o.querySelector('input')!.checked ? [i] : [])),
		click: (o: HTMLElement) => o.querySelector('input')!.click(),
		dispose: () => root.remove()
	};
}

async function main() {
	const multi = nativeOptions('checkbox', [0, 1]);
	const clicks: number[] = [];
	multi.options.forEach((o, i) => o.querySelector('input')!.addEventListener('click', () => clicks.push(i)));
	assert.equal(
		await applyChoiceSelection('multiple', multi.options, [multi.options[1], multi.options[3]], multi.click),
		true
	);
	assert.deepEqual(multi.read(), [1, 3]);
	assert.deepEqual(clicks, [0, 1, 1, 3], 'reset old options before applying new answer');
	clicks.length = 0;
	assert.equal(
		await applyChoiceSelection('multiple', multi.options, [multi.options[1], multi.options[3]], multi.click),
		true
	);
	assert.deepEqual(clicks, [], 'repeat run must not toggle correct choices');
	multi.dispose();

	const single = nativeOptions('radio', [0]);
	assert.equal(await applyChoiceSelection('single', single.options, [single.options[2]], single.click), true);
	assert.deepEqual(single.read(), [2]);
	single.dispose();

	const ariaOptions = Array.from({ length: 4 }, (_, i) => {
		const row = document.createElement('li');
		row.setAttribute('aria-checked', String(i < 2));
		const option = document.createElement('span');
		row.appendChild(option);
		option.addEventListener('click', () =>
			row.setAttribute('aria-checked', String(row.getAttribute('aria-checked') !== 'true'))
		);
		return option;
	});
	assert.equal(await applyChoiceSelection('multiple', ariaOptions, [ariaOptions[2]], (o) => o.click()), true);
	assert.deepEqual(
		ariaOptions.map((o) => o.parentElement!.getAttribute('aria-checked')),
		['false', 'false', 'true', 'false']
	);

	const exam = nativeOptions('checkbox', [0, 2]);
	const resolver = createDefaultQuestionResolver({ answerSeparators: ['#'] } as any, (o) => o.textContent || '');
	const infos = (answer: string) => [{ name: 'test', results: [{ question: 'test', answer }] }] as any;
	const handler = (_type: string, _answer: string, option: HTMLElement) => exam.click(option);
	assert.equal((await resolver.multiple(infos(''), exam.options, handler)).finish, false);
	assert.deepEqual(exam.read(), [0, 2], 'unmatched questions retain existing answers');
	assert.equal((await resolver.multiple(infos('Bravo#Delta'), exam.options, handler)).finish, true);
	assert.deepEqual(exam.read(), [1, 3], 'resolver replaces existing selection');
	exam.dispose();

	const locked = nativeOptions('checkbox', [0]);
	locked.options[0].querySelector('input')!.disabled = true;
	assert.equal(await applyChoiceSelection('multiple', locked.options, [locked.options[1]], locked.click), false);
	assert.deepEqual(locked.read(), [0], 'failed reset does not select a new answer');
	locked.dispose();
	// 判断题：已选错误答案时应切换，重复运行时不取消正确答案。
	const judgement = nativeOptions('radio', [1]);
	judgement.options[0].lastChild!.textContent = '正确';
	judgement.options[1].lastChild!.textContent = '错误';
	let judgementClicks = 0;
	const judgmentHandler = (_type: string, _answer: string, option: HTMLElement) => {
		judgementClicks++;
		judgement.click(option);
	};
	assert.equal((await resolver.judgement(infos('正确'), judgement.options.slice(0, 2), judgmentHandler)).finish, true);
	assert.deepEqual(judgement.read(), [0]);
	assert.equal((await resolver.judgement(infos('正确'), judgement.options.slice(0, 2), judgmentHandler)).finish, true);
	assert.equal(judgementClicks, 1);
	judgement.dispose();

	// 表单输入、填空题及简答题：新内容覆盖旧内容，事件同步到页面。
	const blanks = [document.createElement('input'), document.createElement('textarea')];
	blanks[0].value = 'old one';
	blanks[1].value = 'old two';
	let inputs = 0;
	blanks.forEach((blank) => blank.addEventListener('input', () => inputs++));
	const fillHandler = (_type: string, answer: string, option: HTMLElement) => {
		assert.equal(replaceTextAnswer(option as HTMLInputElement | HTMLTextAreaElement, answer), true);
	};
	assert.equal((await resolver.completion(infos('new one#new two'), blanks, fillHandler)).finish, true);
	assert.deepEqual(
		blanks.map((blank) => blank.value),
		['new one', 'new two']
	);
	assert.equal(inputs, 2);
	assert.equal((await resolver.completion(infos('new one#new two'), blanks, fillHandler)).finish, true);
	assert.equal(inputs, 2);
	assert.equal((await resolver.completion(infos(''), blanks, fillHandler)).finish, false);
	assert.deepEqual(
		blanks.map((blank) => blank.value),
		['new one', 'new two']
	);
	blanks[1].readOnly = true;
	assert.equal((await resolver.completion(infos('changed one#changed two'), blanks, fillHandler)).finish, false);
	assert.deepEqual(
		blanks.map((blank) => blank.value),
		['new one', 'new two']
	);

	// 连线题：先验证整组答案，再覆盖真实选中状态并触发 change。
	const selects = [document.createElement('select'), document.createElement('select')];
	for (const select of selects) {
		for (const value of ['A', 'B', 'C']) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = value;
			select.appendChild(option);
		}
		select.selectedIndex = 0;
	}
	const rows = selects.map((select) => Array.from(select.options));
	assert.equal(
		planCompoundAnswer(['B'], rows, (o) => o.value),
		undefined
	);
	assert.equal(
		planCompoundAnswer(['B', 'Z'], rows, (o) => o.value),
		undefined
	);
	assert.deepEqual(
		selects.map((select) => select.value),
		['A', 'A']
	);
	const targets = planCompoundAnswer(['B', 'C'], rows, (o) => o.value)!;
	let changes = 0;
	selects.forEach((select) => select.addEventListener('change', () => changes++));
	assert.ok(targets.every((target, i) => replaceSelectAnswer(selects[i], target)));
	assert.deepEqual(
		selects.map((select) => select.value),
		['B', 'C']
	);
	assert.equal(changes, 2);
	assert.ok(targets.every((target, i) => replaceSelectAnswer(selects[i], target)));
	assert.equal(changes, 2);

	// 阅读理解/完形填空：必须验证所有小题的选项，不接受不完整或重复匹配。
	assert.deepEqual(
		planCompoundAnswer(
			['B', 'A'],
			[
				['A', 'B'],
				['A', 'C']
			],
			(v) => v
		),
		['B', 'A']
	);
	assert.equal(
		planCompoundAnswer(
			['B'],
			[
				['A', 'B'],
				['A', 'C']
			],
			(v) => v
		),
		undefined
	);
	assert.equal(
		planCompoundAnswer(
			['B', 'B'],
			[
				['A', 'B'],
				['A', 'C']
			],
			(v) => v
		),
		undefined
	);
	assert.equal(
		planCompoundAnswer(['B'], [['B', 'B']], (v) => v),
		undefined
	);

	console.log('Choice, judgement, text, line and compound question re-answer tests: PASS');
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
