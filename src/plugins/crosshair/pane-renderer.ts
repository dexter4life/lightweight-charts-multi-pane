import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from "fancy-canvas";
import { IChartApi } from "../../api/create-chart";
import { ISeriesApi } from "../../api/iseries-api";
import { positionsLine } from "../../helpers/dimensions/positions";
import { BarPrice } from "../../model/bar";
import { Time } from "../../model/horz-scale-behavior-time/types";
import { SeriesType } from "../../model/series-options";
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
}
