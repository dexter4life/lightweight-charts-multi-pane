import { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from "fancy-canvas";
import { positionsLine } from "../../helpers/dimensions/positions";
import { crossPath } from "./constants";
import { PaneRendererBase } from "./renderer-base";

export class PaneRenderer extends PaneRendererBase {
	draw(target: CanvasRenderingTarget2D): void {
		target.useBitmapCoordinateSpace((scope) => {
			this._drawAlertLines(scope);
			this._drawAlertIcons(scope);

			const hasRemoveHover = this._data.alerts.some(
				(alert) => alert.showHover && alert.hoverRemove,
			);

			if (!hasRemoveHover) {
				this._drawCrosshairLabelButton(scope);
			}
			this._drawAlertLabel(scope);
		});
	}

	_drawHorizontalLine(
		scope: BitmapCoordinatesRenderingScope,
		data: {
			width: number;
			lineWidth: number;
			color: string;
			y: number;
		},
	) {
		const ctx = scope.context;
		try {
			const yPos = positionsLine(data.y, scope.verticalPixelRatio, data.lineWidth);
			const yCentre = yPos.position + yPos.length / 2;

			ctx.save();
			ctx.beginPath();
			ctx.lineWidth = data.lineWidth;
			ctx.strokeStyle = data.color;
			const dash = this._data.options.line.dashLength * scope.horizontalPixelRatio;
			ctx.setLineDash([dash, dash]);
			ctx.moveTo(0, yCentre);
			ctx.lineTo(
				(data.width - this._data.options.crosshairButton.width) *
					scope.horizontalPixelRatio,
				yCentre,
			);
			ctx.stroke();
		} finally {
			ctx.restore();
		}
	}

	_drawAlertLines(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.alerts.length) return;
		const color = this._data.color;

		this._data.alerts.forEach((alertData) => {
			this._drawHorizontalLine(scope, {
				width: alertData.selected ? scope.mediaSize.width + 50 : scope.mediaSize.width,
				lineWidth: alertData.selected
					? this._data.options.line.selectedWidth
					: this._data.options.line.unselectedWidth,
				color,
				y: alertData.y,
			});
		});
	}

	_drawAlertIcons(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.alerts.length) return;
		const color = this._data.color;
		this._data.alerts.forEach((alert) => {
			if (!alert.selected) {
				this._drawRightArrow(scope, {
					y: alert.y,
					color,
				});
			}
		});
	}

	_drawRightArrow(
		scope: BitmapCoordinatesRenderingScope,
		data: {
			y: number;
			color: string;
		},
	) {
		const ctx = scope.context;
		const labelOpts = this._data.options.label;
		const cbOpts = this._data.options.crosshairButton;
		try {
			ctx.save();
			const yDimension = positionsLine(
				data.y,
				scope.verticalPixelRatio,
				labelOpts.height,
			);
			const x = (scope.mediaSize.width - (cbOpts.width + 1)) * scope.horizontalPixelRatio;

			ctx.beginPath();

			// right arrow
			const arrowSize = labelOpts.iconSize;
			const scale = arrowSize / labelOpts.iconViewBoxSize;
			const cx =
				x +
				labelOpts.iconPaddingLeft * scope.horizontalPixelRatio +
				(arrowSize * scale * scope.horizontalPixelRatio) / 2;
			const cy =
				yDimension.position +
				labelOpts.iconPaddingAlertTop * scope.verticalPixelRatio +
				(arrowSize * scale * scope.verticalPixelRatio) / 2;
			const halfW = (arrowSize * scale * scope.horizontalPixelRatio) / 2;
			const halfH = (arrowSize * scale * scope.verticalPixelRatio) / 2;

			ctx.beginPath();
			ctx.moveTo(cx - halfW, cy - halfH);
			ctx.lineTo(cx + halfW, cy);
			ctx.lineTo(cx - halfW, cy + halfH);
			ctx.closePath();
			ctx.fillStyle = this._data.options.line.color;
			ctx.fill();
		} finally {
			ctx.restore();
		}
	}

	_calculateLabelWidth(textLength: number) {
		const opts = this._data.options.centreLabel;
		return (
			opts.inlinePadding * 2 + opts.removeButtonWidth + textLength * opts.averageCharWidth
		);
	}

	_drawAlertLabel(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.alerts.length) return;
		const ctx = scope.context;
		const activeLabel = this._data.alerts.find(
			(alert) => alert.showHover || alert.selected,
		);
		if (!activeLabel || !activeLabel.text) return;
		const hasRemoveButton = "hoverRemove" in activeLabel;
		const opts = this._data.options;
		const centreOpts = opts.centreLabel;
		const labelWidth = this._calculateLabelWidth(activeLabel.text.length);
		const labelXDimensions = positionsLine(
			scope.mediaSize.width / 2,
			scope.horizontalPixelRatio,
			labelWidth,
		);
		const yDimensions = positionsLine(
			activeLabel.y,
			scope.verticalPixelRatio,
			centreOpts.height,
		);

		ctx.save();
		try {
			const radius = centreOpts.borderRadius * scope.horizontalPixelRatio;
			// draw main body background of label
			ctx.beginPath();
			ctx.roundRect(
				labelXDimensions.position,
				yDimensions.position,
				labelXDimensions.length,
				yDimensions.length,
				radius,
			);
			ctx.fillStyle = centreOpts.backgroundColor;
			ctx.fill();

			const removeButtonStartX =
				labelXDimensions.position +
				labelXDimensions.length -
				centreOpts.removeButtonWidth * scope.horizontalPixelRatio;

			if (hasRemoveButton && activeLabel.hoverRemove) {
				// draw hover background for remove button
				ctx.beginPath();
				ctx.roundRect(
					removeButtonStartX,
					yDimensions.position,
					centreOpts.removeButtonWidth * scope.horizontalPixelRatio,
					yDimensions.length,
					[0, radius, radius, 0],
				);
				ctx.fillStyle = centreOpts.removeHoverBackground;
				ctx.fill();
			}

			// draw button divider
			ctx.beginPath();
			const dividerDimensions = positionsLine(
				removeButtonStartX / scope.horizontalPixelRatio,
				scope.horizontalPixelRatio,
				centreOpts.borderWidth,
			);
			ctx.fillStyle = centreOpts.dividerColor;
			ctx.fillRect(
				dividerDimensions.position,
				yDimensions.position,
				dividerDimensions.length,
				yDimensions.length,
			);

			// draw stroke for main body
			ctx.beginPath();
			ctx.roundRect(
				labelXDimensions.position,
				yDimensions.position,
				labelXDimensions.length,
				yDimensions.length,
				radius,
			);
			ctx.strokeStyle = centreOpts.borderColor;
			ctx.lineWidth = centreOpts.borderWidth * scope.horizontalPixelRatio;
			ctx.stroke();

			// write text
			ctx.beginPath();
			ctx.fillStyle = centreOpts.fontColor;
			ctx.textBaseline = "middle";
			ctx.font = `${Math.round(centreOpts.fontSize * scope.verticalPixelRatio)}px ${centreOpts.fontFamily}`;
			ctx.fillText(
				activeLabel.text,
				labelXDimensions.position + centreOpts.inlinePadding * scope.horizontalPixelRatio,
				activeLabel.y * scope.verticalPixelRatio,
			);

			// draw button icon
			ctx.beginPath();
			const removeIconSize = centreOpts.removeIconSize;
			ctx.translate(
				removeButtonStartX +
					(scope.horizontalPixelRatio * (centreOpts.removeButtonWidth - removeIconSize)) /
						2,
				(activeLabel.y - centreOpts.removeIconYOffset) * scope.verticalPixelRatio,
			);
			const scaling =
				(removeIconSize / centreOpts.removeIconViewBoxSize) * scope.horizontalPixelRatio;
			ctx.scale(scaling, scaling);
			ctx.fillStyle = centreOpts.fontColor;
			ctx.fill(crossPath, "evenodd");
		} finally {
			ctx.restore();
		}
	}

	_drawCrosshairLabelButton(scope: BitmapCoordinatesRenderingScope) {
		if (!this._data.button || !this._data.crosshair) return;
		const cbOpts = this._data.options.crosshairButton;
		const labelOpts = this._data.options.label;
		this._drawLabel(scope, {
			width: scope.mediaSize.width,
			labelHeight: cbOpts.height,
			y: this._data.crosshair.y,
			roundedCorners: cbOpts.borderRadius,
			icon: this._data.button.crosshairLabelIcon,
			iconScaling: labelOpts.iconSize / cbOpts.iconViewBoxSize,
			padding: {
				left: cbOpts.iconPadding,
				top: cbOpts.iconPadding,
			},
			color: this._data.button.hovering ? this._data.button.hoverColor : this._data.color,
		});
	}

	_drawLabel(
		scope: BitmapCoordinatesRenderingScope,
		data: {
			width: number;
			labelHeight: number;
			y: number;
			roundedCorners: number | number[];
			icon: Path2D[];
			color: string;
			padding: {
				top: number;
				left: number;
			};
			iconScaling: number;
		},
	) {
		const ctx = scope.context;
		try {
			ctx.save();
			ctx.beginPath();
			const yDimension = positionsLine(
				data.y,
				scope.verticalPixelRatio,
				data.labelHeight,
			);
			const cbOpts = this._data.options.crosshairButton;
			const x = (data.width - (cbOpts.width + 1)) * scope.horizontalPixelRatio;
			ctx.roundRect(
				x,
				yDimension.position,
				cbOpts.width * scope.horizontalPixelRatio,
				yDimension.length,
				adjustRadius(data.roundedCorners, scope.horizontalPixelRatio),
			);
			ctx.fillStyle = data.color;
			ctx.fill();
			ctx.beginPath();
			ctx.translate(
				x + data.padding.left * scope.horizontalPixelRatio,
				yDimension.position + data.padding.top * scope.verticalPixelRatio,
			);
			ctx.scale(
				data.iconScaling * scope.horizontalPixelRatio,
				data.iconScaling * scope.verticalPixelRatio,
			);
			ctx.fillStyle = this._data.options.label.fontColor;
			data.icon.forEach((path) => {
				ctx.beginPath();
				ctx.fill(path, "evenodd");
			});
		} finally {
			ctx.restore();
		}
	}
}

function adjustRadius<T extends number | number[]>(radius: T, pixelRatio: number): T {
	if (typeof radius === "number") {
		return (radius * pixelRatio) as T;
	}
	return radius.map((i) => i * pixelRatio) as T;
}
