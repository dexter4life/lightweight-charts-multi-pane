import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { Geometry, RectangleGeometry } from '../../core/geometry';
import { ImagePaneView } from './image-pane-view';

export interface ImageOptions extends DrawingOptions {
  imageUrl?: string;
  width?: number;
  height?: number;
  opacity?: number;
}

export class ImageDrawing extends Drawing {
  readonly type = 'image';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _imageOptions: ImageOptions;
  private _image: HTMLImageElement | null = null;
  private _loadedUrl: string | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<ImageOptions> = {}
  ) {
    const { imageUrl, width, height, opacity, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._imageOptions = {
      ...this._options,
      imageUrl: imageUrl ?? '',
      width: width ?? 96,
      height: height ?? 96,
      opacity: opacity ?? 1,
    };

    this.ensureImageLoaded();
  }

  get imageOptions(): ImageOptions {
    return this._imageOptions;
  }

  get loadedImage(): HTMLImageElement | null {
    return this._image;
  }

  setImageOptions(options: Partial<ImageOptions>): void {
    this._imageOptions = { ...this._imageOptions, ...options };
    if (options.imageUrl !== undefined) {
      this.ensureImageLoaded();
    }
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<ImageOptions>): void {
    this._imageOptions = { ...this._imageOptions, ...options };
    if (options.imageUrl !== undefined) {
      this.ensureImageLoaded();
    }
    super.updateOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= ImageDrawing.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new ImagePaneView(this)];
  }

  getBounds(viewport: Viewport): { left: number; right: number; top: number; bottom: number } | null {
    if (!this.isValid()) {
      return null;
    }

    const anchor = this.anchorToPixel(this._anchors[0], viewport);
    if (!anchor) {
      return null;
    }

    const width = this._imageOptions.width ?? 96;
    const height = this._imageOptions.height ?? 96;

    return {
      left: anchor.x - width / 2,
      right: anchor.x + width / 2,
      top: anchor.y - height / 2,
      bottom: anchor.y + height / 2,
    };
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const bounds = this.getBounds(viewport);
    if (!bounds) {
      return [];
    }

    return [{
      type: 'rectangle',
      topLeft: { x: bounds.left, y: bounds.top },
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top,
    } as RectangleGeometry];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const bounds = this.getBounds(viewport);
    if (!bounds) {
      return false;
    }

    return (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    );
  }

  override toJSON(): SerializedDrawing {
    return {
      ...super.toJSON(),
      options: { ...this._imageOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._imageOptions = { ...this._imageOptions, ...data.options };
    this.ensureImageLoaded();
  }

  override clone(newId: string): IDrawing {
    return new ImageDrawing(newId, [...this._anchors], { ...this._style }, { ...this._imageOptions });
  }

  private ensureImageLoaded(): void {
    const imageUrl = this._imageOptions.imageUrl ?? '';
    if (!imageUrl) {
      this._image = null;
      this._loadedUrl = null;
      return;
    }

    if (this._loadedUrl === imageUrl && this._image) {
      return;
    }

    if (typeof Image === 'undefined') {
      this._image = null;
      this._loadedUrl = null;
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      this._image = image;
      this._loadedUrl = imageUrl;
      this.requestUpdate();
    };
    image.onerror = () => {
      this._image = null;
      this._loadedUrl = null;
      this.requestUpdate();
    };
    image.src = imageUrl;
  }
}
