/** Original symbol catalogue for the Icon / Emoji picker: plain Unicode characters, no third-party glyph set. */

export interface GlyphSection {
  id: string;
  title: string;
  glyphs: string[];
}

const chars = (s: string) => s.split(/\s+/).filter(Boolean);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i));

export const ICON_SECTIONS: GlyphSection[] = [
  { id: "smileys", title: "Gestures & smileys", glyphs: chars("☝ ☜ ☞ ☟ ✌ ✍ ☺ ☹ ☻ ☠ ☃ ☯ ♿") },
  {
    id: "flags",
    title: "Symbols & flags",
    glyphs: chars(
      "⚑ ⚐ ♥ ♡ ★ ☆ ✓ ✔ ✗ ✘ ✖ ✚ ➕ ➖ ⚠ ⚡ ? ! ℹ ⏻ ↻ ⟳ ⌖ ◎ ◉ ● ○ ✱ ✲ ✳ ❖ ✪ ✯ ⚙ ☎ ✉ ☑ ☒ ⛔ ⊘ ⊕ ⊖ ⊗ ➤ ✦ ✧ ⏏ ⚓ ♠ ♣ ♦",
    ),
  },
  { id: "nature", title: "Nature", glyphs: chars("☀ ☁ ☂ ☾ ❄ ☘ ✿ ❀ ⚘ ☄") },
  { id: "currency", title: "Currency", glyphs: chars("€ £ $ ₹ ¥ ₽ ₩ ₺ ₿") },
  { id: "objects", title: "Objects", glyphs: chars("⌛ ⌚ ✂ ✎ ✏ ✐ ✆ ⌨ ☏ ⚖ ⚒ ⚔ ✈ ☕ ⚗ ♫ ♪ ⚽ ⚾") },
  { id: "arrows", title: "Arrows", glyphs: chars("← ↑ → ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇦ ⇧ ⇨ ⇩ ➔ ➜ ➡ ⬅ ⬆ ⬇ ↩ ↪ ↺ ⤴ ⤵") },
];

export const EMOJI_SECTIONS: GlyphSection[] = [
  { id: "people", title: "Smiles & people", glyphs: [...range(0x1f600, 0x1f64f), ...range(0x1f910, 0x1f92f)] },
  { id: "animals", title: "Animals & nature", glyphs: [...range(0x1f400, 0x1f43f), ...range(0x1f980, 0x1f9ae)] },
  { id: "food", title: "Food & drink", glyphs: range(0x1f345, 0x1f37f) },
  {
    id: "sports",
    title: "Activities",
    glyphs: [...chars("⚽ ⚾ ⛳"), ...range(0x1f3c0, 0x1f3ca), ...range(0x1f3cf, 0x1f3d3), ...chars("🥊 🥋 🥇 🥈 🥉 🏆 🏅 🎯 🎮 🎲")],
  },
  { id: "travel", title: "Travel & places", glyphs: range(0x1f680, 0x1f6c5) },
  { id: "objects", title: "Objects", glyphs: [...range(0x1f4a1, 0x1f4a9), ...range(0x1f4b0, 0x1f4ff)] },
  {
    id: "symbols",
    title: "Symbols",
    glyphs: [...range(0x1f493, 0x1f49f), ...chars("❤ ✅ ❌ ❓ ❗ ⭐ 🔥 💯 💥 💫 ⚠ ⛔ 🚫 ➕ ➖ ➗ ✔ ➡ ⬅ ⬆ ⬇ 🔔 🔕 🔴 🟠 🟡 🟢 🔵 🟣")],
  },
  { id: "flags", title: "Flags", glyphs: chars("🏁 🚩 🏳 🏴 🎌 🇺🇸 🇬🇧 🇪🇺 🇯🇵 🇨🇳 🇩🇪 🇫🇷 🇨🇦 🇦🇺 🇨🇭 🇮🇳 🇧🇷 🇰🇷") },
];

/** Keeps pictographs in text (monochrome) presentation so they take the chosen colour. */
export const asText = (glyph: string) => glyph + "\uFE0E";
