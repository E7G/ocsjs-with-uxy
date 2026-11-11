/**
 * Ask before a script-driven navigation that could interrupt the user's current task.
 * Native confirm is intentionally synchronous so the navigation cannot race ahead.
 */
export function confirmScriptNavigation(target: string): boolean {
	try {
		return window.confirm(
			`OCS 准备${target}。此操作会切换当前章节或页面，可能影响正在进行的操作。\n\n是否继续？`
		);
	} catch {
		return false;
	}
}
