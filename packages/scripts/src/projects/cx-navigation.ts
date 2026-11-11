export type CXStudyMode = 'next' | 'job' | 'manually';

/** Manual pause mode always takes precedence over the optional first-unfinished-chapter jump. */
export function shouldAutoSelectUnfinishedChapter(mode: CXStudyMode, enabled: boolean): boolean {
	return enabled && mode !== 'manually';
}
