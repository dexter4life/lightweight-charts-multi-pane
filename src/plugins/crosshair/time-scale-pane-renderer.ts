import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from "fancy-canvas";
import { positionsLine } from "../../helpers/dimensions/positions";
import { PaneRendererBase } from "./renderer-base";

export class TimeScalePaneRenderer extends PaneRendererBase {
	draw(target: CanvasRenderingTarget2D): void {
		target.useBitmapCoordinateSpace((scope) => {
			if (this._data.crosshair?.isHovered) {
				this._drawCrosshairLabel(scope);
			}
		});
	}

	_drawCrosshairLabel(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.crosshair || !this._data.crosshairOptions || !this._data.options)
			return;

		const ctx = scope.context;
		const opts = this._data.crosshairOptions;
		const chartOptions = this._data.options;
		const text = this._data.crosshair.text;
		if (!text) return;

		try {
			const hRatio = scope.horizontalPixelRatio;
			const vRatio = scope.verticalPixelRatio;
			const radius = 4 * hRatio;

			ctx.save();
			ctx.font = `${Math.round(chartOptions.layout.fontSize * vRatio)}px ${chartOptions.layout.fontFamily}`;
			const textMetrics = ctx.measureText(text);
			const textWidth = textMetrics.width;
			const fontHeight =
				textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent;
			const padding = 3 * hRatio;
			const bgHeight = fontHeight + padding * 2;
			const bgWidth = textWidth + padding * vRatio;

			const xDimension = positionsLine(this._data.crosshair.x, hRatio, 1);
			const bgX = xDimension.position - bgWidth / 2;

			ctx.beginPath();
			ctx.fillStyle = opts.vertLine?.labelBackgroundColor!;
			ctx.roundRect(bgX, 0, bgWidth, bgHeight, [radius, radius, radius, radius]);
			ctx.fill();

			ctx.beginPath();
			ctx.fillStyle = opts.vertLine?.color!;
			ctx.textBaseline = "middle";
			ctx.textAlign = "center";
			ctx.fillText(text, xDimension.position, bgHeight / 2);
		} finally {
			ctx.restore();
		}
	}
}
