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
		if (!this._data.crosshair) return;

		const ctx = scope.context;
		const opts = this._data.options.priceScaleLabel;
		const text = this._data.crosshair.text;
		if (!text) return;

		try {
			const hRatio = scope.horizontalPixelRatio;
			const vRatio = scope.verticalPixelRatio;
			const radius = opts.borderRadius * hRatio;

			ctx.save();
			ctx.font = `${Math.round(opts.fontSize * vRatio)}px ${opts.fontFamily}`;
			const textMetrics = ctx.measureText(text);
			const textWidth = textMetrics.width;
			const padding = opts.textLeftPadding * hRatio;
			const bgWidth = textWidth + padding * 2;
			const bgHeight = opts.height * vRatio;

			const xDimension = positionsLine(this._data.crosshair.x, hRatio, 1);
			const bgX = xDimension.position - bgWidth / 2;

			ctx.beginPath();
			ctx.fillStyle = this._data.color;
			ctx.roundRect(bgX, 0, bgWidth, bgHeight, [radius, radius, radius, radius]);
			ctx.fill();

			ctx.beginPath();
			ctx.fillStyle = opts.textColor;
			ctx.textBaseline = "middle";
			ctx.textAlign = "center";
			ctx.fillText(text, xDimension.position, bgHeight / 2);
		} finally {
			ctx.restore();
		}
	}
}
