import { Delegate } from '../../helpers/price-alert-delegate';

export interface UserAlertInfo {
	id: string;
	price: number;
}

export interface DragStopInfo {
	id: string;
	price: number;
	symbol: string;
}

export interface SelectionInfo {
	id: string;
	price: number;
	selected: boolean;
}

export class UserAlertsState {
	private _alertAdded: Delegate<UserAlertInfo> = new Delegate();
	private _alertRemoved: Delegate<string> = new Delegate();
	private _alertChanged: Delegate<UserAlertInfo> = new Delegate();
	private _alertsChanged: Delegate = new Delegate();
	private _dragStarted: Delegate<UserAlertInfo> = new Delegate();
	private _dragStopped: Delegate<DragStopInfo> = new Delegate();
	private _alertSelected: Delegate<SelectionInfo> = new Delegate();
	private _alertHovered: Delegate<UserAlertInfo | null> = new Delegate();
	private _alerts: Map<string, UserAlertInfo>;

	constructor() {
		this._alerts = new Map();
		this._alertsChanged.subscribe(() => {
			this._updateAlertsArray();
		}, this);
	}

	destroy() {
		// TODO: add more destroying 💥
		this._alertsChanged.unsubscribeAll(this);
		this._dragStarted.destroy();
		this._dragStopped.destroy();
		this._alertSelected.destroy();
		this._alertHovered.destroy();
	}

	alertAdded(): Delegate<UserAlertInfo> {
		return this._alertAdded;
	}

	alertRemoved(): Delegate<string> {
		return this._alertRemoved;
	}

	alertChanged(): Delegate<UserAlertInfo> {
		return this._alertChanged;
	}

	alertsChanged(): Delegate {
		return this._alertsChanged;
	}

	dragStarted(): Delegate<UserAlertInfo> {
		return this._dragStarted;
	}

	dragStopped(): Delegate<DragStopInfo> {
		return this._dragStopped;
	}

	alertSelected(): Delegate<SelectionInfo> {
		return this._alertSelected;
	}

	alertHovered(): Delegate<UserAlertInfo | null> {
		return this._alertHovered;
	}

	addAlert(price: number): string | null {
		// Prevent duplicate alerts at the same price
		for (const existing of this._alerts.values()) {
			if (existing.price === price) {
				return null;
			}
		}
		const id = this._getNewId();
		
		const userAlert: UserAlertInfo = {
			price,
			id,
		};
		this._alerts.set(id, userAlert);
		this._alertAdded.fire(userAlert);
		this._alertsChanged.fire();
		return id;
	}

	removeAlert(id: string) {
		if (!this._alerts.has(id)) return;
		this._alerts.delete(id);
		this._alertRemoved.fire(id);
		this._alertsChanged.fire();
	}

	updateAlertPrice(id: string, newPrice: number) {
		const alert = this._alerts.get(id);
		if (!alert) return;
		alert.price = newPrice;
		this._alertChanged.fire(alert);
		this._alertsChanged.fire();
	}

	alerts() {
		return this._alertsArray;
	}

	_alertsArray: UserAlertInfo[] = [];
	_updateAlertsArray() {
		this._alertsArray = Array.from(this._alerts.values()).sort((a, b) => {
			return b.price - a.price;
		});
	}

	private _getNewId(): string {
		let id = Math.round(Math.random() * 1000000).toString(16);
		while (this._alerts.has(id)) {
			id = Math.round(Math.random() * 1000000).toString(16);
		}
		return id;
	}
}
