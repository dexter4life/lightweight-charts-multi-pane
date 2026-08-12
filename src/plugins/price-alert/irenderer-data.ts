import { defaultPriceAlertsOptions, type PriceAlertsOptions } from './constants';

interface CrosshairRendererData {
	y: number;
	text: string;
}

interface ShowHoverData {
	/** Text is used for the hover box */
	text: string;
	showHover: true;
    hoverRemove: boolean;
}

interface NoHoverData {
	showHover: false;
}

interface AlertRendererDataBase {
	y: number;
	showHover: boolean;
	selected: boolean;
	dragged: boolean;
	text?: string;
	price?: number;
}

interface CrosshairButtonData {
	hoverColor: string;
	crosshairLabelIcon: Path2D[];
	hovering: boolean;
}

export type AlertRendererData = AlertRendererDataBase & (ShowHoverData | NoHoverData);

export interface IRendererData {
	alertIcon: Path2D[];
	alerts: AlertRendererData[];
	button: CrosshairButtonData | null;
	color: string;
	crosshair: CrosshairRendererData | null;
	options: PriceAlertsOptions;
}

/** Sensible default so _data is never null. */
export const defaultRendererData: IRendererData = {
	alertIcon: [],
	alerts: [],
	button: null,
	color: '#131722',
	crosshair: null,
	options: defaultPriceAlertsOptions,
};
