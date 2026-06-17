import {
	CanvasRenderingTarget2D,
	MediaCoordinatesRenderingScope,
	Size,
} from "fancy-canvas";

import { IPrimitivePaneRenderer } from "../../model/ipane-primitive";

import { ImageWatermarkOptions } from "./options";

export interface Placement {
	x: number;
	y: number;
	height: number;
	width: number;
}

export interface ImageWatermarkRendererOptions extends ImageWatermarkOptions {
	imgElement: HTMLImageElement | null;
	imgWidth: number;
	imgHeight: number;
}

export class ImageWatermarkRenderer implements IPrimitivePaneRenderer {
	private _data: ImageWatermarkRendererOptions;

	public constructor(data: ImageWatermarkRendererOptions) {
		this._data = data;
	}

	public draw(target: CanvasRenderingTarget2D): void {
		target.useMediaCoordinateSpace((scope: MediaCoordinatesRenderingScope) => {
			const ctx = scope.context;
			const pos = this._determinePlacement(this._data, scope.mediaSize);
			if (!pos || !this._data.imgElement) {
				return;
			}
			ctx.globalAlpha = this._data.alpha ?? 1;
			ctx.drawImage(this._data.imgElement, pos.x, pos.y, pos.width, pos.height);
		});
	}

	private _determinePlacement(
		data: ImageWatermarkRendererOptions,
		paneSize: Size,
	): Placement | null {
		const { maxHeight, maxWidth, imgHeight, imgWidth, padding, position } = data;

		const paddingSize = padding ?? 0;
		let availableWidth = paneSize.width - 2 * paddingSize;
		let availableHeight = paneSize.height - 2 * paddingSize;

		if (maxHeight) {
			availableHeight = Math.min(availableHeight, maxHeight);
		}
		if (maxWidth) {
			availableWidth = Math.min(availableWidth, maxWidth);
		}

		const scaleX = availableWidth / imgWidth;
		const scaleY = availableHeight / imgHeight;
		const scaleToUse = Math.min(scaleX, scaleY);

		const drawWidth = imgWidth * scaleToUse;
		const drawHeight = imgHeight * scaleToUse;

		let x: number;
		let y: number;

		const pos = position ?? "center";
		switch (pos) {
			case "top-left":
				x = paddingSize;
				y = paddingSize;
				break;
			case "top-right":
				x = paneSize.width - paddingSize - drawWidth;
				y = paddingSize;
				break;
			case "bottom-left":
				x = paddingSize;
				y = paneSize.height - paddingSize - drawHeight;
				break;
			case "bottom-right":
				x = paneSize.width - paddingSize - drawWidth;
				y = paneSize.height - paddingSize - drawHeight;
				break;
			case "center":
			default: {
				const plotCentreX = Math.round(paneSize.width / 2);
				const plotCentreY = Math.round(paneSize.height / 2);
				x = plotCentreX - 0.5 * drawWidth;
				y = plotCentreY - 0.5 * drawHeight;
				break;
			}
		}

		return {
			x,
			y,
			height: drawHeight,
			width: drawWidth,
		};
	}
}
