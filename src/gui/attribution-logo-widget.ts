import type { BrandLogoOptions, LogoTheme } from "../model/layout-options";
import { IChartWidgetBase } from "./chart-widget";

const css = `#mtp-attr-logo{position:absolute;left:10px;bottom:10px;margin:0;padding:0;border:0;z-index:3;}`;

// This widget doesn't support dynamically responding to options changes
// because it is expected that the `brandLogo` option won't be changed
// and this saves some bundle size.
export class AttributionLogoWidget {
	private readonly _chart: IChartWidgetBase;
	private readonly _container: HTMLElement;
	private _element: HTMLElement | undefined = undefined;
	private _cssElement: HTMLStyleElement | undefined = undefined;
	private _theme: LogoTheme | undefined = undefined;
	private _visible: boolean = false;

	public constructor(container: HTMLElement, chart: IChartWidgetBase) {
		this._container = container;
		this._chart = chart;
		this._render();
	}

	public update(): void {
		this._render();
	}

	public removeElement(): void {
		if (this._element) {
			if (this._element.parentNode === this._container) {
				this._container.removeChild(this._element);
			}
		}
		if (this._cssElement) {
			if (this._cssElement.parentNode === this._container) {
				this._container.removeChild(this._cssElement);
			}
		}
		this._element = undefined;
		this._cssElement = undefined;
	}

	private _shouldUpdate(): boolean {
		return (
			this._visible !== this._shouldBeVisible() || this._theme !== this._themeToUse()
		);
	}

	private _themeToUse(): LogoTheme {
		return this._chart
			.model()
			.colorParser()
			.colorStringToGrayscale(this._chart.options()["layout"].textColor) > 160
			? "dark"
			: "light";
	}

	private _shouldBeVisible(): boolean {
		const layoutOptions = this._chart.options()["layout"] as unknown as Record<
			string,
			unknown
		>;
		console.log("[MTP Debug] layoutOptions keys:", Object.keys(layoutOptions));
		console.log("[MTP Debug] brandLogo:", layoutOptions["brandLogo"]);
		console.log("[MTP Debug] attributionLogo:", layoutOptions["attributionLogo"]);
		// Show custom brand logo if provided, otherwise fall back to attributionLogo boolean
		if (layoutOptions["brandLogo"] !== undefined) {
			return true;
		}
		return layoutOptions["attributionLogo"] !== false;
	}

	private _render(): void {
		if (!this._shouldUpdate()) {
			return;
		}
		this.removeElement();
		this._visible = this._shouldBeVisible();
		if (this._visible) {
			this._theme = this._themeToUse();
			const layoutOptions = this._chart.options()["layout"] as unknown as Record<
				string,
				unknown
			>;
			const brandLogo = layoutOptions["brandLogo"] as BrandLogoOptions | undefined;

			this._cssElement = document.createElement("style");
			this._cssElement.innerText = css;

			if (brandLogo) {
				const content = brandLogo.content(this._theme as LogoTheme);

				if (brandLogo.href) {
					// Wrap in a clickable link
					this._element = document.createElement("a");
					(this._element as HTMLAnchorElement).href = brandLogo.href;
					if (brandLogo.title) {
						this._element.title = brandLogo.title;
					}
					(this._element as HTMLAnchorElement).target = "_blank";
					this._element.innerHTML = content;
				} else {
					// No link — plain container
					this._element = document.createElement("div");
					this._element.innerHTML = content;
				}
				this._element.id = "mtp-attr-logo";
			} else {
				// No brand logo configured — show nothing
				return;
			}

			this._container.appendChild(this._cssElement);
			this._container.appendChild(this._element);
		}
	}
}
