import { DrawingTools } from "lightweight-charts-multi-pane";

const { imageStickerSource, setStickerSourceFactory } = DrawingTools;
type StickerSource = DrawingTools.StickerSource;

/** Plays Telegram (.tgs) stickers through the ui-sdk rlottie renderer; other formats stay plain images. */
export function installStickerSources(): void {
  setStickerSourceFactory((url, size, onChange) => {
    if (!url.split("?")[0].endsWith(".tgs")) return imageStickerSource(url, size, onChange);

    const viewId = crypto.randomUUID();
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${size}px;height:${size}px;pointer-events:none;`;
    document.body.appendChild(host);

    let disposed = false;
    let ready = false;
    let player: { removeView(id: string): void } | null = null;

    import("@ui/Sticker")
      .then(({ ensureRLottie }) => ensureRLottie())
      .then((RLottie) => {
        if (disposed) return;
        const instance = RLottie.init(
          url,
          host,
          crypto.randomUUID(),
          { size },
          viewId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          () => {
            ready = true;
            onChange();
          },
        );
        player = instance;
        instance.play(true);
      });

    const source: StickerSource = {
      size,
      image: () => (ready ? host.querySelector("canvas") : null),
      dispose() {
        disposed = true;
        player?.removeView(viewId);
        host.remove();
      },
    };
    return source;
  });
}
