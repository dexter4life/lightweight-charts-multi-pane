import { isChrome } from './browsers';

export function preventScrollByWheelClick(el: HTMLElement): void {
	if (!isChrome()) {
		return;
	}

	el.addEventListener('mousedown', (e: MouseEvent) => {
		if (e.button === 1) {
			e.preventDefault();
			return false;
		}
		return undefined;
	});
}

