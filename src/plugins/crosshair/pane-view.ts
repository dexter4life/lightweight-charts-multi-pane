import { IChartApi } from "../../api/create-chart";
import { ISeriesApi } from "../../api/iseries-api";
import {
	IPrimitivePaneRenderer,
	IPrimitivePaneView,
	PrimitivePaneViewZOrder,
} from "../../model/ipane-primitive";
import { SeriesType } from "../../model/series-options";
import { IRendererData } from "./irenderer-data";
import { PaneRenderer } from "./pane-renderer";
import { TimeScalePaneRenderer } from "./time-scale-pane-renderer";

export class CrosshairPaneView implements IPrimitivePaneView {
	_renderer: PaneRenderer | TimeScalePaneRenderer;
	constructor(
		isTimescale: boolean,
		chart?: IChartApi,
		series?: ISeriesApi<SeriesType>,
		requestUpdate?: () => void,
	) {
		this._renderer = isTimescale
			? new TimeScalePaneRenderer()
			: new PaneRenderer(chart, series, requestUpdate);
	}

	zOrder(): PrimitivePaneViewZOrder {
		return "top";
	}

	renderer(): IPrimitivePaneRenderer {
		return this._renderer;
	}

	update(data: IRendererData) {
		this._renderer.update(data);
	}
}
