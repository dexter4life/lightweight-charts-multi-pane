import { ensureNotNull } from "../helpers/assertions";
import { notNull } from "../helpers/strict-type-checks";
import { CrosshairAnchorPaneView } from "../views/pane/crosshair-anchor-pane-view";

import { LineStyle, LineWidth } from "../renderers/draw-line";
import { CrosshairMarksPaneView } from "../views/pane/crosshair-marks-pane-view";
import { CrosshairPaneView } from "../views/pane/crosshair-pane-view";
import { IPaneView } from "../views/pane/ipane-view";
import { CrosshairPriceAxisView } from "../views/price-axis/crosshair-price-axis-view";
import { IPriceAxisView } from "../views/price-axis/iprice-axis-view";
import { PriceAxisView } from "../views/price-axis/price-axis-view";
import { CrosshairTimeAxisView } from "../views/time-axis/crosshair-time-axis-view";
import { ITimeAxisView } from "../views/time-axis/itime-axis-view";

import { PixelPoints } from "../renderers/pixel-points";
import { CrosshairDemonstrationPaneView } from "../views/pane/crosshair-demonstration-pane-view";
import { BarPrice } from "./bar";
import { IChartModelBase } from "./chart-model";
import { Coordinate } from "./coordinate";
import { DataSource } from "./data-source";
import { InternalHorzScaleItem } from "./ihorz-scale-behavior";
import { ISeries } from "./iseries";
import { Pane } from "./pane";
import { MismatchDirection } from "./plot-list";
import { PriceScale } from "./price-scale";
import { SeriesType } from "./series-options";
import { TimePointIndex } from "./time-data";

export interface CrosshairPriceAndCoordinate {
	price: number;
	coordinate: number;
}

export interface CrosshairTimeAndCoordinate {
	time: InternalHorzScaleItem;
	coordinate: number;
}

export type PriceAndCoordinateProvider = (
	priceScale: PriceScale,
) => CrosshairPriceAndCoordinate;
export type TimeAndCoordinateProvider = () => CrosshairTimeAndCoordinate | null;

export enum CrosshairType {
	/**
	 * This mode renders a cross-shaped crosshair marker at the cursor position.
	 */
	Cross = 0,

	/**
	 * This mode renders a dot-shaped crosshair marker at the cursor position.
	 */
	Dot = 1,

	/**
	 * This mode renders an arrow-shaped crosshair marker at the cursor position.
	 */
	Arrow = 2,

	/**
	 * This mode renders a demonstration crosshair marker for preview/demo purposes.
	 */
	Demo = 3,
}

/**
 * Represents the crosshair mode.
 */
export const enum CrosshairMode {
	/**
	 * This mode allows crosshair to move freely on the chart.
	 */
	Normal,
	/**
	 * This mode sticks crosshair's horizontal line to the price value of a single-value series or to the close price of OHLC-based series.
	 */
	Magnet,
	/**
	 * This mode disables rendering of the crosshair.
	 */
	Hidden,
	/**
	 * This mode sticks crosshair's horizontal line to the price value of a single-value series or to the open/high/low/close price of OHLC-based series.
	 */
	MagnetOHLC,
}

/** Structure describing a crosshair line (vertical or horizontal) */
export interface CrosshairLineOptions {
	/**
	 * Crosshair line color.
	 *
	 * @defaultValue `'#758696'`
	 */
	color: string;

	/**
	 * Crosshair line width.
	 *
	 * @defaultValue `1`
	 */
	width: LineWidth;

	/**
	 * Crosshair line style.
	 *
	 * @defaultValue {@link LineStyle.LargeDashed}
	 */
	style: LineStyle;

	/**
	 * Display the crosshair line.
	 *
	 * Note that disabling crosshair lines does not disable crosshair marker on Line and Area series.
	 * It can be disabled by using `crosshairMarkerVisible` option of a relevant series.
	 *
	 * @see {@link LineStyleOptions.crosshairMarkerVisible}
	 * @see {@link AreaStyleOptions.crosshairMarkerVisible}
	 * @see {@link BaselineStyleOptions.crosshairMarkerVisible}
	 * @defaultValue `true`
	 */
	visible: boolean;

	/**
	 * Display the crosshair label on the relevant scale.
	 *
	 * @defaultValue `true`
	 */
	labelVisible: boolean;

	/**
	 * Crosshair label background color.
	 *
	 * @defaultValue `'#4c525e'`
	 */
	labelBackgroundColor: string;
}

