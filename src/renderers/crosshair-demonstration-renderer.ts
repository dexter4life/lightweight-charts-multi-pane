import { BitmapCoordinatesRenderingScope } from "fancy-canvas";

import { IChartModelBase } from "../model/chart-model";
import { Pane } from "../model/pane";
import { TimePointIndex } from "../model/time-data";
import { BitmapCoordinatesPaneRenderer } from "./bitmap-coordinates-pane-renderer";

export interface CrosshairDemonstrationRendererData {
	visible: boolean;
	mouseEnter: boolean;
	mouseDown: boolean;
	altKeyDown: boolean;
	size: number;
	iconScaling: number;
	price: number;
	index: TimePointIndex;
}

export class CrosshairDemonstrationRenderer extends BitmapCoordinatesPaneRenderer {
	private readonly _data: CrosshairDemonstrationRendererData | null;
	private readonly _pane: Pane;
	private readonly _chartModel: IChartModelBase;

	public constructor(
		model: IChartModelBase,
		pane: Pane,
		data: CrosshairDemonstrationRendererData | null,
	) {
		super();
		this._data = data;
		this._chartModel = model;
		this._pane = pane;
	}

	protected override _drawImpl({
		context: ctx,
		bitmapSize,
		horizontalPixelRatio,
		verticalPixelRatio,
	}: BitmapCoordinatesRenderingScope): void {
		if (this._data === null) {
			return;
		}
		

		const priceScale = this._pane.defaultPriceScale();
		const firstValue = priceScale.firstValue();
		const timeScale = this._chartModel.timeScale();
		const strokes = this._chartModel.crosshairSource().pixelPoints();

		for (const stroke of strokes) {
			if (stroke.opacity <= 0) {
				continue;
			}

			const strokePoints = stroke.points();
			if (strokePoints.length === 0) {
				continue;
			}

			try {
				ctx.save();
				ctx.beginPath();

				strokePoints.forEach((p, i) => {
					const x = timeScale.indexToCoordinate(p.time!) * horizontalPixelRatio;
					const y =
						priceScale.priceToCoordinate(p.price!, firstValue!) * verticalPixelRatio;

					if (i === 0) {
						ctx.moveTo(x, y);
					} else {
						ctx.lineTo(x, y);
					}
				});

				ctx.globalAlpha = stroke.opacity;
				ctx.strokeStyle = "orange";
				ctx.lineWidth = 60;
				ctx.lineJoin = "round";
				ctx.lineCap = "round";
				ctx.stroke();
			} finally {
				ctx.restore();
			}
		}
	}
}
