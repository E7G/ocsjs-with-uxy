import { OCSWorker, $, createDefaultQuestionResolver } from '@ocsjs/core';
import { Project, Script, $el, $message, $ui } from 'easy-us';
import { CommonWorkOptions, playMedia } from '../utils';
import { CommonProject } from './common';
import { commonWork, createCommonAnswerer, updateDynamicResult } from '../utils/work';
import { workNotes } from '../utils/configs';

const workPages: [string, string][] = [
	['作业页面', 'quiz'],
	['考试页面', 'exam']
];

const isWork = () => {
	return window.location.href.includes('homework');
};
// const isExam = () => {
// 	return window.location.href.includes('exam');
// };

export const ULearningProject = Project.create({
	name: '优学院',
	domains: ['ulearning.cn', 'ulearning.com.cn'],
	scripts: {
		study: new Script({
			name: '📚 课程学习',
			matches: [['视频学习', /learnCourse\.html/]],
			configs: {
				notes: {
					defaultValue: $ui.notes(['可用来看优学院视频而不用手动点击', '基于OCS框架重构', '未完善，暂时无法使用'])
						.outerHTML
				},
				playbackRate: {
					label: '播放倍速',
					attrs: {
						type: 'number',
						min: 0.5,
						max: 16,
						step: 0.5
					},
					defaultValue: 1.0
				},
				volume: {
					label: '初始音量',
					attrs: {
						type: 'number',
						min: 0,
						max: 1,
						step: 0.1
					},
					defaultValue: 0.5
				}
			},
			async oncomplete() {
				const player = await waitForVideoPlayer();
				const speedControl = new SpeedController(this.cfg.playbackRate);

				// 应用音量设置
				player.volume = this.cfg.volume;

				// 监听倍速配置变化
				this.onConfigChange('playbackRate', (rate) => {
					speedControl.applyTo(player);
				});

				// 监听音量配置变化
				this.onConfigChange('volume', (vol) => {
					player.volume = vol;
				});

				// 处理暂停后自动恢复
				player.addEventListener('pause', async () => {
					if (!player.ended) {
						await $.sleep(1000);
						playMedia(() => player.play());
					}
				});

				player.addEventListener('ended', () => {
					$message.success('视频播放完毕');
					navigateToNext();
				});

				speedControl.applyTo(player);
				playMedia(() => player.play());
			}
		}),

		work: new Script({
			name: '📝 作业考试',
			matches: workPages,
			configs: { notes: workNotes },
			async oncomplete() {
				commonWork({
					mount_script: this,
					workerProvider: (opt) => workOrExam(isWork() ? 'work' : 'exam', opt)
				});
			}
		})
	}
});

function uxyOptionText(option: HTMLElement): string {
	if (option.innerHTML.includes('icon-zhengque')) return '正确';
	if (option.innerHTML.includes('icon-cuowu1')) return '错误';
	return option.innerText?.trim() || option.textContent?.trim() || '';
}

