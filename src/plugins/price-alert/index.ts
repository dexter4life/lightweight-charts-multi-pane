import { IChartApi } from "../../api/create-chart";
import { ISeriesApi } from "../../api/iseries-api";
import {
	ISeriesPrimitive,
	SeriesAttachedParameter,
} from "../../api/iseries-primitive-api";
import { Time } from "../../model/horz-scale-behavior-time/types";
import { IPrimitivePaneView, PrimitiveHoveredItem } from "../../model/ipane-primitive";
import { SeriesType } from "../../model/series-options";
import { MouseHandlers, MousePosition } from "../../plugins/price-alert/mouse";
import {
	clockIconPaths,
	clockPlusIconPaths,
	defaultPriceAlertsOptions,
	PartialOptions,
	PriceAlertsOptions,
} from "./constants";
import { AlertRendererData, IRendererData } from "./irenderer-data";
import { UserAlertPricePaneView } from "./pane-view";
import { UserAlertInfo, UserAlertsState } from "./state";

export class PriceAlerts extends UserAlertsState implements ISeriesPrimitive<Time> {
	private _chart: IChartApi | undefined = undefined;
	private _series: ISeriesApi<SeriesType> | undefined = undefined;
	private _mouseHandlers: MouseHandlers;

	private _paneViews: UserAlertPricePaneView[] = [];
	private _pricePaneViews: UserAlertPricePaneView[] = [];

	private _lastMouseUpdate: MousePosition | null = null;
	private _currentCursor: string | null = null;

	private _symbolName: string = "";

	private _options: PriceAlertsOptions;

	private _selectedId: string = "";
	private _draggingId: string | null = null;
	private _wasDragging: boolean = false;
	private _lastHoveredId: string | null = null;

