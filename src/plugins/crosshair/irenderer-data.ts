import { ChartOptionsImpl } from "../../model/chart-model";
import { Time } from "../../model/horz-scale-behavior-time/types";
import { PartialOptions } from "../shared/partial-options";
import { CrosshairPluginOptions } from "./state";

export interface CrosshairRendererData {
	y: number;
	x: number;
	iconScaling: number;
	text: string;
	isHovered: boolean;
	mouseDown: boolean;
	icon: Path2D[] | null;
}

export interface IRendererData {
	hasFocus: boolean;
	altKeyPressed: boolean;	
	crosshair: CrosshairRendererData | null;
	options: ChartOptionsImpl<Time> | undefined;
	crosshairOptions: PartialOptions<CrosshairPluginOptions>
}
