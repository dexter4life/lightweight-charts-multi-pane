import { IChartApi } from "../../api/create-chart";
import { ISeriesApi } from "../../api/iseries-api";
import {
	ISeriesPrimitive,
	SeriesAttachedParameter,
} from "../../api/iseries-primitive-api";
import { Time } from "../../model/horz-scale-behavior-time/types";
import { IPrimitivePaneView, PrimitiveHoveredItem } from "../../model/ipane-primitive";
import { SeriesType } from "../../model/series-options";
import { cross, CrosshairOptions, CrosshairType, PartialOptions } from "./constants";
import { IRendererData } from "./irenderer-data";
import { MouseHandlers, MousePosition } from "./mouse";
import { CrosshairPaneView } from "./pane-view";
import { CrosshairState } from "./state";

export class Crosshair extends CrosshairState implements ISeriesPrimitive<Time> {
	private _chart: IChartApi | undefined = undefined;
	private _series: ISeriesApi<SeriesType> | undefined = undefined;
	private _mouseHandlers: MouseHandlers;
	private _lastMouseUpdate: MousePosition | null = null;

	private _paneViews: CrosshairPaneView[] = [];
	private _timePaneViews: CrosshairPaneView[] = [];
	private _currentCursor: string | null = null;
	private _hovered: boolean = false;

	private _options: CrosshairOptions;

	/** Get the current options. */
	get options(): CrosshairOptions {
		return this._options;
	}

	/** Color used for alert lines, the alert icon button, and the crosshair line. */
	get color(): string {
		return this._options.line.color;
	}

	/** Set the color used for alert lines, the alert icon button, and the crosshair line. */
	setColor(color: string): void {
		this.applyOptions({ line: { color } });
	}

	/** Merge partial options into the current options and request a re-render. */
	applyOptions(partial: PartialOptions<CrosshairOptions>): void {
		this._options = {
			crossType: this.options.crossType,
			line: { ...this._options.line, ...partial.line },
			size: this._options.size,
			priceScaleLabel: { ...this._options.priceScaleLabel, ...partial.priceScaleLabel },
		};
	}

	constructor(options?: PartialOptions<CrosshairOptions>) {
		super();
		this._options = {
			crossType: options?.crossType!,
			line: { color: "red", dashLength: 4 },
			size: 5,
			priceScaleLabel: {
				height: 24,
				borderRadius: 4,
				rightInset: 60,
				textLeftPadding: 8,
				fontSize: 12,
				fontFamily: "sans-serif",
				textColor: "#ffffff",
			},
		};
		this._mouseHandlers = new MouseHandlers();
	}

	attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
		// Guard against re-entry: clean up previous attachment before re-initializing
		if (this._chart) {
			this.detached();
		}
		this._chart = chart;
		this._series = series;
		this._paneViews = [new CrosshairPaneView(false)];
		this._timePaneViews = [new CrosshairPaneView(true)];
		this._mouseHandlers.attached(chart, series);
		this._mouseHandlers.mouseMoved().subscribe((mouseEvent) => {
			if (!mouseEvent) {
				this._lastMouseUpdate = null;
				this._currentCursor = null;
				this._hovered = false;
				requestUpdate();
				return;
			}
			this._hovered = true;
			if (this._options.crossType != CrosshairType.ARROW) {
				this._lastMouseUpdate = mouseEvent.position;
				this._currentCursor = "none"; // hide OS cursor, crosshair icon replaces it
			}

			requestUpdate();
		}, this);

		this._mouseHandlers.mouseLeave().subscribe((mouseEvent) => {
			if (!mouseEvent) {
				this._hovered = false;
				requestUpdate();
			}
		});
	}

	updateAllViews(): void {
		const rendererData = this._calculateRendererData(this._lastMouseUpdate);

		if (rendererData) {
			this._paneViews.forEach((pv) => pv.update(rendererData));
			this._timePaneViews.forEach((pv) => pv.update(rendererData));
		}
	}

	/**
	 * We are calculating this here instead of within a view
	 * because the data is identical for both Renderers so lets
	 * rather calculate it once here.
	 */
	_calculateRendererData(mousePosition: MousePosition | null): IRendererData | null {
		if (!mousePosition || !this._chart) return null;

		const localization = this._chart.options().localization;
		const time = this._chart.timeScale().coordinateToTime(mousePosition.x);

		let text = "";
		if (time !== null) {
			if (typeof time === "number") {
				text = new Date(time * 1000).toLocaleString(localization.locale, {
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				});
			} else {
				text = String(time);
			}
		}

		let crosshair = null;
		switch (this._options.crossType) {
			case CrosshairType.CROSS:
				crosshair = cross;
				break;
		}

		return {
			crosshair: {
				y: mousePosition?.y!,
				x: mousePosition?.x!,
				text,
				isHovered: this._hovered,
				icon: crosshair,
				crossType: this._options.crossType,
				iconScaling: 0.9,
				size: this._options.size,
			},
			strokeColor: "white",

			color: this._options.line.color,
			options: this._options,
		};
	}

	detached() {
		this._mouseHandlers.mouseMoved().unsubscribeAll(this);
		this._mouseHandlers.detached();
		this._series = undefined;
		this._currentCursor = null; // restore OS cursor when plugin detaches
	}

	paneViews(): readonly IPrimitivePaneView[] {
		return this._paneViews;
	}

	timeAxisPaneViews(): readonly IPrimitivePaneView[] {
		return this._timePaneViews;
	}

	hitTest(): PrimitiveHoveredItem | null {
		if (!this._currentCursor) return null;
		return {
			cursorStyle: this._currentCursor,
			externalId: "user-alerts-primitive",
			zOrder: "top",
		};
	}

	setSymbolName(name: string) {
		// this._symbolName = name;
	}
}
