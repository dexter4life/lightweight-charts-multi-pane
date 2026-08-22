import { IChartModelBase } from "../../model/chart-model";
import { Crosshair, CrosshairMode, CrosshairType } from "../../model/crosshair";
import { Pane } from "../../model/pane";
import { TimePointIndex } from "../../model/time-data";
import {
	CrosshairDemonstrationRenderer,
	CrosshairDemonstrationRendererData,
} from "../../renderers/crosshair-demonstration-renderer";
import { IPaneRenderer } from "../../renderers/ipane-renderer";
import { IPaneView } from "./ipane-view";

export class CrosshairDemonstrationPaneView implements IPaneView {
	private _invalidated: boolean = true;
	private readonly _pane: Pane;
	private readonly _chartModel: IChartModelBase;
	private readonly _source: Crosshair;
	private readonly _rendererData: CrosshairDemonstrationRendererData = {
		size: 9,
		iconScaling: 0.9,
		price: 0,
		index: 0 as TimePointIndex,
		mouseDown: false,
		mouseEnter: false,
		altKeyDown: false,
		visible: false,
	};

	public constructor(chartModel: IChartModelBase, crosshair: Crosshair, pane: Pane) {
		this._chartModel = chartModel;
		this._source = crosshair;
		this._pane = pane;

		this._renderer = new CrosshairDemonstrationRenderer(
			this._chartModel,
			this._pane,
			this._rendererData,
		);
	}

	private _renderer: CrosshairDemonstrationRenderer;

	renderer(pane: Pane, addAnchors?: boolean): IPaneRenderer | null {
		if (this._invalidated) {
			this._updateImpl();
			this._invalidated = false;
		}

		if (this._chartModel.options().crosshair.type != CrosshairType.Demo) return null;

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

		data.price = this._source.appliedPrice();
		data.index = this._source.appliedIndex();

		data.mouseDown = this._source.mouseDown();
		data.mouseEnter = this._source.mouseEnter();

		data.altKeyDown = this._source.altKeyDown();
		data.visible = visible && this._source.vertLineVisible();
	}
}
