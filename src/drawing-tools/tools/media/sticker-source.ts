/** A drawable picture for a sticker: a still image or an animation that repaints a canvas. */
export interface StickerSource {
  /** The current frame, or null while loading. */
  image(): CanvasImageSource | null;
  /** Pixel size the source was prepared for. */
  readonly size: number;
  dispose(): void;
}

/** Builds a source for `url`. `onChange` is called whenever a new frame is ready. */
export type StickerSourceFactory = (url: string, size: number, onChange: () => void) => StickerSource | null;

/** Loads a still image; animated formats need a factory registered with {@link setStickerSourceFactory}. */
export const imageStickerSource: StickerSourceFactory = (url, size, onChange) => {
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  let ready = false;
  img.onload = () => {
    ready = true;
    onChange();
  };
  img.src = url;
  return {
    size,
    image: () => (ready ? img : null),
    dispose: () => {
      img.onload = null;
    },
  };
};

let factory: StickerSourceFactory = imageStickerSource;

/**
 * Replaces how stickers are loaded, e.g. to play Lottie (.tgs) files.
 * The replacement can fall back to {@link imageStickerSource} for plain images.
 */
export function setStickerSourceFactory(next: StickerSourceFactory): void {
  factory = next;
}

export function createStickerSource(url: string, size: number, onChange: () => void): StickerSource | null {
  return factory(url, size, onChange);
}
