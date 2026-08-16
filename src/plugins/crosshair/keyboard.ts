import { IChartApi } from "../../api/create-chart";
import { ISeriesApi } from "../../api/iseries-api";
import { Delegate } from "../../helpers/delegate";
import { SeriesType } from "../../model/series-options";

type UnSubscriber = () => void;

export interface KeyboardEventData {
	altKey: boolean;
}

export class KeyboardHandlers {
	_chart: IChartApi | undefined = undefined;
	_series: ISeriesApi<SeriesType> | undefined = undefined;
	_unSubscribers: UnSubscriber[] = [];

	private _keyDown: Delegate<KeyboardEventData | null> = new Delegate();
	private _keyUp: Delegate<KeyboardEventData | null> = new Delegate();

	attached(chart: IChartApi, series: ISeriesApi<SeriesType>) {
		if (this._chart) {
			this.detached();
		}
		this._chart = chart;
		this._series = series;
		// Listen on window so Alt is detected regardless of whether the chart
		// element has focus. Drag-prevention is gated per-chart in the plugin.
		this._addKeyboardEventListener(window, "keydown", this._keydown);
		this._addKeyboardEventListener(window, "keyup", this._keyup);
	}

	detached() {
		this._series = undefined;
		this._unSubscribers.forEach((unSub) => {
			unSub();
		});
		this._unSubscribers = [];
	}

	private _addKeyboardEventListener(
		target: HTMLElement | Window,
		eventType: "keydown" | "keyup" | "keypress",
		handler: (event: KeyboardEvent) => void,
	) {
		const boundKeyHandler = handler.bind(this) as EventListener;

		target.addEventListener(eventType, boundKeyHandler);
		const unSubscriber = () => {
			target.removeEventListener(eventType, boundKeyHandler);
		};

		this._unSubscribers.push(unSubscriber);
	}

	private _keydown(event: KeyboardEvent) {
		this._keyDown.fire({ altKey: event.altKey });
	}

	private _keyup(event: KeyboardEvent) {
		this._keyUp.fire({ altKey: event.altKey });
	}

	keyup() {
		return this._keyUp;
	}

	keydown() {
		return this._keyDown;
	}
}
