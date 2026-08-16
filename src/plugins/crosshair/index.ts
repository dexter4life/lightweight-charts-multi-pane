import { IChartApi } from "../../api/create-chart";
import type { MouseEventParams } from "../../api/ichart-api";
import { ISeriesApi } from "../../api/iseries-api";
import {
	ISeriesPrimitive,
	SeriesAttachedParameter,
} from "../../api/iseries-primitive-api";
import { ChartOptionsImpl } from "../../model/chart-model";
import { Time } from "../../model/horz-scale-behavior-time/types";
import { IPrimitivePaneView, PrimitiveHoveredItem } from "../../model/ipane-primitive";
import { SeriesType } from "../../model/series-options";
import { KeyboardHandlers } from "../crosshair/keyboard";
import type { PartialOptions } from "../shared/partial-options";
import { cross } from "./constants";
import { IRendererData } from "./irenderer-data";
import { MouseHandlers, MousePosition } from "./mouse";
import { CrosshairPaneView } from "./pane-view";
import { CrosshairPluginOptions, CrosshairState, CrosshairType } from "./state";

export class Crosshair extends CrosshairState implements ISeriesPrimitive<Time> {
	private _chart: IChartApi | undefined = undefined;
	private _series: ISeriesApi<SeriesType> | undefined = undefined;
	private _mouseHandlers: MouseHandlers;
	private _keyboardHandlers: KeyboardHandlers;
	private _lastMouseUpdate: MousePosition | null = null;
	private _options: Readonly<ChartOptionsImpl<Time>> | undefined;

	private _paneViews: CrosshairPaneView[] = [];
	private _timePaneViews: CrosshairPaneView[] = [];

	private _hasFocus: boolean = false;
	private _hovered: boolean = false;
	private _mouseDown: boolean = false;
	private _altKeyPressed: boolean = false;

	// Bound handler for subscribeCrosshairMove so we can unsubscribe later.
	private _onCrosshairMove: (param: MouseEventParams) => void;
	private _crosshairOptions: PartialOptions<CrosshairPluginOptions> = {
		vertLine: {
			visible: true,
		},
		horzLine: {
			visible: true,
		},
	};

	constructor(options?: PartialOptions<CrosshairPluginOptions>) {
		super();
		this._options = this._chart?.options();
		this._mouseHandlers = new MouseHandlers();
		this._keyboardHandlers = new KeyboardHandlers();
		this._crosshairOptions = options!;
		this._onCrosshairMove = this._handleCrosshairMove.bind(this);
	}

	attached({ chart, series, requestUpdate }: SeriesAttachedParameter<Time>) {
		// Guard against re-entry: clean up previous attachment before re-initializing
		if (this._chart) {
			this.detached();
		}
		this._chart = chart;
		this._series = series;
		this._options = this._chart.options();
		this._paneViews = [new CrosshairPaneView(false, chart, this._series, requestUpdate)];
		this._timePaneViews = [new CrosshairPaneView(true)];
		this._mouseHandlers.attached(chart, series);
		this._keyboardHandlers.attached(chart, series);
		// Post-arbitration cursor override. The library applies its hit-test
		// winner's cursorStyle (via ChartWidget.setCursorStyle) BEFORE firing
		// the crosshairMoved event, so this handler runs after the library
		// has already set the cursor. We only override on empty chart space
		// to hide the OS cursor for Cross/Dot modes (custom icon draws on
		// top). When something interactive is hovered (drawing, series,
		// marker, price alert) we leave the library's cursor untouched so
		// the pointer hand shows like TradingView.com.
		chart.subscribeCrosshairMove(this._onCrosshairMove);
		this._mouseHandlers.mouseMoved().subscribe((mouseEvent) => {
			if (!mouseEvent) {
				this._lastMouseUpdate = null;
				this._hovered = false;
				requestUpdate();
				return;
			}

			this._hovered = true;
			this._lastMouseUpdate = mouseEvent.position;

			requestUpdate();
		}, this);

		this._mouseHandlers.mouseLeave().subscribe((mouseEvent) => {
			if (!mouseEvent) {
				this._hovered = false;
				requestUpdate();
			}
			this._updateFocus();
		});

		this._mouseHandlers.mouseDown().subscribe((mouseEvent) => {
			if (mouseEvent) {
				this._mouseDown = true;
				// Re-evaluate drag-prevention now that the mouse is down.
				this._mouseHandlers._setKeyState(this._mouseDown && this._altKeyPressed);
				this._updateFocus();
			}
		});

		this._mouseHandlers.mouseUp().subscribe((mouseEvent) => {
			if (mouseEvent) {
				this._mouseDown = false;
				// Immediately clear drag-prevention for this chart.
				this._mouseHandlers._setKeyState(false);
				this._updateFocus();
			}
		});

		this._keyboardHandlers.keydown().subscribe((data) => {
			this._altKeyPressed = data?.altKey!;
			// Only gate drag-prevention for this chart when the mouse is
			// pressed down on it AND Alt is held — so other charts are
			// unaffected.
			this._mouseHandlers._setKeyState(this._mouseDown && this._altKeyPressed);
			this._updateFocus();
		});

		this._keyboardHandlers.keyup().subscribe((data) => {
			this._altKeyPressed = data?.altKey!;
			this._mouseHandlers._setKeyState(this._mouseDown && this._altKeyPressed);
			this._updateFocus();
		});
	}

