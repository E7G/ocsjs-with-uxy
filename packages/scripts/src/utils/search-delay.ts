/** Only loopback HTTP(S) endpoints qualify for zero-delay searches. */
export function getSearchDelayMs(wrappers: { url: string }[], period?: number): number {
	const localOnly =
		wrappers.length > 0 &&
		wrappers.every(({ url }) => {
			try {
				const endpoint = new URL(url);
				return (
					['http:', 'https:'].includes(endpoint.protocol) &&
					['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
				);
			} catch {
				return false;
			}
		});
	const seconds = Number(period ?? (localOnly ? 0 : 3));
	if (!Number.isFinite(seconds) || seconds < 0) return localOnly ? 0 : 3000;
	return seconds === 0 && !localOnly ? 3000 : seconds * 1000;
}
