import { BitmapCoordinatesRenderingScope } from "fancy-canvas";

import { CrosshairType } from "../model/crosshair";
import { BitmapCoordinatesPaneRenderer } from "./bitmap-coordinates-pane-renderer";
import { LineStyle, LineWidth } from "./draw-line";

export const cross: Path2D[] = [
	new Path2D(
		"M11.084 1.084C11.084 0.53172 10.6363 0.0840001 10.084 0.0840001C9.5317 0.0840001 9.084 0.53172 9.084 1.084V9.084H1.084C0.53172 9.084 0.0840001 9.5317 0.0840001 10.084C0.0840001 10.6363 0.53172 11.084 1.084 11.084H9.084V19.084C9.084 19.6363 9.5317 20.084 10.084 20.084C10.6363 20.084 11.084 19.6363 11.084 19.084V11.084H19.084C19.6363 11.084 20.084 10.6363 20.084 10.084C20.084 9.5317 19.6363 9.084 19.084 9.084H11.084V1.084Z",
	),
];

export interface CrosshairLineStyle {
	lineStyle: LineStyle;
	lineWidth: LineWidth;
	color: string;
	visible: boolean;
}

export interface CrosshairAnchorRendererData {
	type?: CrosshairType;
	x: number;
	y: number;
	size: number;
	iconScaling: number;
	visible: boolean;
	anchor?: {
		color?: string;
		strokeColor?: string;
	};
}

export class CrosshairAnchorRenderer extends BitmapCoordinatesPaneRenderer {
	private readonly _data: CrosshairAnchorRendererData | null;

	public constructor(data: CrosshairAnchorRendererData | null) {
		super();
		this._data = data;
	}

	protected override _drawImpl({
		context: ctx,
		bitmapSize,
		horizontalPixelRatio,
		verticalPixelRatio,
	}: BitmapCoordinatesRenderingScope): void {
		if (this._data === null || !this._data.visible) {
			return;
		}

		try {
			ctx.save();
			ctx.beginPath();

			const x = Math.round((this._data.x - this._data.size) * horizontalPixelRatio);
			const y = Math.round((this._data.y - this._data.size) * verticalPixelRatio);

			ctx.translate(x, y);
			ctx.scale(
				this._data.iconScaling * horizontalPixelRatio,
				this._data.iconScaling * verticalPixelRatio,
			);

			let fillColor = "#000000";
			let strokeColor = "white";

			if (this._data.anchor) {
				fillColor = this._data.anchor.color!;
				ctx.fillStyle = fillColor;

				strokeColor = this._data.anchor.strokeColor!;
				ctx.strokeStyle = strokeColor;
			}

			ctx.lineWidth = 1 / this._data.iconScaling; // keep stroke visually consistent after scaling

			switch (this._data.type) {
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
}
