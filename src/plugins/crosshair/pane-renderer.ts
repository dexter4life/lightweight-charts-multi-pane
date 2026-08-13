import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from "fancy-canvas";
import { positionsLine } from "../../helpers/dimensions/positions";
import { cross, CrosshairType } from "../crosshair/constants";
import { CrosshairRendererData } from "./irenderer-data";
import { PaneRendererBase } from "./renderer-base";

export class PaneRenderer extends PaneRendererBase {
	draw(target: CanvasRenderingTarget2D): void {
		target.useBitmapCoordinateSpace((scope) => {
			if (!this._data || !this._data.crosshair?.isHovered) return;
			switch (this._data.crosshair.crossType) {
				case CrosshairType.CROSS:
				case CrosshairType.DOT:
				case CrosshairType.DEMONSTRATION:
					this._drawCrosshairLine(scope);
					this._drawIcon(scope, this._data.crosshair!);
			}
		});
	}

	_drawHorizontalLine(
		scope: BitmapCoordinatesRenderingScope,
		data: {
			width: number;
			color: string;
			y: number;
		},
	) {
		if (!data) return;
		const ctx = scope.context;
		try {
			const yPos = positionsLine(data.y, scope.verticalPixelRatio, data.width);
			const yCentre = yPos.position + yPos.length / 2;

			ctx.save();
			ctx.beginPath();
			ctx.lineWidth = 2;
			ctx.strokeStyle = data.color;
			const dash = this._data.options.line.dashLength * scope.horizontalPixelRatio;
			ctx.setLineDash([dash, dash]);
			ctx.moveTo(0, yCentre);
			ctx.lineTo(data.width * scope.horizontalPixelRatio, yCentre);
			ctx.stroke();
		} finally {
			ctx.restore();
		}
	}

	_drawVerticalLine(
		scope: BitmapCoordinatesRenderingScope,
		data: { width: number; color: string; x: number },
	) {
		const ctx = scope.context;
		try {
			const xPos = positionsLine(data.x, scope.verticalPixelRatio, data.width);
			const xCentre = xPos.position + xPos.length / 2;

			ctx.save();
			ctx.beginPath();
			ctx.lineWidth = 2;
			ctx.strokeStyle = data.color;
			const dash = this._data.options.line.dashLength * scope.verticalPixelRatio;
			ctx.setLineDash([dash, dash]);
			ctx.moveTo(xCentre, 0);
			ctx.lineTo(xCentre, data.width * scope.verticalPixelRatio);
			ctx.stroke();
		} finally {
			ctx.restore();
		}
	}

	_drawCrosshairLine(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.crosshair) return;
		const color = this._data.color;

		this._drawHorizontalLine(scope, {
			width: scope.mediaSize.width,
			color,
			y: this._data.crosshair.y!,
		});
		this._drawVerticalLine(scope, {
			width: scope.mediaSize.width,
			color,
			x: this._data.crosshair.x!,
		});
	}

	_drawIcon(scope: BitmapCoordinatesRenderingScope, data: CrosshairRendererData) {
		if (!data || !data.y) return;
		const ctx = scope.context;
		try {
			ctx.save();
			ctx.beginPath();

			const yDimension = positionsLine(data.y, scope.verticalPixelRatio, data.size);
			const xDimension = positionsLine(data.x, scope.horizontalPixelRatio, data.size);

			const x = xDimension.position - (data.size + 2) * scope.horizontalPixelRatio;
			ctx.translate(x, yDimension.position - (data.size + 2) * scope.verticalPixelRatio);
			ctx.scale(
				data.iconScaling * scope.horizontalPixelRatio,
				data.iconScaling * scope.verticalPixelRatio,
			);

			ctx.fillStyle = this._data.color;
			ctx.strokeStyle = this._data.strokeColor;
			ctx.lineWidth = 1 / data.iconScaling; // keep stroke visually consistent after scaling

			switch (data.crossType) {
				case CrosshairType.CROSS:
					{
						cross.forEach((path) => {
							ctx.beginPath();
							ctx.fill(path, "evenodd");
							ctx.stroke(path);
						});
					}
					break;
				case CrosshairType.DOT:
					{
						ctx.beginPath();
						ctx.arc(10, 10, 3, 0, Math.PI * 2);
						ctx.fill();
						ctx.stroke();
					}
					break;
				case CrosshairType.DEMONSTRATION: {
					ctx.globalAlpha = 0.5;
					ctx.fillStyle = "orange";
					ctx.beginPath();
					ctx.arc(10, 10, 18, 0, Math.PI * 2);
					ctx.fill();
					ctx.globalAlpha = 1;
				}
			}
		} finally {
			ctx.restore();
		}
	}
}
