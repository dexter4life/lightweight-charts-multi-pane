import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from "fancy-canvas";
import { IChartApi } from "../../api/create-chart";
import { ISeriesApi } from "../../api/iseries-api";
import { positionsLine } from "../../helpers/dimensions/positions";
import { BarPrice } from "../../model/bar";
import { Time } from "../../model/horz-scale-behavior-time/types";
import { SeriesType } from "../../model/series-options";
import { LineStyle } from "../../renderers/draw-line";
import { cross } from "../crosshair/constants";
import { CrosshairRendererData } from "./irenderer-data";
import { PaneRendererBase } from "./renderer-base";
import { CrosshairType } from "./state";

type Point = { time: Time | null; price: BarPrice | null };
class PixelPoints {
	private _points: Point[] = [];
	private _lastTime = 0;
	private _animating = false;
	private speed = 0.0001;
	private _requestUpdate: () => void;

	opacity: number = 0.5;
	erase: boolean = false;

	constructor(requestUpdate: () => void) {
		this._requestUpdate = requestUpdate;
	}

	setPoints(time: Time | null, price: BarPrice | null) {
		this._points.push({ time, price });
	}

	points() {
		return this._points ?? [];
	}

	animate(timestamp: DOMHighResTimeStamp) {
		if (!this._lastTime) {
			this._lastTime = timestamp;
		}

		const deltaTime = timestamp - this._lastTime;
		this._lastTime = timestamp;

		this.opacity -= this.speed * deltaTime;

		if (this.opacity > 0) {
			this._requestUpdate();
			requestAnimationFrame(this.animate.bind(this));
		} else {
			this.opacity = 0;
			this._animating = false;
			this._requestUpdate();
		}
	}

	clear() {
		if (!this._animating) {
			this._animating = true;
			window.requestAnimationFrame(this.animate.bind(this));
		}
	}
}

export class PaneRenderer extends PaneRendererBase {
	private _strokes: PixelPoints[] = [];
	private _currentPoints: PixelPoints | null;
	private _wasMouseDown: boolean = false;

	constructor(
		private _chart?: IChartApi,
		private _series?: ISeriesApi<SeriesType>,
		private _requestUpdate?: () => void,
	) {
		super();

		this._currentPoints = null;
	}

	draw(target: CanvasRenderingTarget2D): void {
		target.useBitmapCoordinateSpace((scope) => {
			if (!this._data.crosshairOptions) return;

			if (
				this._data.crosshairOptions.type == CrosshairType.Demo &&
				this._data.crosshair
			) {
				if (this._data.crosshair.mouseDown && !this._wasMouseDown) {
					this._wasMouseDown = true;
					this._prepareState();
				} else if (!this._data.crosshair.mouseDown && this._wasMouseDown) {
					this._wasMouseDown = false;
					this._clearState();
				}

				if (this._data.crosshair.mouseDown && this._data.altKeyPressed) {
					this._fillPoints(scope.mediaSize.height);
				}
			}

			this._drawLine(scope);

			if (!this._data || !this._data.crosshair) return;

			if (this._data.crosshair?.isHovered) {
				switch (this._data.crosshairOptions.type) {
					case CrosshairType.Cross:
					case CrosshairType.Dot:
					case CrosshairType.Demo:
						this._drawCrosshairLine(scope);
						this._drawIcon(scope, this._data.crosshair!);
				}
			}

			if (this._data.crosshairOptions.type == CrosshairType.Demo) {
				if (this._currentPoints) {
					this._drawDemonstration(
						scope,
						this._currentPoints.opacity,
						this._currentPoints.points(),
					);
				}
			}
		});
	}

	private _prepareState() {
		this._currentPoints = new PixelPoints(this._requestUpdate ?? (() => {}));
		this._strokes.push(this._currentPoints);
	}

	private _clearState() {
		if (this._currentPoints) {
			this._currentPoints.clear();
			this._currentPoints = null;
		}
	}

	private _drawDemonstration(
		scope: BitmapCoordinatesRenderingScope,
		opacity: number,
		points: Point[],
	) {
		const ctx = scope.context;

		try {
			const maxY = scope.bitmapSize.height;

			ctx.save();
			ctx.beginPath();

			points.forEach((p, i) => {
				const xCoord = this._chart?.timeScale().timeToCoordinate(p.time!);
				const yCoord = this._series?.priceToCoordinate(p.price!);

				if (xCoord === null || yCoord === null) return;

				const x = positionsLine(xCoord as number, scope.horizontalPixelRatio);
				const y = positionsLine(yCoord as number, scope.verticalPixelRatio);

				const py = Math.max(0, Math.min(y.position, maxY));

				if (i === 0) {
					ctx.moveTo(x.position, py);
				} else {
					ctx.lineTo(x.position, py);
				}
			});
			ctx.globalAlpha = opacity;
			ctx.strokeStyle = "orange";
			ctx.lineWidth = 60;
			ctx.lineJoin = "round";
			ctx.lineCap = "round";
			ctx.stroke();
			ctx.globalAlpha = 1;
		} finally {
			ctx.restore();
		}
	}

