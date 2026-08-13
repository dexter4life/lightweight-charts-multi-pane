/** Recursively makes all properties in T optional (simpler than the library-wide DeepPartial
 *  because it doesn't try to partially-unwrap array element types). */
export type PartialOptions<T> = {
	[P in keyof T]?: T[P] extends object ? PartialOptions<T[P]> : T[P];
};

export enum CrosshairType {
	CROSS = "Cross",
	DOT = "Dot",
	ARROW = "Arrow",
	DEMONSTRATION = "Demo",
}

export interface CrosshairOptions {
	line: {
		color: string;
		dashLength: number;
	};
	crossType: CrosshairType;
	size: number;
	priceScaleLabel: {
		height: number;
		borderRadius: number;
		rightInset: number;
		textLeftPadding: number;
		fontSize: number;
		fontFamily: string;
		textColor: string;
	};
}

export const cross: Path2D[] = [
	new Path2D(
		"M11.084 1.084C11.084 0.53172 10.6363 0.0840001 10.084 0.0840001C9.5317 0.0840001 9.084 0.53172 9.084 1.084V9.084H1.084C0.53172 9.084 0.0840001 9.5317 0.0840001 10.084C0.0840001 10.6363 0.53172 11.084 1.084 11.084H9.084V19.084C9.084 19.6363 9.5317 20.084 10.084 20.084C10.6363 20.084 11.084 19.6363 11.084 19.084V11.084H19.084C19.6363 11.084 20.084 10.6363 20.084 10.084C20.084 9.5317 19.6363 9.084 19.084 9.084H11.084V1.084Z",
	),
];
