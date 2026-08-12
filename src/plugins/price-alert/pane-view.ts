import { IPrimitivePaneRenderer, IPrimitivePaneView, PrimitivePaneViewZOrder } from '../../model/ipane-primitive';
import { IRendererData } from './irenderer-data';
import { PaneRenderer } from './pane-renderer';
import { PriceScalePaneRenderer } from './price-scale-pane-renderer';

export class UserAlertPricePaneView implements IPrimitivePaneView {
	_renderer: PaneRenderer | PriceScalePaneRenderer;
	constructor(isPriceScale: boolean) {
		this._renderer = isPriceScale
			? new PriceScalePaneRenderer()
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
