import type { Section, StickerData } from "@ui/Sticker";
import { STICKER_SETS, type StickerSetInfo } from "./sets";

export interface PickedSticker {
  url: string;
  name: string;
  animated: boolean;
}

export const stickerUrl = (set: StickerSetInfo, i: number) => `/stickers/sets/${set.id}/${i}.${set.ext}`;

export const STICKER_SECTIONS: Section[] = STICKER_SETS.map((set) => ({
  id: set.id,
  label: set.title,
  unicode: set.emoji,
  stickerUrl: stickerUrl(set, 0),
  stickers: Array.from({ length: set.count }, (_, i) => ({
    name: `${set.id}_${i}`,
    slug: `${set.id}/${i}.${set.ext}`,
    stickerUrl: stickerUrl(set, i),
  })),
}));

export const toPicked = (s: StickerData): PickedSticker => ({
  url: s.stickerUrl,
  name: s.name,
  animated: s.stickerUrl.endsWith(".tgs"),
});
