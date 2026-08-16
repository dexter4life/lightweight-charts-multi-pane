import { CrosshairOptions } from "../../model/crosshair";

export enum CrosshairType {
	/**
	 * This mode renders a cross-shaped crosshair marker at the cursor position.
	 */
	Cross = 0,

	/**
	 * This mode renders a dot-shaped crosshair marker at the cursor position.
	 */
	Dot = 1,

	/**
	 * This mode renders an arrow-shaped crosshair marker at the cursor position.
	 */
	Arrow = 2,

	/**
	 * This mode renders a demonstration crosshair marker for preview/demo purposes.
	 */
	Demo = 3,
}

export type CrosshairPluginOptions = CrosshairOptions & {
	/**
	 * Crosshair type, which controls the shape of the crosshair marker rendered at the cursor position.
	 *
	 * @defaultValue {@link CrosshairType.Cross}
	 */
	type: CrosshairType;

	anchor: {
		color?: string;
		strokeColor?: string;
	};
};

export class CrosshairState {
	constructor() {}

	destroy() {}
}
