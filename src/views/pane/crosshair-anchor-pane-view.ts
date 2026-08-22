import { Crosshair, CrosshairMode } from "../../model/crosshair";
import { Pane } from "../../model/pane";
import {
	CrosshairAnchorRenderer,
	CrosshairAnchorRendererData,
} from "../../renderers/crosshair-anchor-renderer";
import { IPaneRenderer } from "../../renderers/ipane-renderer";
import { IPaneView } from "./ipane-view";

export class CrosshairAnchorPaneView implements IPaneView {
	private _invalidated: boolean = true;
	private readonly _pane: Pane;
	private readonly _source: Crosshair;
	private readonly _rendererData: CrosshairAnchorRendererData = {
		x: 0,
		y: 0,
		size: 9,
		iconScaling: 0.9,
		anchor: {},
		visible: false,
	};

	public constructor(crosshair: Crosshair, pane: Pane) {
		this._source = crosshair;
		this._pane = pane;
	}

	private _renderer: CrosshairAnchorRenderer = new CrosshairAnchorRenderer(
		this._rendererData,
	);

	renderer(pane: Pane, addAnchors?: boolean): IPaneRenderer | null {
		if (this._invalidated) {
			this._updateImpl();
			this._invalidated = false;
		}

		return this._renderer;
	}

	public update(): void {
		this._invalidated = true;
	}

	private _updateImpl(): void {
		const visible = this._source.visible();
		const crosshairOptions = this._pane.model().options().crosshair;

		const data = this._rendererData;

		if (crosshairOptions.mode === CrosshairMode.Hidden) {
			return;
		}

		data.type = this._source.options().type;
		data.x = this._source.appliedX();
		data.y = this._source.appliedY();

		data.anchor = crosshairOptions.anchor;
		data.visible = visible && this._source.vertLineVisible();
	}
}
