/** 长江雨课堂考试页题目根节点（排除答题卡等重复渲染） */
export function getYuketangExamQuestionRoots(): HTMLElement[] {
	const all = Array.from(document.querySelectorAll<HTMLElement>('.subject-item'));

	const withQuestionTitle = all.filter((el) => {
		const title = el.querySelector('.item-body h4.exam-font, .item-body > h4');
		return !!title?.textContent?.trim();
	});

	if (withQuestionTitle.length > 0 && withQuestionTitle.length < all.length) {
		return withQuestionTitle;
	}

	const withExercise = all.filter((el) => el.querySelector(':scope > .exercise-item, .exercise-item .item-body'));
	if (withExercise.length > 0 && withExercise.length < all.length) {
		return withExercise;
	}

	// 排除答题卡/侧边栏容器内的 subject-item
	const answerSheetSelectors =
		'.answer-card, .answerCard, .answer-sheet, .answerSheet, .sheet-card, .card-list, .left-bar, .aside-bar, .exam-aside, .answer-card-box';
	const inMainContent = all.filter((el) => !el.closest(answerSheetSelectors));
	if (inMainContent.length > 0 && inMainContent.length < all.length) {
		return inMainContent;
	}

	// 题号与题干重复时，保留内容更完整的一份（通常是正文区）
	const byKey = new Map<string, HTMLElement>();
	for (const el of all) {
		const typeText = el.querySelector('.item-type')?.textContent?.replace(/\s+/g, ' ').trim() || '';
		const titleText = el.querySelector('.item-body h4')?.textContent?.replace(/\s+/g, ' ').trim() || '';
		const key = `${typeText}::${titleText}`;
		const prev = byKey.get(key);
		if (!prev) {
			byKey.set(key, el);
			continue;
		}
		const richness = (node: HTMLElement) =>
			node.querySelectorAll('.list-unstyled-radio li, .list-unstyled-checkbox li').length +
			(node.querySelector('.ueditor-content') ? 10 : 0);
		byKey.set(key, richness(el) >= richness(prev) ? el : prev);
	}
	const deduped = Array.from(byKey.values());
	if (deduped.length > 0 && deduped.length < all.length) {
		return deduped;
	}

	// 整页重复渲染时，取后半部分（答题卡在前、试题在后）
	if (all.length >= 2 && all.length % 2 === 0) {
		const half = all.length / 2;
		const firstHalf = all.slice(0, half);
		const secondHalf = all.slice(half);
		const mirrored =
			firstHalf.length === secondHalf.length &&
			firstHalf.every(
				(el, i) =>
					el.querySelector('.item-type')?.textContent?.replace(/\s+/g, ' ').trim() ===
					secondHalf[i].querySelector('.item-type')?.textContent?.replace(/\s+/g, ' ').trim()
			);
		if (mirrored) {
			return secondHalf;
		}
	}

	return withQuestionTitle.length > 0 ? withQuestionTitle : all;
}

import { $, OCSWorker, createDefaultQuestionResolver } from '@ocsjs/core';
import { $message } from 'easy-us';
import { CommonWorkOptions } from '.';
import { createCommonAnswerer, updateDynamicResult } from './work';
import { CommonProject } from '../projects/common';

function yktExamType(label: string): 'single' | 'multiple' | 'judgement' | 'completion' | undefined {
	if (label.includes('单选')) return 'single';
	if (label.includes('多选')) return 'multiple';
	if (label.includes('判断')) return 'judgement';
	if (['主观', '简答', '填空', '名词解释', '论述', '计算'].some((name) => label.includes(name))) return 'completion';
	return undefined;
}

function yktExamOptionText(option: HTMLElement): string {
	const input = option.querySelector<HTMLInputElement>('input');
	if (input?.value === 'true') return '对';
	if (input?.value === 'false') return '错';
	const text = option.querySelector<HTMLElement>('.radioText, .checkboxText');
	return text?.innerText?.trim() || option.innerText?.trim() || option.textContent?.trim() || '';
}

/** Legacy longjiang exam support adapted to the new 5.0 question worker APIs. */
export function createYuketangExamWorker({ answererWrappers, period, thread, answerSeparators }: CommonWorkOptions) {
	CommonProject.scripts.workResults.methods.init({ questionPositionSyncHandlerType: 'yuketang' });
	const titleTransform = (titles: (HTMLElement | undefined)[]) =>
		titles.filter((title) => !!title).map((title) => title!.innerText?.replace(/\s+/g, ' ').trim() || '').join(',');
	const worker = new OCSWorker({
		root: getYuketangExamQuestionRoots(),
		rootObserver: { enabled: true },
		elements: {
			title: '.item-body h4.exam-font, .item-body > h4',
			type: '.item-type',
			options: (root) => {
				const items = Array.from(root.querySelectorAll<HTMLElement>(
					'.list-unstyled-radio li label.el-radio, .list-unstyled-checkbox li label.el-checkbox'
				));
				return items.length ? items : Array.from(root.querySelectorAll<HTMLElement>(
					'.ueditor-content iframe, .item-body iframe, textarea, input.blank-item-dynamic'
				));
			}
		},
		thread: thread ?? 1,
		answerSeparators: answerSeparators.split(',').map((separator) => separator.trim()),
		answerer: createCommonAnswerer({
			titleTransform: (elements, ctx) => {
				ctx.type = yktExamType(elements.type?.[0]?.innerText || '');
				return titleTransform(elements.title);
			},
			optionsTransform: (elements, ctx) =>
				ctx.type === 'completion' ? '' : (elements.options || []).map((option: HTMLElement) => yktExamOptionText(option)).join('\n'),
			answererWrappers,
			period
		}),
		work: async (ctx) => {
			const type = yktExamType(ctx.elements.type?.[0]?.innerText || '');
			if (!type) return { finish: false };
			const resolver = createDefaultQuestionResolver(ctx, (option) => yktExamOptionText(option))[type];
			return resolver(ctx.searchInfos, (ctx.elements.options || []).filter(Boolean) as HTMLElement[], async (kind, answer, option) => {
				if (!option) return;
				if (kind === 'single' || kind === 'multiple' || kind === 'judgement') {
					const input = option.querySelector<HTMLInputElement>('input');
					if (!input?.checked && !option.classList.contains('is-checked')) {
						option.click();
						await $.sleep(300);
					}
				} else if (kind === 'completion' && answer.trim()) {
					const input = option.matches('textarea,input') ? option as HTMLInputElement : option.querySelector<HTMLInputElement>('textarea,input');
					if (input) {
						input.value = answer;
						input.dispatchEvent(new Event('input', { bubbles: true }));
					}
					const frame = option.matches('iframe') ? option as HTMLIFrameElement : option.querySelector<HTMLIFrameElement>('iframe');
					if (frame?.contentDocument?.body) {
						frame.contentDocument.body.textContent = answer;
						frame.contentDocument.body.dispatchEvent(new Event('input', { bubbles: true }));
					}
				}
			});
		},
		onQuestionDetected(current) {
			updateDynamicResult(current, titleTransform);
		},
		onResultsUpdate(current) {
			updateDynamicResult(current, titleTransform);
		}
	});
	worker.doWork().then(() => {
		$message.info({ content: '考试答题完成，请检查结果后手动提交。', duration: 0 });
		worker.emit('done');
	}).catch((error) => $message.error({ content: '考试答题失败: ' + String(error), duration: 0 }));
	return worker;
}