	/**
	 * Focus the chart element only when the mouse is down AND Alt is pressed;
	 * blur it only when both are released. Either state alone is a no-op so
	 * the user can hold one while toggling the other without losing focus.
	 */
	private _updateFocus(): void {
		if (!this._chart) return;
		const element = this._chart.chartElement() as HTMLDivElement | null;
		if (!element) return;

		const shouldFocus = this._mouseDown && this._altKeyPressed;
		const shouldBlur = !this._mouseDown && !this._altKeyPressed;

		if (shouldFocus && !this._hasFocus) {
			element.setAttribute("tabindex", "0");
			element.focus();
			this._hasFocus = true;
		} else if (shouldBlur && this._hasFocus) {
			element.blur();
			element.removeAttribute("tabindex");
			this._hasFocus = false;
		}
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
		switch (this._crosshairOptions.type) {
			case CrosshairType.Cross:
				crosshair = cross;
				break;
		}

		return {
			crosshair: {
				y: mousePosition?.y!,
				x: mousePosition?.x!,
				mouseDown: this._mouseDown,
				text,
				isHovered: this._hovered,
				icon: crosshair,
				iconScaling: 0.9,
			},
			hasFocus: this._hasFocus,
			altKeyPressed: this._altKeyPressed,
			options: this._options,
			crosshairOptions: this._crosshairOptions,
		};
	}

	detached() {
		this._mouseHandlers.mouseMoved().unsubscribeAll(this);
		this._mouseHandlers.detached();
		this._keyboardHandlers.keydown().unsubscribeAll(this);
		this._keyboardHandlers.keyup().unsubscribeAll(this);

		this._keyboardHandlers.detached();
		if (this._chart) {
			this._chart.unsubscribeCrosshairMove(this._onCrosshairMove);
			// Clear any cursor override we applied so the element reverts to
			// its default cursor after detach.
			const element = this._chart.chartElement() as HTMLDivElement | null;
			element?.style.removeProperty('cursor');
		}
		this._series = undefined;
		this._hasFocus = false;
	}

	paneViews(): readonly IPrimitivePaneView[] {
		return this._paneViews;
	}

	timeAxisPaneViews(): readonly IPrimitivePaneView[] {
		return this._timePaneViews;
	}

	hitTest(): PrimitiveHoveredItem | null {
		// The crosshair yields hit-test arbitration so drawings, indicators,
		// markers, and built-in series can win and apply their own cursorStyle
		// (e.g. "pointer"). Returning null removes the crosshair from cursor
		// arbitration entirely. The custom crosshair icon is still rendered on
		// top because paneViews().zOrder() (rendering z-order) is independent of
		// this hit-test z-order. OS cursor hiding for Cross/Dot modes on empty
		// space is handled by the _handleCrosshairMove post-arbitration override.
		return null;
	}

	/**
	 * Post-arbitration cursor override, called via subscribeCrosshairMove AFTER
	 * the library has applied the hit-test winner's cursorStyle. We only write
	 * the cursor when nothing interactive is hovered (empty chart space), so we
	 * never fight the library's pointer-on-hover behavior. For Cross/Dot modes
	 * we hide the OS cursor (the custom icon draws on top); for Arrow/Demo we
	 * keep the native arrow.
	 */
	private _handleCrosshairMove(param: MouseEventParams): void {
		if (!this._chart) return;
		const element = this._chart.chartElement() as HTMLDivElement | null;
		if (!element) return;

		// Mouse left the chart: clear any override so the default cursor returns.
		if (param.point === undefined) {
			element.style.removeProperty('cursor');
			return;
		}

		// Something interactive is hovered (series, drawing, marker, primitive).
		// The library already set the winner's cursorStyle (e.g. "pointer").
		// Leave it untouched.
		if (param.hoveredInfo !== undefined) {
			return;
		}

		// Empty chart space: apply the crosshair mode's cursor.
		const type = this._crosshairOptions?.type;
		switch (type) {
			case CrosshairType.Cross:
			case CrosshairType.Dot:
				element.style.setProperty('cursor', 'none');
				break;
			case CrosshairType.Arrow:
			case CrosshairType.Demo:
				element.style.setProperty('cursor', 'auto');
				break;
			default:
				element.style.removeProperty('cursor');
				break;
		}
	}

	applyOptions(options: PartialOptions<CrosshairPluginOptions>) {
		this._crosshairOptions = options;
	}
}