	/** Get the current options. */
	get options(): PriceAlertsOptions {
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
	applyOptions(partial: PartialOptions<PriceAlertsOptions>): void {
		this._options = {
			line: { ...this._options.line, ...partial.line },
			label: { ...this._options.label, ...partial.label },
			crosshairButton: { ...this._options.crosshairButton, ...partial.crosshairButton },
			centreLabel: { ...this._options.centreLabel, ...partial.centreLabel },
			priceScaleLabel: { ...this._options.priceScaleLabel, ...partial.priceScaleLabel },
		};
	}

	constructor(options?: PartialOptions<PriceAlertsOptions>) {
		super();
		this._options = {
			line: { ...defaultPriceAlertsOptions.line, ...options?.line },
			label: { ...defaultPriceAlertsOptions.label, ...options?.label },
			crosshairButton: {
				...defaultPriceAlertsOptions.crosshairButton,
				...options?.crosshairButton,
			},
			centreLabel: { ...defaultPriceAlertsOptions.centreLabel, ...options?.centreLabel },
			priceScaleLabel: {
				...defaultPriceAlertsOptions.priceScaleLabel,
				...options?.priceScaleLabel,
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
		this._paneViews = [new UserAlertPricePaneView(false)];
		this._pricePaneViews = [new UserAlertPricePaneView(true)];
		this._mouseHandlers.attached(chart, series);
		this._mouseHandlers.mouseMoved().subscribe((mouseEvent) => {
			if (!mouseEvent) {
				this._lastMouseUpdate = null;
				requestUpdate();
				return;
			}
			this._lastMouseUpdate = mouseEvent.position;
			// Stop chart panning while dragging an alert line.
			// capture: true on the listener means we see the event before
			// the chart's internal handler; stopPropagation() prevents it.
			if (this._draggingId) {
				mouseEvent.event.stopPropagation();
			}
			// Handle drag: update alert price in real-time
			if (this._draggingId && mouseEvent.position && this._series) {
				const newPrice = this._series.coordinateToPrice(mouseEvent.position.y);
				if (newPrice !== null) {
					this.updateAlertPrice(this._draggingId, newPrice);
				}
			}
			requestUpdate();
		}, this);
		this._mouseHandlers.clicked().subscribe((mousePosition) => {
			if (this._wasDragging) {
				this._wasDragging = false;
				return;
			}
			if (mousePosition && this._series) {
				if (this._isHovering(mousePosition)) {
					const price = this._series.coordinateToPrice(mousePosition.y);
					if (this._options.beforeAddAlert) {
						if (this._options.beforeAddAlert(mousePosition,price)) {
							if (price) {
								this.addAlert(price);
								requestUpdate();
							}
						}
					} else {
						if (price) {
							this.addAlert(price);
							requestUpdate();
						}
					}
				} else if (this._hoveringID) {
					this.removeAlert(this._hoveringID);
					requestUpdate();
				}
			}
		}, this);
		this._mouseHandlers.mouseDown().subscribe((mouseEvent) => {
			if (mouseEvent && this._series) {
				// Stop chart from entering pan mode when clicking on an alert line.
				// capture: true means we intercept before the chart's handler;
				// stopPropagation() prevents the chart from seeing the mousedown.
				if (this._isNearAlertLine(mouseEvent.position)) {
					mouseEvent.event.stopPropagation();
				}
				this._handleMouseDown(mouseEvent.position, requestUpdate);
			}
		}, this);
		this._mouseHandlers.mouseUp().subscribe((mouseEvent) => {
			// Stop the chart from synthesising a click on mouseup after a drag,
			// which could deselect or trigger placement.
			if (mouseEvent && this._draggingId) {
				mouseEvent.event.stopPropagation();
			}
			this._handleMouseUp();
		}, this);
	}

	detached() {
		this._mouseHandlers.mouseMoved().unsubscribeAll(this);
		this._mouseHandlers.clicked().unsubscribeAll(this);
		this._mouseHandlers.mouseDown().unsubscribeAll(this);
		this._mouseHandlers.mouseUp().unsubscribeAll(this);
		this._mouseHandlers.detached();
		this._series = undefined;
	}

	paneViews(): readonly IPrimitivePaneView[] {
		return this._paneViews;
	}

	priceAxisPaneViews(): readonly IPrimitivePaneView[] {
		return this._pricePaneViews;
	}

	updateAllViews(): void {
		const alerts = this.alerts();
		const rendererData = this._calculateRendererData(alerts, this._lastMouseUpdate);
		this._currentCursor = null;
		if (this._draggingId) {
			// Dragging: show ns-resize cursor (↕)
			this._currentCursor = "ns-resize";
		} else if (this._lastMouseUpdate && this._isNearAlertLine(this._lastMouseUpdate)) {
			// Hovering near an alert line: show ns-resize cursor (↕)
			this._currentCursor = "ns-resize";
		} else if (
			rendererData?.button?.hovering ||
			rendererData?.alerts.some((alert) => alert.showHover && alert.hoverRemove)
		) {
			this._currentCursor = "pointer";
		}

		// Fire alertHovered on enter/leave transitions
		const hoveredId = this._isNearAlertLine(this._lastMouseUpdate);
		if (hoveredId !== this._lastHoveredId) {
			if (hoveredId) {
				// Hover entered an alert line
				const alertInfo = this._getAlertById(hoveredId);
				if (alertInfo) {
					this.alertHovered().fire(alertInfo);
				}
			} else if (this._lastHoveredId !== null) {
				// Hover left an alert line
				this.alertHovered().fire(null);
			}
			this._lastHoveredId = hoveredId;
		}

		if (rendererData) {
			this._paneViews.forEach((pv) => pv.update(rendererData));
			this._pricePaneViews.forEach((pv) => pv.update(rendererData));
		}
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
		this._symbolName = name;
	}

	_isHovering(mousePosition: MousePosition | null): boolean {
		return Boolean(
			mousePosition &&
			mousePosition.xPositionRelativeToPriceScale >= 1 &&
			mousePosition.xPositionRelativeToPriceScale < this._options.crosshairButton.width,
		);
	}

	_isHoveringRemoveButton(
		mousePosition: MousePosition | null,
		timescaleWidth: number,
		alertY: number,
		textLength: number,
	): boolean {
		if (!mousePosition || !timescaleWidth) return false;
		const distanceY = Math.abs(mousePosition.y - alertY);
		if (distanceY > this._options.centreLabel.height / 2) return false;
		const labelWidth =
			this._options.centreLabel.inlinePadding * 2 +
			this._options.centreLabel.removeButtonWidth +
			textLength * this._options.centreLabel.averageCharWidth;
		const buttonCentreX =
			(timescaleWidth + labelWidth - this._options.centreLabel.removeButtonWidth) * 0.5;
		const distanceX = Math.abs(mousePosition.x - buttonCentreX);
		return distanceX <= this._options.centreLabel.removeButtonWidth / 2;
	}

	private _hoveringID: string = "";

	/** Handle mousedown on an alert line: toggle selection and start drag. */
	private _handleMouseDown(
		mousePosition: MousePosition,
		requestUpdate: () => void,
	): void {
		const nearId = this._isNearAlertLine(mousePosition);
		if (nearId) {
			if (this._selectedId) {
				const prevAlert = this._getAlertById(this._selectedId);
				if (prevAlert) {
					this.alertSelected().fire({ ...prevAlert, selected: false });
				}
			}
			// Select this line and begin drag
			this._selectedId = nearId;
			this._draggingId = nearId;
			const alertInfo = this._getAlertById(nearId);
			if (alertInfo) {
				this.alertSelected().fire({ ...alertInfo, selected: true });
				this.dragStarted().fire(alertInfo);
			}
		} else {
			// Click on empty space → deselect
			if (this._selectedId) {
				const prevAlert = this._getAlertById(this._selectedId);
				if (prevAlert) {
					this.alertSelected().fire({ ...prevAlert, selected: false });
				}
			}
			this._selectedId = "";
		}
		requestUpdate();
	}

	/** Handle mouseup: end drag. */
	private _handleMouseUp(): void {
		if (this._draggingId) {
			const alertInfo = this._getAlertById(this._draggingId);
			if (alertInfo) {
				this.dragStopped().fire({ ...alertInfo, symbol: this._symbolName });
			}
			this._wasDragging = true;
			this._draggingId = null;
		}
	}

	/** Get alert info by ID from the internal alerts map. */
	private _getAlertById(id: string): UserAlertInfo | undefined {
		return this.alerts().find((a) => a.id === id);
	}

	/** Check if the mouse is near any alert line within hit tolerance. Returns alert ID or null. */
	private _isNearAlertLine(mousePosition: MousePosition | null): string | null {
		if (!mousePosition || !this._series) return null;
		const alertsInfo = this.alerts();
		for (const alertInfo of alertsInfo) {
			const y = this._series.priceToCoordinate(alertInfo.price);
			if (
				y !== null &&
				!isNaN(y) &&
				Math.abs(mousePosition.y - y) <= this._options.line.hitTolerance
			) {
				return alertInfo.id;
			}
		}
		return null;
	}

	/**
	 * We are calculating this here instead of within a view
	 * because the data is identical for both Renderers so lets
	 * rather calculate it once here.
	 */
	_calculateRendererData(
		alertsInfo: UserAlertInfo[],
		mousePosition: MousePosition | null,
	): IRendererData | null {
		if (!this._series) return null;
		const priceFormatter = this._series.priceFormatter();

		const showCrosshair = mousePosition && !mousePosition.overTimeScale;
		const showButton = showCrosshair;
		const crosshairPrice =
			mousePosition && this._series.coordinateToPrice(mousePosition.y);
		const crosshairPriceText = priceFormatter.format(crosshairPrice ?? -100);

		let closestDistance = Infinity;
		let closestIndex: number = -1;

		const alerts: (AlertRendererData & { price: number; id: string })[] = alertsInfo.map(
			(alertInfo, index) => {
				const coordinate = this._series!.priceToCoordinate(alertInfo.price);
				const y = coordinate !== null && !isNaN(coordinate) ? coordinate : -100;
				const isSelected = alertInfo.id === this._selectedId;

				if (mousePosition?.y && y >= 0) {
					const distance = Math.abs(mousePosition.y - y);
					if (distance < closestDistance) {
						closestIndex = index;
						closestDistance = distance;
					}
				}
				return isSelected
					? {
							y,
							showHover: true as const,
							selected: true,
							dragged: this._wasDragging,
							text: `${this._symbolName} crossing ${priceFormatter.format(alertInfo.price)}`,
							price: alertInfo.price,
							id: alertInfo.id,
							hoverRemove: false,
						}
					: {
							y,
							showHover: false as const,
							selected: false,
							dragged: this._wasDragging,
							price: alertInfo.price,
							id: alertInfo.id,
						};
			},
		);
		this._hoveringID = "";
		if (closestIndex >= 0 && closestDistance < this._options.centreLabel.showDistance) {
			const timescaleWidth = this._chart?.timeScale().width() ?? 0;
			const a = alerts[closestIndex];
			const text = `${this._symbolName} crossing ${this._series
				.priceFormatter()
				.format(a.price)}`;
			const price = a.price;
			const hoverRemove = this._isHoveringRemoveButton(
				mousePosition,
				timescaleWidth,
				a.y,
				text.length,
			);
			alerts[closestIndex] = {
				...alerts[closestIndex],
				showHover: true, // override: proximity hover takes precedence
				text,
				price,
				hoverRemove,
			};
			if (hoverRemove) this._hoveringID = a.id;
		}
		return {
			alertIcon: clockIconPaths,
			alerts,
			button: showButton
				? {
						hovering: this._isHovering(mousePosition),
						hoverColor: this._options.crosshairButton.hoverColor,
						crosshairLabelIcon: clockPlusIconPaths,
					}
				: null,
			color: this._options.line.color,
			crosshair: showCrosshair
				? {
						y: mousePosition.y,
						text: crosshairPriceText,
					}
				: null,
			options: this._options,
		};
	}
}
