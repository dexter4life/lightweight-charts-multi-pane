import { BarPrice } from "@core/model/bar";
import { MousePosition } from "@core/plugins/price-alert/mouse";

/** Recursively makes all properties in T optional (simpler than the library-wide DeepPartial
 *  because it doesn't try to partially-unwrap array element types). */
export type PartialOptions<T> = {
	[P in keyof T]?: T[P] extends object ? PartialOptions<T[P]> : T[P];
};

/** Configurable visual options for the PriceAlerts plugin. */
export interface PriceAlertsOptions {
	beforeAddAlert?: (mousePosition: MousePosition, price: BarPrice | null) => boolean;
	line: {
		color: string;
		dashLength: number;
		selectedWidth: number;
		unselectedWidth: number;
		hitTolerance: number;
	};
	label: {
		height: number;
		borderRadius: number;
		iconSize: number;
		iconViewBoxSize: number;
		iconPaddingLeft: number;
		iconPaddingAlertTop: number;
		fontColor: string;
	};
	crosshairButton: {
		width: number;
		height: number;
		borderRadius: number | number[];
		hoverColor: string;
		iconViewBoxSize: number;
		iconPadding: number;
	};
	centreLabel: {
		height: number;
		inlinePadding: number;
		removeButtonWidth: number;
		borderRadius: number;
		fontColor: string;
		fontSize: number;
		fontFamily: string;
		backgroundColor: string;
		removeHoverBackground: string;
		dividerColor: string;
		borderColor: string;
		borderWidth: number;
		removeIconSize: number;
		removeIconViewBoxSize: number;
		removeIconYOffset: number;
		averageCharWidth: number;
		showDistance: number;
	};
	priceScaleLabel: {
		fontSize: number;
		fontFamily: string;
		textColor: string;
		borderRadius: number;
		rightInset: number;
		textLeftPadding: number;
		height: number;
		selectedTopOffset: number;
		selectedHeightReduction: number;
		priceDecimals: number;
	};
}

export const defaultPriceAlertsOptions: PriceAlertsOptions = {
	line: {
		color: "#131722",
		dashLength: 4,
		selectedWidth: 2,
		unselectedWidth: 1,
		hitTolerance: 2,
	},
	label: {
		height: 17,
		borderRadius: 2,
		iconSize: 13,
		iconViewBoxSize: 13,
		iconPaddingLeft: 4,
		iconPaddingAlertTop: 2,
		fontColor: "#FFFFFF",
	},
	crosshairButton: {
		width: 21,
		height: 21,
		borderRadius: [2, 0, 0, 2],
		hoverColor: "#50535E",
		iconViewBoxSize: 13,
		iconPadding: 4,
	},
	centreLabel: {
		height: 20,
		inlinePadding: 9,
		removeButtonWidth: 26,
		borderRadius: 4,
		fontColor: "#131722",
		fontSize: 12,
		fontFamily: "sans-serif",
		backgroundColor: "#FFFFFF",
		removeHoverBackground: "#F0F3FA",
		dividerColor: "#F1F3FB",
		borderColor: "#131722",
		borderWidth: 1,
		removeIconSize: 10,
		removeIconViewBoxSize: 10,
		removeIconYOffset: 5,
		averageCharWidth: 5.81,
		showDistance: 50,
	},
	priceScaleLabel: {
		fontSize: 12,
		fontFamily: "sans-serif",
		textColor: "#FFFFFF",
		borderRadius: 2,
		rightInset: 8,
		textLeftPadding: 10,
		height: 21,
		selectedTopOffset: 2,
		selectedHeightReduction: 6,
		priceDecimals: 2,
	},
};

export const clockPlusIconPaths: Path2D[] = [
	new Path2D(
		"M5.34004 1.12254C4.7902 0.438104 3.94626 0 3 0C1.34315 0 0 1.34315 0 3C0 3.94626 0.438104 4.7902 1.12254 5.34004C1.04226 5.714 1 6.10206 1 6.5C1 9.36902 3.19675 11.725 6 11.9776V10.9725C3.75002 10.7238 2 8.81628 2 6.5C2 4.01472 4.01472 2 6.5 2C8.81628 2 10.7238 3.75002 10.9725 6H11.9776C11.9574 5.77589 11.9237 5.55565 11.8775 5.34011C12.562 4.79026 13.0001 3.9463 13.0001 3C13.0001 1.34315 11.6569 0 10.0001 0C9.05382 0 8.20988 0.438111 7.66004 1.12256C7.28606 1.04227 6.89797 1 6.5 1C6.10206 1 5.714 1.04226 5.34004 1.12254ZM4.28255 1.46531C3.93534 1.17484 3.48809 1 3 1C1.89543 1 1 1.89543 1 3C1 3.48809 1.17484 3.93534 1.46531 4.28255C2.0188 3.02768 3.02768 2.0188 4.28255 1.46531ZM8.71751 1.46534C9.97237 2.01885 10.9812 3.02774 11.5347 4.28262C11.8252 3.93541 12.0001 3.48812 12.0001 3C12.0001 1.89543 11.1047 1 10.0001 1C9.51199 1 9.06472 1.17485 8.71751 1.46534Z",
	),
	new Path2D("M7 7V4H8V8H5V7H7Z"),
	new Path2D("M10 8V10H8V11H10V13H11V11H13V10H11V8H10Z"),
];

export const clockIconPaths: Path2D[] = [
	new Path2D(
		"M13.14 4.85c-.2-.2-.2-.52 0-.71 .19-.2.51-.2.7 0l7.5 7.49c.19.19.19.51 0 .7l-7.5 7.5c-.2.19-.52.19-.71 0 -.2-.2-.2-.52 0-.71l6.64-6.65H2.97c-.28 0-.5-.23-.5-.5 0-.28.22-.5.5-.5h16.79l-6.65-6.65Z",
	),
];

export const crossPath = new Path2D(
	"M9.35359 1.35359C9.11789 1.11789 8.88219 0.882187 8.64648 0.646484L5.00004 4.29293L1.35359 0.646484C1.11791 0.882212 0.882212 1.11791 0.646484 1.35359L4.29293 5.00004L0.646484 8.64648C0.882336 8.88204 1.11804 9.11774 1.35359 9.35359L5.00004 5.70714L8.64648 9.35359C8.88217 9.11788 9.11788 8.88217 9.35359 8.64649L5.70714 5.00004L9.35359 1.35359Z",
);
