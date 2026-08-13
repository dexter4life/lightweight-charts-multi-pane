import { IChartApi } from '../../api/create-chart';
import { ISeriesApi } from '../../api/iseries-api';
import { Delegate, ISubscription } from '../../helpers/price-delegate';
import { SeriesType } from '../../model/series-options';

export interface MousePosition {
	x: number;
	y: number;
	xPositionRelativeToPriceScale: number;
	overPriceScale: boolean;
	overTimeScale: boolean;
}

/** MousePosition bundled with the raw DOM event so consumers can call preventDefault(). */
export interface MousePositionEvent {
	position: MousePosition;
	event: MouseEvent;
}

type UnSubscriber = () => void;

/**
 * We are using our own mouse listeners on the container because
 * we need to know the mouse position when over the price scale
 * (in addition to the chart pane)
 */

export class MouseHandlers {
	_chart: IChartApi | undefined = undefined;
	_series: ISeriesApi<SeriesType> | undefined = undefined;
	_unSubscribers: UnSubscriber[] = [];

	private _clicked: Delegate<MousePosition | null> = new Delegate();
	private _mouseMoved: Delegate<MousePositionEvent | null> = new Delegate();
	private _mouseDown: Delegate<MousePositionEvent | null> = new Delegate();
	private _mouseUp: Delegate<MousePositionEvent | null> = new Delegate();

	attached(chart: IChartApi, series: ISeriesApi<SeriesType>) {
		// Guard against re-entry: clean up previous listeners before re-adding
		if (this._chart) {
			this.detached();
		}
		this._chart = chart;
		this._series = series;
		const container = this._chart.chartElement();
		this._addMouseEventListener(
			container,
			'mouseleave',
			this._mouseLeave
		);
		this._addMouseEventListener(
			container,
			'mousemove',
			this._mouseMove
		);
		this._addMouseEventListener(
			container,
			'click',
			this._mouseClick
		);
		this._addMouseEventListener(
			container,
			'mousedown',
			this._mouseDownHandler
		);
		this._addMouseEventListener(
			container,
			'mouseup',
			this._mouseUpHandler
		);
	}

	detached() {
		this._series = undefined;
        this._clicked.destroy();
        this._mouseMoved.destroy();
        this._mouseDown.destroy();
        this._mouseUp.destroy();
		this._unSubscribers.forEach(unSub => {
			unSub();
		});
		this._unSubscribers = [];
	}

	public clicked(): ISubscription<MousePosition | null> {
		return this._clicked;
	}

	public mouseMoved(): ISubscription<MousePositionEvent | null> {
		return this._mouseMoved;
	}

	public mouseDown(): ISubscription<MousePositionEvent | null> {
		return this._mouseDown;
	}

	public mouseUp(): ISubscription<MousePositionEvent | null> {
		return this._mouseUp;
	}

	_addMouseEventListener(
		target: HTMLDivElement,
		eventType: 'mouseleave' | 'mousemove' | 'click' | 'mousedown' | 'mouseup',
		handler: (event: MouseEvent) => void
	): void {
		const boundMouseMoveHandler = handler.bind(this);
		// Capture phase lets us intercept events before they reach the chart's
		// internal canvas handler, so we can stop propagation during a drag
		// and prevent the chart from panning simultaneously.
		target.addEventListener(eventType, boundMouseMoveHandler, { capture: true });
		const unSubscriber = () => {
			target.removeEventListener(eventType, boundMouseMoveHandler, { capture: true });
		};
		this._unSubscribers.push(unSubscriber);
	}

	_mouseLeave() {
		this._mouseMoved.fire(null);
	}
	_mouseMove(event: MouseEvent) {
		const position = this._determineMousePosition(event);
		if (position) {
			this._mouseMoved.fire({ position, event });
		} else {
			this._mouseMoved.fire(null);
		}
	}
	_mouseClick(event: MouseEvent) {
		this._clicked.fire(this._determineMousePosition(event));
	}

	_mouseDownHandler(event: MouseEvent) {
		const position = this._determineMousePosition(event);
		if (position) {
			this._mouseDown.fire({ position, event });
		} else {
			this._mouseDown.fire(null);
		}
	}

	_mouseUpHandler(event: MouseEvent) {
		const position = this._determineMousePosition(event);
		if (position) {
			this._mouseUp.fire({ position, event });
		} else {
			this._mouseUp.fire(null);
		}
	}

	_determineMousePosition(event: MouseEvent): MousePosition | null {
		if (!this._chart || !this._series) return null;
		const element = this._chart.chartElement();
		const chartContainerBox = element.getBoundingClientRect();
		const priceScaleWidth = this._series.priceScale().width();
		const timeScaleHeight = this._chart.timeScale().height();
		const x = event.clientX - chartContainerBox.x;
		const y = event.clientY - chartContainerBox.y;
		const overTimeScale = y > element.clientHeight - timeScaleHeight;
		const xPositionRelativeToPriceScale =
		element.clientWidth - priceScaleWidth - x;
		const overPriceScale = xPositionRelativeToPriceScale < 0;
		return {
			x,
			y,
			xPositionRelativeToPriceScale,
			overPriceScale,
			overTimeScale,
		};
	}
}
