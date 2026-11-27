type ChoiceKind = 'single' | 'multiple' | 'judgement';

interface ChoiceControl {
	selected: boolean;
	disabled?: boolean;
	click: () => void;
}

const nativeSelector = 'input[type="checkbox"],input[type="radio"]';

/** Read only controls belonging to this option, never the entire question. */
function choiceControl(option: HTMLElement): ChoiceControl | undefined {
	const find = (selector: string): HTMLElement | null =>
		option.matches(selector) ? option : option.querySelector<HTMLElement>(selector);
	// Chaoxing's chapter test uses ARIA on the option row.
	const row = option.closest<HTMLElement>(
		'li[aria-checked], [role="checkbox"][aria-checked], [role="radio"][aria-checked]'
	);
	const aria = row ?? find('[aria-checked="true"],[aria-checked="false"]');
	if (aria) {
		return { selected: aria.getAttribute('aria-checked') === 'true', click: () => option.click() };
	}
	// Chaoxing's assignment / in-class practice custom controls.
	if (option.matches('.answer_p') && option.parentElement) {
		return {
			selected: !!option.parentElement.querySelector('[class*="check_answer"]'),
			click: () => option.click()
		};
	}
	if (option.matches('.option-result')) {
		return { selected: option.classList.contains('active'), click: () => option.click() };
	}
	const label = option.closest<HTMLElement>('.ul-checkbox,.ul-radio');
	const native = (find(nativeSelector) ??
		label?.querySelector(nativeSelector) ??
		(option.matches('.after,li label,span.saveSingleSelect')
			? option.closest('li')?.querySelector(nativeSelector)
			: null)) as HTMLInputElement | null;
	if (native) {
		return { selected: native.checked, disabled: native.disabled, click: () => native.click() };
	}
	// Known custom checkbox/radio widgets used by the platform adapters.
	const widget = find('.el-checkbox__input,.el-radio__input,.el-checkbox,.el-radio,.ivu-checkbox,.ivu-radio');
	if (widget) {
		const selected =
			widget.matches('.is-checked,.ivu-checkbox-checked,.ivu-radio-checked') ||
			!!widget.querySelector('.is-checked,.ivu-checkbox-checked,.ivu-radio-checked');
		return { selected, click: () => widget.click() };
	}
	if (option.matches('li') && option.closest('ul.list-unstyled,ul.list-unstyled-radio,ul.list-unstyled-checkbox')) {
		const itemLabel = option.querySelector('label');
		if (itemLabel) {
			return {
				selected: itemLabel.classList.contains('is-checked') || !!option.querySelector('.el-icon-check'),
				click: () => itemLabel.click()
			};
		}
	}
	if (label) {
		return { selected: label.classList.contains('is-checked'), click: () => option.click() };
	}
	const icon = find('i.iconfont');
	if (icon) {
		return { selected: icon.classList.contains('checkedIcon'), click: () => icon.click() };
	}
	const checkbox = find('.checkbox_on,.checkbox_off');
	if (checkbox) {
		return {
			selected: checkbox.classList.contains('checkbox_on'),
			click: () => (option.querySelector<HTMLElement>('div') ?? option).click()
		};
	}
	if (option.matches('label.user-select.group')) {
		return { selected: !!option.querySelector('div.bg-mainBg'), click: () => option.click() };
	}
	return undefined;
}

export function getChoiceSelected(option: HTMLElement): boolean | undefined {
	return choiceControl(option)?.selected;
}

async function waitForSelection(option: HTMLElement, expected: boolean): Promise<boolean> {
	// Give reactive components time to update; never click a second time blindly.
	for (let i = 0; i <= 10; i++) {
		if (choiceControl(option)?.selected === expected) return true;
		if (i < 10) await new Promise<void>((resolve) => setTimeout(resolve, 50));
	}
	return false;
}

/**
 * Reset a previously answered multiple-choice question when stale selections exist,
 * then apply the new answer. Single/radio choices are replaced through their normal
 * click behavior. Do not touch a question until an answer has been resolved.
 */
export async function applyChoiceSelection(
	type: ChoiceKind,
	options: HTMLElement[],
	targets: HTMLElement[],
	select: (option: HTMLElement) => void | Promise<void>
): Promise<boolean> {
	const desired = new Set(targets);
	if (!desired.size || targets.some((option) => !options.includes(option))) return false;
	const states = options.map((option) => choiceControl(option));
	if (options.some((option, i) => states[i]?.disabled && states[i]?.selected !== desired.has(option))) return false;
	if (type === 'multiple' && states.every((state) => state !== undefined && !state.disabled)) {
		const stale = options.some((option, i) => states[i]?.selected && !desired.has(option));
		if (stale) {
			// Clear the old answer completely, using normal controls so the page model is updated.
			for (const option of options) {
				const control = choiceControl(option);
				if (control?.selected) {
					control.click();
					if (!(await waitForSelection(option, false))) return false;
				}
			}
		}
	} else if (type === 'multiple') {
		// Unknown widgets: clear only positively identified stale selections.
		for (const option of options) {
			const control = choiceControl(option);
			if (!desired.has(option) && control?.selected) {
				control.click();
				if (!(await waitForSelection(option, false))) return false;
			}
		}
	}
	for (const option of desired) {
		const state = choiceControl(option);
		if (state?.selected) continue;
		await select(option);
		if (state && !(await waitForSelection(option, true))) return false;
	}
	// For observable controls, do not report completion if a stale selection remains.
	return options.every((option) => {
		const state = choiceControl(option);
		return !state || state.selected === desired.has(option);
	});
}
