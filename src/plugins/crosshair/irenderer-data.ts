import { CrosshairType, type CrosshairOptions } from "./constants";

export interface CrosshairRendererData {
	y: number;
	x: number;
	iconScaling: number;
	text: string;
	isHovered: boolean;
	size: number;
	crossType: CrosshairType;
	icon: Path2D[] | null;
}

export interface IRendererData {
	color: string;
	strokeColor: string;
	crosshair: CrosshairRendererData | null;
	options: CrosshairOptions;
}
