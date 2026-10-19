/** Bundled sticker sets served from /stickers/sets/<id>/<n>.<ext>. */
export interface StickerSetInfo {
  id: string;
  title: string;
  ext: "tgs" | "webp";
  count: number;
  emoji: string;
}

export const STICKER_SETS: StickerSetInfo[] = [
  { id: "AnimatedCats", title: "😺cats", ext: "tgs", count: 10, emoji: "😝" },
  { id: "BrofistPewDiePie", title: "PewDiePie", ext: "webp", count: 32, emoji: "😂" },
  { id: "bubocat", title: "Bubo the Scarfcat", ext: "tgs", count: 25, emoji: "😂" },
  { id: "DogeTheDog", title: "Doge", ext: "webp", count: 16, emoji: "🐶" },
  { id: "doraemon1", title: "doraemon", ext: "webp", count: 21, emoji: "✨" },
  { id: "FunkyGoose", title: "Funky Goose", ext: "tgs", count: 41, emoji: "😂" },
  { id: "FurSeal", title: "Seal it!", ext: "webp", count: 21, emoji: "😆" },
  { id: "GamerGirL", title: "Gamer Girl", ext: "tgs", count: 22, emoji: "😂" },
  { id: "HotCherry", title: "Hot Cherry", ext: "tgs", count: 34, emoji: "😂" },
  { id: "Joker", title: "Joker", ext: "tgs", count: 16, emoji: "😂" },
  { id: "LamaProblama", title: "Lama", ext: "tgs", count: 25, emoji: "😂" },
  { id: "LittleCatto", title: "Little Catto", ext: "tgs", count: 25, emoji: "😂" },
  { id: "MicrosoftBillGates", title: "Bill Gates", ext: "webp", count: 30, emoji: "😂" },
  { id: "MrFloret", title: "Mr. Floret", ext: "tgs", count: 20, emoji: "😂" },
  { id: "MrPugDog", title: "Penny Pug", ext: "tgs", count: 22, emoji: "😂" },
  { id: "Orangoutang", title: "Orangoutang", ext: "tgs", count: 27, emoji: "😂" },
  { id: "PepeVampire", title: "Vampire Frog @westm1nster", ext: "tgs", count: 14, emoji: "😘" },
  { id: "PopTartCat", title: "Nyan Cat", ext: "webp", count: 25, emoji: "😂" },
  { id: "PrincessBubblegum", title: "Princess Bubblegum", ext: "tgs", count: 20, emoji: "😂" },
  { id: "RageMemes", title: "Meme Sticker Pack", ext: "webp", count: 75, emoji: "👨" },
  { id: "RageMemes2", title: "Meme Sticker Pack 2", ext: "webp", count: 1, emoji: "🔵" },
  { id: "RoboCatBot", title: "BOT CAT", ext: "tgs", count: 20, emoji: "😂" },
];