/** Structure describing crosshair options  */
export interface CrosshairOptions {
	/**
	 * Crosshair mode
	 *
	 * @defaultValue {@link CrosshairMode.Magnet}
	 */
	mode: CrosshairMode;

	/**
	 * Vertical line options.
	 */
	vertLine: CrosshairLineOptions;

	/**
	 * Horizontal line options.
	 */
	horzLine: CrosshairLineOptions;

	/**
	 * If set to `true`, the crosshair will not snap to the data points of hidden series.
	 *
	 * @defaultValue `false`
	 */
	doNotSnapToHiddenSeriesIndices: boolean;

	/**
	 * Crosshair type, which controls the shape of the crosshair marker rendered at the cursor position.
	 *
	 * @defaultValue {@link CrosshairType.Cross}
	 */
	type?: CrosshairType;

	anchor?: {
		color?: string;
		strokeColor?: string;
	};
}

type RawPriceProvider = () => BarPrice;
type RawCoordinateProvider = () => Coordinate;
type RawIndexProvider = () => TimePointIndex;

export class Crosshair extends DataSource {
	private _pane: Pane | null = null;
	private _price: number = NaN;
	private _index: TimePointIndex = 0 as TimePointIndex;
	private _visible: boolean = false; // initially the crosshair should not be visible, until the user interacts.
	private readonly _model: IChartModelBase;
	private _priceAxisViews: Map<PriceScale, CrosshairPriceAxisView> = new Map();
	private readonly _timeAxisView: CrosshairTimeAxisView;
	private _subscribed: boolean = false;
	private readonly _currentPosPriceProvider: PriceAndCoordinateProvider;
	private readonly _options: CrosshairOptions;
	private _mouseDown: boolean = false;
	private _mouseEnter: boolean = false;
	private _strokes: PixelPoints[] = [];

	private _crosshairPaneViewCache: WeakMap<Pane, CrosshairPaneView> = new WeakMap();
	private readonly _markersPaneViewCache: WeakMap<Pane, CrosshairMarksPaneView> =
		new WeakMap();
	private readonly _anchorPaneViewCache: WeakMap<Pane, CrosshairAnchorPaneView> =
		new WeakMap();
	private readonly _demonstrationPaneViewCache: WeakMap<
		Pane,
		CrosshairDemonstrationPaneView
	> = new WeakMap();
	private _x: Coordinate = NaN as Coordinate;
	private _y: Coordinate = NaN as Coordinate;

	private _originX: Coordinate = NaN as Coordinate;
	private _originY: Coordinate = NaN as Coordinate;
	private _altKeyDown: boolean = false;

	public constructor(model: IChartModelBase, options: CrosshairOptions) {
		super();
		this._model = model;
		this._options = options;

		const valuePriceProvider = (
			rawPriceProvider: RawPriceProvider,
			rawCoordinateProvider: RawCoordinateProvider,
		) => {
			return (priceScale: PriceScale) => {
				const coordinate = rawCoordinateProvider();
				const rawPrice = rawPriceProvider();
				if (priceScale === ensureNotNull(this._pane).defaultPriceScale()) {
					// price must be defined
					return { price: rawPrice, coordinate: coordinate };
				} else {
					// always convert from coordinate
					const firstValue = ensureNotNull(priceScale.firstValue());
					const price = priceScale.coordinateToPrice(coordinate, firstValue);
					return { price: price, coordinate: coordinate };
				}
			};
		};

		const valueTimeProvider = (
			rawIndexProvider: RawIndexProvider,
			rawCoordinateProvider: RawCoordinateProvider,
		) => {
			return () => {
				const time = this._model.timeScale().indexToTime(rawIndexProvider());
				const coordinate = rawCoordinateProvider();
				if (!time || !Number.isFinite(coordinate)) {
					return null;
				}
				return {
					time,
					coordinate,
				};
			};
		};

		// for current position always return both price and coordinate
		this._currentPosPriceProvider = valuePriceProvider(
			() => this._price as BarPrice,
			() => this._y,
		);

		const currentPosTimeProvider = valueTimeProvider(
			() => this._index,
			() => this.appliedX(),
		);

		this._timeAxisView = new CrosshairTimeAxisView(this, model, currentPosTimeProvider);
	}

	public options(): Readonly<CrosshairOptions> {
		return this._options;
	}

	public saveOriginCoord(x: Coordinate, y: Coordinate): void {
		this._originX = x;
		this._originY = y;
	}

	public clearOriginCoord(): void {
		this._originX = NaN as Coordinate;
		this._originY = NaN as Coordinate;
	}

