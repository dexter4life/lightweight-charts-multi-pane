import type { Anchor, DrawingOptions, DrawingStyle, DrawingToolDefinition, IDrawing } from '../../core/types';

import { Emoji } from './emoji';
import { Icon } from './icon';
import { ImageDrawing } from './image';
import { Sticker } from './sticker';

export { Emoji, type EmojiOptions } from './emoji';
export { Icon, type IconOptions } from './icon';
export { GlyphDrawing, type GlyphOptions } from './glyph-drawing';
export { GlyphPaneView } from './glyph-pane-view';
export { ImageDrawing, ImageDrawing as Image, type ImageOptions } from './image';
export { ImagePaneView } from './image-pane-view';
export { Sticker, STICKER_DEFAULT_SIZE, type StickerOptions } from './sticker';
export {
  setStickerSourceFactory,
  imageStickerSource,
  type StickerSource,
  type StickerSourceFactory,
} from './sticker-source';

export type MediaToolDefinition = DrawingToolDefinition & {
  factory: (id: string, anchors?: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<DrawingOptions>) => IDrawing;
};

export const MEDIA_TOOL_DEFINITIONS: MediaToolDefinition[] = [
  {
    type: 'emoji',
    name: 'Emoji',
    category: 'media',
    requiredAnchors: 1,
    factory: (id, anchors, style, options) => new Emoji(id, anchors, style, options),
  },
  {
    type: 'icon',
    name: 'Icon',
    category: 'media',
    requiredAnchors: 1,
    factory: (id, anchors, style, options) => new Icon(id, anchors, style, options),
  },
  {
    type: 'sticker',
    name: 'Sticker',
    category: 'media',
    requiredAnchors: 1,
    factory: (id, anchors, style, options) => new Sticker(id, anchors, style, options),
  },
  {
    type: 'image',
    name: 'Image',
    category: 'media',
    requiredAnchors: 1,
    factory: (id, anchors, style, options) => new ImageDrawing(id, anchors, style, options),
  },
];
