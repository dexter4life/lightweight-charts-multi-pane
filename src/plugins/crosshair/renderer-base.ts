import { CanvasRenderingTarget2D } from "fancy-canvas";
import { IPrimitivePaneRenderer } from "../../model/ipane-primitive";
import { IRendererData } from "./irenderer-data";

export abstract class PaneRendererBase implements IPrimitivePaneRenderer {
	_data: IRendererData = {
		altKeyPressed: false,
		hasFocus: false,
		crosshair: null,
		options: undefined,
		crosshairOptions: {},
	};
	abstract draw(target: CanvasRenderingTarget2D): void;
	update(data: IRendererData) {
		this._data = data;
	}
}
