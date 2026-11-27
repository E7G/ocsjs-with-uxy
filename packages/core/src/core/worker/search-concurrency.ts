/** No arbitrary concurrency ceiling; never allocate more workers than questions. */
export function getSearchConcurrency(requested: unknown, questionCount: number): number {
	const value = typeof requested === 'number' || typeof requested === 'string' ? Number(requested) : NaN;
	const count = Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
	return Math.min(count, Math.max(0, Math.floor(questionCount)));
}
