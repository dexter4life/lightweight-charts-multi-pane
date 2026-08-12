import { CanvasRenderingTarget2D } from 'fancy-canvas';
import { IPrimitivePaneRenderer } from '../../model/ipane-primitive';
import { defaultRendererData, IRendererData } from './irenderer-data';

export abstract class PaneRendererBase implements IPrimitivePaneRenderer {
	_data: IRendererData = defaultRendererData;
	abstract draw(target: CanvasRenderingTarget2D): void;
	update(data: IRendererData) {
		this._data = data;
	}
}
