import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from "fancy-canvas";
import { positionsLine } from "../../helpers/dimensions/positions";
import { PaneRendererBase } from "./renderer-base";

export class PriceScalePaneRenderer extends PaneRendererBase {
	draw(target: CanvasRenderingTarget2D): void {
		target.useBitmapCoordinateSpace((scope) => {
			this._drawCrosshairLabel(scope);
			const color = this._data.color;

			this._data.alerts.forEach((alertData) => {
				//draw the Line label
				if (alertData.selected) {
					this._drawHorizontalLineLabel(scope, {
						price: alertData.price,
						y: alertData.y,
						color,
					});
				}
			});
		});
	}

	_drawCrosshairLabel(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.crosshair) return;
		const ctx = scope.context;
		const opts = this._data.options.priceScaleLabel;
		try {
			const width = scope.bitmapSize.width;
			const labelWidth = width - opts.rightInset * scope.horizontalPixelRatio;
			ctx.save();
			ctx.beginPath();
			ctx.fillStyle = this._data.color;
			const labelDimensions = positionsLine(
				this._data.crosshair.y,
				scope.verticalPixelRatio,
				opts.height,
			);
			const radius = opts.borderRadius * scope.horizontalPixelRatio;
			ctx.roundRect(0, labelDimensions.position, labelWidth, labelDimensions.length, [
				0,
				radius,
				radius,
				0,
			]);
			ctx.fill();
			ctx.beginPath();
			ctx.fillStyle = opts.textColor;
			ctx.textBaseline = "middle";
			ctx.textAlign = "right";
			ctx.font = `${Math.round(opts.fontSize * scope.verticalPixelRatio)}px ${opts.fontFamily}`;
			const textMeasurements = ctx.measureText(this._data.crosshair.text);
			ctx.fillText(
				this._data.crosshair.text,
				textMeasurements.width + opts.textLeftPadding * scope.horizontalPixelRatio,
				this._data.crosshair.y * scope.verticalPixelRatio,
			);
		} finally {
			ctx.restore();
		}
	}

	_drawHorizontalLineLabel(
		scope: BitmapCoordinatesRenderingScope,
		data: { price?: number; color: string; y: number },
	) {
		if (!data.price) return;

		const ctx = scope.context;
		const opts = this._data.options.priceScaleLabel;
		try {
			const width = scope.bitmapSize.width;
			const labelWidth = width - opts.rightInset * scope.horizontalPixelRatio;
			ctx.save();
			ctx.beginPath();
			ctx.fillStyle = data.color;
			const labelDimensions = positionsLine(
				data.y,
				scope.verticalPixelRatio,
				opts.height,
			);
			const radius = opts.borderRadius * scope.horizontalPixelRatio;
			ctx.roundRect(
				0,
				labelDimensions.position + opts.selectedTopOffset,
				labelWidth,
				labelDimensions.length - opts.selectedHeightReduction,
				[0, radius, radius, 0],
			);
			ctx.fill();
			ctx.beginPath();
			ctx.fillStyle = opts.textColor;
			ctx.textBaseline = "middle";
			ctx.textAlign = "right";
			ctx.font = `${Math.round(opts.fontSize * scope.verticalPixelRatio)}px ${opts.fontFamily}`;
			const textMeasurements = ctx.measureText(data.price.toFixed(opts.priceDecimals));
			ctx.fillText(
				data.price.toFixed(opts.priceDecimals),
				textMeasurements.width + opts.textLeftPadding * scope.horizontalPixelRatio,
				data.y * scope.verticalPixelRatio,
			);
		} finally {
			ctx.restore();
		}
	}
}
