/** Use the control's own document for iframe and cross-realm events. */
function notifyAnswerChange(element: HTMLElement, type: string) {
	const event = element.ownerDocument.createEvent('Event');
	event.initEvent(type, true, false);
	element.dispatchEvent(event);
}

/** Match a complete group of answers before changing any sub-question. */
export function planCompoundAnswer<T>(
	answers: string[],
	rows: T[][],
	value: (option: T) => string | null | undefined
): T[] | undefined {
	if (!rows.length || answers.length !== rows.length) return;
	const targets: T[] = [];
	for (let i = 0; i < rows.length; i++) {
		const answer = answers[i].trim();
		if (!answer) return;
		const matches = rows[i].filter((option) => value(option)?.trim() === answer);
		if (matches.length !== 1) return;
		targets.push(matches[0]);
	}
	return targets;
}

/** Set the live select value, not its initial HTML selected attribute. */
export function replaceSelectAnswer(select: HTMLSelectElement, option: HTMLOptionElement): boolean {
	if (select.disabled || option.disabled || !Array.from(select.options).includes(option)) return false;
	if (select.selectedIndex === option.index) return true;
	select.selectedIndex = option.index;
	notifyAnswerChange(select, 'input');
	notifyAnswerChange(select, 'change');
	return select.selectedIndex === option.index;
}

/** Replace editable text instead of appending, and notify the page's reactive model. */
export function replaceTextAnswer(input: HTMLInputElement | HTMLTextAreaElement, answer: string): boolean {
	if (!answer.trim() || input.disabled || input.readOnly) return false;
	if (input.value === answer) return true;
	input.value = answer;
	notifyAnswerChange(input, 'input');
	notifyAnswerChange(input, 'change');
	return input.value === answer;
}