	private _drawHorizontalLine(
		scope: BitmapCoordinatesRenderingScope,
		data: {
			width: number;
			y: number;
		},
	) {
		if (!data || !this._data.crosshairOptions) return;

		const ctx = scope.context;
		try {
			const yPos = positionsLine(data.y, scope.verticalPixelRatio, data.width);
			const yCentre = yPos.position + yPos.length / 2;

			ctx.save();
			ctx.beginPath();
			ctx.lineWidth = 2;
			ctx.strokeStyle = this._data.crosshairOptions.horzLine?.color!;
			this.applyLineStyle(ctx, this._data.crosshairOptions.horzLine?.style!);
			ctx.moveTo(0, yCentre);
			ctx.lineTo(data.width * scope.horizontalPixelRatio, yCentre);
			ctx.stroke();
		} finally {
			ctx.restore();
		}
	}

	private _drawVerticalLine(
		scope: BitmapCoordinatesRenderingScope,
		data: { width: number; x: number },
	) {
		if (!data || !this._data.crosshairOptions) return;

		const ctx = scope.context;
		try {
			const xPos = positionsLine(data.x, scope.verticalPixelRatio, data.width);
			const xCentre = xPos.position + xPos.length / 2;

			ctx.save();
			ctx.beginPath();
			ctx.lineWidth = 2;
			ctx.strokeStyle = this._data.crosshairOptions.vertLine?.color!;

			this.applyLineStyle(ctx, this._data.crosshairOptions.horzLine?.style!);
			ctx.moveTo(xCentre, 0);
			ctx.lineTo(xCentre, data.width * scope.verticalPixelRatio);
			ctx.stroke();
		} finally {
			ctx.restore();
		}
	}

	private _fillPoints(paneHeight: number) {
		if (!this._currentPoints || !this._chart || !this._series) return;

		const data = this._data.crosshair!;
		const timeScale = this._chart.timeScale();

		const clampedX = Math.max(30, Math.min(data.x, timeScale.width()));
		const clampedY = Math.max(30, Math.min(data.y, paneHeight));

		const time = timeScale.coordinateToTime(clampedX);
		if (time === null) return;

		const price = this._series.coordinateToPrice(clampedY);
		if (price === null) return;

		this._currentPoints.setPoints(time, price);
	}

	private _drawCrosshairLine(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.options || !this._data.crosshair) return;

		if (this._data.crosshairOptions.horzLine?.visible) {
			this._drawHorizontalLine(scope, {
				width: scope.mediaSize.width,
				y: this._data.crosshair.y!,
			});
		}
		if (this._data.crosshairOptions.vertLine?.visible) {
			this._drawVerticalLine(scope, {
				width: scope.mediaSize.width,
				x: this._data.crosshair.x!,
			});
		}
	}

	private _drawLine(scope: BitmapCoordinatesRenderingScope) {
		for (let i = this._strokes.length - 1; i >= 0; i--) {
			const item = this._strokes[i];
			if (item === this._currentPoints) continue;
			if (item.opacity > 0) {
				this._drawDemonstration(scope, item.opacity, item.points());
			} else {
				this._strokes.splice(i, 1);
			}
		}
	}

	private _drawIcon(scope: BitmapCoordinatesRenderingScope, data: CrosshairRendererData) {
		if (!data || !this._data.options) return;

		const ctx = scope.context;
		try {
			ctx.save();
			ctx.beginPath();

			let size = 9;
			
			const maxY = scope.mediaSize.height;
			const clampedY = Math.max(size, Math.min(data.y, maxY));

			const yDimension = positionsLine(clampedY, scope.verticalPixelRatio);
			const xDimension = positionsLine(data.x, scope.horizontalPixelRatio);

			const x = xDimension.position - size * scope.horizontalPixelRatio;
			ctx.translate(x, yDimension.position - size * scope.verticalPixelRatio);
			ctx.scale(
				data.iconScaling * scope.horizontalPixelRatio,
				data.iconScaling * scope.verticalPixelRatio,
			);

			let fillColor = "#000000";
			let strokeColor = "white";

			if (this._data.crosshairOptions.anchor) {
				fillColor = this._data.crosshairOptions.anchor.color!;
				ctx.fillStyle = fillColor;

				strokeColor = this._data.crosshairOptions.anchor.strokeColor!;
				ctx.strokeStyle = strokeColor;
			}
			
			
			ctx.lineWidth = 1 / data.iconScaling; // keep stroke visually consistent after scaling

			switch (this._data.crosshairOptions.type) {
				case CrosshairType.Cross:
					{
						cross.forEach((path) => {
							ctx.beginPath();
							ctx.fill(path, "evenodd");
							ctx.stroke(path);
						});
					}
					break;
				case CrosshairType.Dot:
					{
						ctx.beginPath();
						ctx.arc(10, 10, 3, 0, Math.PI * 2);
						ctx.fill();
						ctx.stroke();
					}
					break;
				case CrosshairType.Demo: {
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

	private applyLineStyle(ctx: CanvasRenderingContext2D, style: LineStyle): void {
		switch (style) {
			case LineStyle.Solid:
				ctx.setLineDash([]);
				break;
			case LineStyle.Dotted:
				ctx.setLineDash([ctx.lineWidth, ctx.lineWidth]);
				break;
			case LineStyle.Dashed:
				ctx.setLineDash([2 * ctx.lineWidth, 2 * ctx.lineWidth]);
				break;
			case LineStyle.LargeDashed:
				ctx.setLineDash([6 * ctx.lineWidth, 6 * ctx.lineWidth]);
				break;
			case LineStyle.SparseDotted:
				ctx.setLineDash([ctx.lineWidth, 4 * ctx.lineWidth]);
				break;
			default:
				ctx.setLineDash([]);
				break;
		}
	}
}
