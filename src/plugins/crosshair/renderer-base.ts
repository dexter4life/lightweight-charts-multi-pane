import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { IPrimitivePaneRenderer } from '../../model/ipane-primitive';
import { CrosshairType } from '../crosshair/constants';
import { IRendererData } from './irenderer-data';

export const defaultRendererData: IRendererData = {
	color: "#000000",
	crosshair: null,
	strokeColor: "white",
	options: {
		crossType: CrosshairType.CROSS,
		line: { color: "#000000", dashLength: 1 },
		size: 10,
		priceScaleLabel: {
			height: 24,
			borderRadius: 4,
			rightInset: 60,
			textLeftPadding: 8,
			fontSize: 12,
			fontFamily: "sans-serif",
			textColor: "#ffffff",
		},
	},
};

export abstract class PaneRendererBase implements IPrimitivePaneRenderer {
	_data: IRendererData = defaultRendererData;
	abstract draw(target: CanvasRenderingTarget2D): void;
	update(data: IRendererData) {
		this._data = data;
	}
}
