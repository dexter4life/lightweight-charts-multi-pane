import { IPrimitivePaneRenderer, IPrimitivePaneView, PrimitivePaneViewZOrder } from '../../model/ipane-primitive';
import { IRendererData } from './irenderer-data';
import { PaneRenderer } from './pane-renderer';
import { TimeScalePaneRenderer } from './time-scale-pane-renderer';

export class CrosshairPaneView implements IPrimitivePaneView {
	_renderer: PaneRenderer | TimeScalePaneRenderer;
	constructor(isTimescale: boolean) {
		this._renderer = isTimescale
			? new TimeScalePaneRenderer()
			: new PaneRenderer();
	}

	zOrder(): PrimitivePaneViewZOrder {
		return 'top';
	}

	renderer(): IPrimitivePaneRenderer {
		return this._renderer;
	}

	update(data: IRendererData) {
		this._renderer.update(data);
	}
}