	public originCoordX(): Coordinate {
		return this._originX;
	}

	public originCoordY(): Coordinate {
		return this._originY;
	}

	public setPosition(index: TimePointIndex, price: number, pane: Pane): void {
		if (!this._subscribed) {
			this._subscribed = true;
		}

		this._visible = true;

		this._tryToUpdateViews(index, price, pane);
		
		if (this._mouseDown && this._altKeyDown && this._visible) {
			const stroke = this._activeStroke();
			if (stroke !== null) {
				stroke.setPoints(index, price);
			}
		}
	}

	public appliedPrice(): number {
		return this._price;
	}

	public appliedIndex(): TimePointIndex {
		return this._index;
	}

	public appliedX(): Coordinate {
		return this._x;
	}

	public appliedY(): Coordinate {
		return this._y;
	}

	public mouseDown(): boolean {
		return this._mouseDown;
	}

	public mouseEnter(): boolean {
		return this._mouseEnter;
	}

	public override visible(): boolean {
		return this._visible;
	}

	public altKeyDown(): boolean {
		return this._altKeyDown;
	}

	public setAltKeyDown(altKey: boolean) {
		this._altKeyDown = altKey;
	}

	public clearPosition(): void {
		this._visible = false;
		this._setIndexToLastSeriesBarIndex();

		this._price = NaN;
		this._x = NaN as Coordinate;
		this._y = NaN as Coordinate;
		this._pane = null;

		this.clearOriginCoord();
		this.updateAllViews();
	}

	public pixelPoints() {
		return this._strokes;
	}

	public snapToVisibleSeriesIfNeeded(index: TimePointIndex): TimePointIndex {
		if (!this._options.doNotSnapToHiddenSeriesIndices) {
			return index;
		}

		const model = this._model;
		const timeScale = model.timeScale();

		let closestLeftIndex: TimePointIndex | null = null;
		let closestRightIndex: TimePointIndex | null = null;
		for (const series of model.visibleSerieses()) {
			const leftResult = series.bars().search(index, MismatchDirection.NearestLeft);
			if (leftResult) {
				if (leftResult.index === index) {
					return index; // already snapped
				}

				if (closestLeftIndex === null || leftResult.index > closestLeftIndex) {
					closestLeftIndex = leftResult.index;
				}
			}

			const rightResult = series.bars().search(index, MismatchDirection.NearestRight);
			if (rightResult) {
				if (rightResult.index === index) {
					return index; // already snapped
				}

				if (closestRightIndex === null || rightResult.index < closestRightIndex) {
					closestRightIndex = rightResult.index;
				}
			}
		}

		const candidates = [closestLeftIndex, closestRightIndex].filter(notNull);
		if (candidates.length === 0) {
			return index;
		}

		const x = timeScale.indexToCoordinate(index);
		const distances = candidates.map((i: TimePointIndex) =>
			Math.abs(x - timeScale.indexToCoordinate(i)),
		);
		const minDistanceIndex = distances.indexOf(Math.min(...distances));
		return candidates[minDistanceIndex];
	}

	public paneViews(pane: Pane): readonly IPaneView[] {
		let crosshairPaneView = this._crosshairPaneViewCache.get(pane);
		if (!crosshairPaneView) {
			crosshairPaneView = new CrosshairPaneView(this, pane);
			this._crosshairPaneViewCache.set(pane, crosshairPaneView);
		}
		let markersPaneView = this._markersPaneViewCache.get(pane);
		if (!markersPaneView) {
			markersPaneView = new CrosshairMarksPaneView(this._model, this, pane);
			this._markersPaneViewCache.set(pane, markersPaneView);
		}

		let anchorPaneView = this._anchorPaneViewCache.get(pane);
		if (!anchorPaneView) {
			anchorPaneView = new CrosshairAnchorPaneView(this, pane);
			this._anchorPaneViewCache.set(pane, anchorPaneView);
		}

		let demonstrationPaneView = this._demonstrationPaneViewCache.get(pane);
		if (!demonstrationPaneView) {
			demonstrationPaneView = new CrosshairDemonstrationPaneView(this._model, this, pane);
			this._demonstrationPaneViewCache.set(pane, demonstrationPaneView);
		}

		return [crosshairPaneView, markersPaneView, anchorPaneView, demonstrationPaneView];
	}

	public horzLineVisible(pane: Pane): boolean {
		return pane === this._pane && this._options.horzLine.visible;
	}

	public vertLineVisible(): boolean {
		return this._options.vertLine.visible;
	}

