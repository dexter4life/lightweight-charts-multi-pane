import { DEFAULT_FONT_FAMILY } from './constants';

/**
 * Default font family.
 * Must be used to generate font string when font is not specified.
 */
export const defaultFontFamily = DEFAULT_FONT_FAMILY;

/**
 * Generates a font string, which can be used to set in canvas' font property.
 * If no family provided, {@link defaultFontFamily} will be used.
 *
 * @param size - Font size in pixels.
 * @param family - Optional font family.
 * @param style - Optional font style.
 * @returns The font string.
 */
export function makeFont(size: number, family?: string, style?: string): string {
	if (style !== undefined) {
		style = `${style} `;
	} else {
		style = '';
	}

	if (family === undefined) {
		family = defaultFontFamily;
	}

	return `${style}${size}px ${family}`;
}
