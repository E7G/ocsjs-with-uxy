import { QuestionResolver, WorkContext } from './interface';
import { applyChoiceSelection } from './choice-selection';
import { resolveSingle, resolveMultiple, resolveJudgement, resolveCompletion, isJudgementOptions } from './resolvers';

/** 默认答案题目处理器 */
export function createDefaultQuestionResolver<E>(
	ctx: WorkContext<E>,
	/**
	 * 选项文本提供器：替代 `o.innerText`。
	 * 图片题等场景下 innerText 无法获取 img 的 URL，需由调用方通过 DOM 遍历提供。
	 * 不传则回退到 `o.innerText`，旧调用方零影响。
	 */
	optionText?: (el: HTMLElement, i: number) => string
): Record<'single' | 'multiple' | 'completion' | 'judgement', QuestionResolver<E>> {
	const toText = (o: HTMLElement, i: number) => (optionText ? optionText(o, i) : o.innerText);
	return {
		/**
		 * 单选题处理器
		 *
		 * 委托给 resolveSingle 纯函数，将 DOM 元素适配为字符串
		 */
		async single(infos, options, handler) {
			const optionTexts = options.map((o, i) => toText(o, i));

			// 选项具备判断题性质时，直接走判断题处理逻辑
			if (isJudgementOptions(optionTexts.map((o) => o.trim()))) {
				const answerGroups = infos.map((info) => info.results.map((res) => res.answer));
				const result = resolveJudgement(answerGroups, optionTexts);
				if (result.finish && result.option !== undefined) {
					const index = optionTexts.indexOf(result.option);
					if (index === -1) return { ...result, finish: false, applyFailed: true };
					const opt = options[index];
					if (
						!(await applyChoiceSelection('judgement', options, [opt], (target) =>
							handler('judgement', result.option!, target, ctx)
						))
					) {
						return { ...result, finish: false, applyFailed: true };
					}
				}
				return result;
			}

			const answers = infos.map((info) => info.results.map((res) => res.answer)).flat();

			const result = resolveSingle(answers, optionTexts, ctx.answerSeparators);

			if (result.finish && result.option !== undefined) {
				const index = optionTexts.indexOf(result.option);
				if (index === -1) return { ...result, finish: false, applyFailed: true };
				const opt = options[index];
				if (
					!(await applyChoiceSelection('single', options, [opt], (target) =>
						handler('single', result.option!, target, ctx)
					))
				) {
					return { ...result, finish: false, applyFailed: true };
				}
			}

			return result;
		},
		/**
		 * 多选题处理器
		 *
		 * 委托给 resolveMultiple 纯函数，将 DOM 元素适配为字符串
		 */
		async multiple(infos, options, handler) {
			const resultAnswers = infos.map((info) => info.results.map((res) => res.answer)).flat();
			const optionTexts = options.map((o, i) => toText(o, i));

			const result = resolveMultiple(resultAnswers, optionTexts, ctx.answerSeparators);

			// 纯 ABCD 答案兜底走 plainOptions，普通匹配走 options
			const resolvedOptions = result.finish ? result.options ?? result.plainOptions : undefined;

			if (result.finish && resolvedOptions) {
				const targets = resolvedOptions.map((text) => options[optionTexts.indexOf(text)]).filter(Boolean);
				if (
					targets.length !== resolvedOptions.length ||
					!(await applyChoiceSelection('multiple', options, targets, (target) =>
						handler('multiple', optionTexts[options.indexOf(target)], target, ctx)
					))
				) {
					return { ...result, finish: false, applyFailed: true };
				}
			}

			return result;
		},
		/**
		 * 判断题处理器
		 *
		 * 委托给 resolveJudgement 纯函数
		 */
		async judgement(infos, options, handler) {
			const answerGroups = infos.map((info) => info.results.map((res) => res.answer));
			const optionTexts = options.map((o, i) => toText(o, i));

			const result = resolveJudgement(answerGroups, optionTexts);

			if (result.finish && result.option !== undefined) {
				const index = optionTexts.indexOf(result.option);
				if (index === -1) return { ...result, finish: false, applyFailed: true };
				const opt = options[index];
				if (
					!(await applyChoiceSelection('judgement', options, [opt], (target) =>
						handler('judgement', result.option!, target, ctx)
					))
				) {
					return { ...result, finish: false, applyFailed: true };
				}
			}

			return result;
		},
		/**
		 * 填空题处理器
		 *
		 * 委托给 resolveCompletion 纯函数
		 */
		async completion(infos, options, handler) {
			const answerGroups = infos.map((info) => info.results.map((res) => res.answer));

			const result = resolveCompletion(answerGroups, options.length, ctx.answerSeparators);

			if (result.finish && result.answers) {
				if (result.answers.length !== options.length || result.answers.some((answer) => !answer.trim())) {
					return { ...result, finish: false, applyFailed: true };
				}
				const locked = options.some((option) => {
					const control = option.matches('textarea,input:not([type]),input[type="text"]')
						? (option as HTMLInputElement | HTMLTextAreaElement)
						: option.querySelector<HTMLInputElement | HTMLTextAreaElement>('textarea,input[type="text"]');
					return control?.disabled || control?.readOnly;
				});
				if (locked) return { ...result, finish: false, applyFailed: true };
				for (let i = 0; i < result.answers.length; i++) {
					await handler('completion', result.answers[i], options[i], ctx);
				}
			}

			return result;
		}
	};
}