	public override priceAxisViews(pane: Pane, priceScale: PriceScale): IPriceAxisView[] {
		if (!this._visible || this._pane !== pane) {
			this._priceAxisViews.clear();
		}

		const views: IPriceAxisView[] = [];
		if (this._pane === pane) {
			views.push(
				this._createPriceAxisViewOnDemand(
					this._priceAxisViews,
					priceScale,
					this._currentPosPriceProvider,
				),
			);
		}

		return views;
	}

	public override timeAxisViews(): readonly ITimeAxisView[] {
		return this._visible ? [this._timeAxisView] : [];
	}

	public pane(): Pane | null {
		return this._pane;
	}

	setMouseEnter(mouseState: boolean) {
		this._mouseEnter = mouseState;
	}

	setMouseDown() {
		this._mouseDown = true;

		if (this._activeStroke() !== null) {
			return;
		}

		this._strokes.push(
			new PixelPoints(() => {
				this.updateAllViews();
				this._model.lightUpdate();
			}, this.clearPixelPoints.bind(this)),
		);
	}

	setMouseUp() {
		this._mouseDown = false;

		if (this._strokes.length > 0) {
			this._strokes.forEach((stroke) => {
				stroke.clear();
			});
		}
	}

	public updateAllViews(): void {
		this._model.panes().forEach((pane: Pane) => {
			this._crosshairPaneViewCache.get(pane)?.update();
			this._markersPaneViewCache.get(pane)?.update();
			this._anchorPaneViewCache.get(pane)?.update();
			this._demonstrationPaneViewCache.get(pane)?.update();
		});
		this._priceAxisViews.forEach((value: PriceAxisView) => value.update());
		this._timeAxisView.update();
	}

	public clearPixelPoints(pixelPoint: PixelPoints) {
		this._strokes = this._strokes.filter((stroke) => stroke !== pixelPoint);
	}

	private _activeStroke(): PixelPoints | null {
		for (let i = this._strokes.length - 1; i >= 0; i--) {
			const stroke = this._strokes[i];
			if (!stroke.erased && !stroke.isAnimating()) {
				return stroke;
			}
		}
		return null;
	}

	private _priceScaleByPane(pane: Pane): PriceScale | null {
		if (pane && !pane.defaultPriceScale().isEmpty()) {
			return pane.defaultPriceScale();
		}

		return null;
	}

	private _tryToUpdateViews(index: TimePointIndex, price: number, pane: Pane): void {
		if (this._tryToUpdateData(index, price, pane)) {
			this.updateAllViews();
		}
	}

	private _tryToUpdateData(
		newIndex: TimePointIndex,
		newPrice: number,
		newPane: Pane,
	): boolean {
		const oldX = this._x;
		const oldY = this._y;
		const oldPrice = this._price;
		const oldIndex = this._index;
		const oldPane = this._pane;
		const priceScale = this._priceScaleByPane(newPane);

		this._index = newIndex;
		this._x = isNaN(newIndex)
			? (NaN as Coordinate)
			: this._model.timeScale().indexToCoordinate(newIndex);
		this._pane = newPane;

		const firstValue = priceScale !== null ? priceScale.firstValue() : null;
		if (priceScale !== null && firstValue !== null) {
			this._price = newPrice;
			this._y = priceScale.priceToCoordinate(newPrice, firstValue);
		} else {
			this._price = NaN;
			this._y = NaN as Coordinate;
		}

		return (
			oldX !== this._x ||
			oldY !== this._y ||
			oldIndex !== this._index ||
			oldPrice !== this._price ||
			oldPane !== this._pane
		);
	}

	private _setIndexToLastSeriesBarIndex(): void {
		const lastIndexes = this._model
			.serieses()
			.map((s: ISeries<SeriesType>) => s.bars().lastIndex())
			.filter(notNull);
		const lastBarIndex =
			lastIndexes.length === 0 ? null : (Math.max(...lastIndexes) as TimePointIndex);
		this._index = lastBarIndex !== null ? lastBarIndex : (NaN as TimePointIndex);
	}

	private _createPriceAxisViewOnDemand(
		map: Map<PriceScale, CrosshairPriceAxisView>,
		priceScale: PriceScale,
		valueProvider: PriceAndCoordinateProvider,
	): IPriceAxisView {
		let view = map.get(priceScale);

		if (view === undefined) {
			view = new CrosshairPriceAxisView(this, priceScale, valueProvider);
			map.set(priceScale, view);
		}

		return view;
	}
}