function workOrExam(
	type: 'work' | 'exam',
	{ answererWrappers, period, thread, answerSeparators }: CommonWorkOptions
) {
	$message.info('开始' + (type === 'work' ? '作业' : '考试'));
	CommonProject.scripts.workResults.methods.init({ questionPositionSyncHandlerType: 'uxy' });

	const titleTransform = (titles: (HTMLElement | undefined)[]) =>
		titles.filter((title) => title?.innerText).map((title) => title!.innerText.trim()).join(',');

	const worker = new OCSWorker({
		root: '.question-item',
		rootObserver: { enabled: true },
		elements: {
			title: '.question-title',
			options: '.ul-radio__label,.ul-checkbox__label',
			type: '.gray'
		},
		thread: thread ?? 1,
		answerSeparators: answerSeparators.split(',').map((separator) => separator.trim()),
		answerer: createCommonAnswerer({
			titleTransform: (elements, ctx) => {
				const detected = getQuestionType(elements.type?.[0]?.innerText || '');
				ctx.type = detected && ['single', 'multiple', 'judgement', 'completion'].includes(detected)
					? detected as 'single' | 'multiple' | 'judgement' | 'completion'
					: undefined;
				return titleTransform(elements.title);
			},
			optionsTransform: (elements, ctx) =>
				ctx.type === 'completion' ? '' : (elements.options || []).map((option: HTMLElement) => uxyOptionText(option)).join('\n'),
			answererWrappers,
			period
		}),
		work: async (ctx) => {
			const { elements, searchInfos } = ctx;
			const questionType = getQuestionType(elements.type?.[0]?.innerText || '');
			if (!questionType || !['single', 'multiple', 'judgement', 'completion'].includes(questionType)) {
				return { finish: false };
			}
			const resolver = createDefaultQuestionResolver(ctx, (option) => uxyOptionText(option))[
				questionType as 'single' | 'multiple' | 'judgement' | 'completion'
			];
			const options = (elements.options || []).filter(Boolean) as HTMLElement[];
			return resolver(searchInfos, options, async (selectedType, answer, option) => {
				if (!option) return;
				if (selectedType === 'judgement' || selectedType === 'single' || selectedType === 'multiple') {
					const input = option.querySelector<HTMLInputElement>('input');
					const checked = input?.checked || !!option.closest('.is-checked');
					if (!checked) {
						option.click();
						await $.sleep(300);
					}
				} else if (selectedType === 'completion' && answer.trim()) {
					const textarea = option.matches('textarea') ? option as HTMLTextAreaElement : option.querySelector<HTMLTextAreaElement>('textarea');
					if (textarea) {
						textarea.value = answer;
						textarea.dispatchEvent(new Event('input', { bubbles: true }));
					}
					const frame = option.querySelector<HTMLIFrameElement>('iframe');
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
		$message.info({ content: '作业/考试完成，请自行检查后保存或提交。', duration: 0 });
		worker.emit('done');
	}).catch((error) => {
		$message.error({ content: '作业/考试失败: ' + String(error), duration: 0 });
	});
	return worker;
}

// 视频控制相关
class SpeedController {
	private speed: number = 1.0;

	constructor(private speedinput: number) {
		this.speed = speedinput;
	}

	applyTo(video: HTMLVideoElement) {
		video.playbackRate = this.speed;
		video.dispatchEvent(new Event('ratechange'));
	}
}

async function waitForVideoPlayer() {
	return new Promise<HTMLVideoElement>((resolve) => {
		const check = () => {
			const player = document.querySelector('video');
			if (player?.readyState === 4) resolve(player);
			else setTimeout(check, 500);
		};
		check();
	});
}

// 增强下一页按钮判断逻辑
async function navigateToNext() {
	const nextButton = document.querySelector<HTMLDivElement>('.next-page-btn');
	if (nextButton) {
		// 使用规范化文本比较
		const btnText = nextButton.innerText.replace(/\s/g, '').toLowerCase();
		if (btnText.includes('下一页') || btnText.includes('next')) {
			$message.success({ content: '下一页', duration: 0 });
			nextButton.click();
			await $.sleep(1000); // 增加页面加载等待时间
			return true;
		} else {
			// 完成全部任务
			$message.success({ content: '所有任务已完成', duration: 0 });
			return false;
		}
	}
	// document.querySelector<HTMLDivElement>(".next-page-btn")?.click();
}

/**
 * 优学院题目类型映射（包含匹配）：
 * 包含"单选题" -> single
 * 包含"多选题" -> multiple
 * 包含"判断题" -> judgement
 * 包含"连线题" -> line
 * 包含"完形填空" -> fill
 * 包含"阅读理解" -> reader
 * 包含特定题型关键词 -> completion
 */
function getQuestionType(
	val: string
): 'single' | 'multiple' | 'judgement' | 'completion' | 'line' | 'fill' | 'reader' | undefined {
	return val.includes('单选题')
		? 'single'
		: val.includes('多选题')
		? 'multiple'
		: val.includes('判断题')
		? 'judgement'
		: ['简答题', '填空题', '名词解释', '论述题', '计算题', '其他题', '分录题', '资料题'].some((t) => val.includes(t))
		? 'completion'
		: val.includes('连线题')
		? 'line'
		: val.includes('完形填空')
		? 'fill'
		: val.includes('阅读理解')
		? 'reader'
		: undefined;
}
