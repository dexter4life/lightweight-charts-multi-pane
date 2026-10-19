import { UiProvider } from "@ui/core";
import "@ui/core/styles.css";
import { StickerPicker } from "@ui/Sticker";
import { Component } from "react";
import { STICKER_SECTIONS, toPicked, type PickedSticker } from "../../stickers/catalog";

const RECENT_KEY = "chartlab.recentStickers";

type Recent = Parameters<NonNullable<React.ComponentProps<typeof StickerPicker>["onRecentStickersChange"]>>[0];

const loadRecent = (): Recent => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
};

const STICKER_HUB = [{ id: "all", label: "All stickers", section: STICKER_SECTIONS }];

interface StickerPanelProps {
  maxHeight: number;
  onSelect(sticker: PickedSticker): void;
}

interface StickerPanelState {
  recent: Recent;
}

/** The ui-sdk sticker picker with its "recent" list persisted to localStorage. */
export class StickerPanel extends Component<StickerPanelProps, StickerPanelState> {
  state: StickerPanelState = { recent: loadRecent() };

  private changeRecent = (recent: Recent) => {
    this.setState({ recent });
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {
      /* storage unavailable */
    }
  };

  render() {
    return (
      <UiProvider>
        <StickerPicker
          sections={STICKER_SECTIONS}
          stickerHub={STICKER_HUB}
          maxHeight={this.props.maxHeight}
          recentStickers={this.state.recent}
          onRecentStickersChange={this.changeRecent}
          onStickerSelect={(sticker) => this.props.onSelect(toPicked(sticker))}
          addStickerClicked={() => {}}
        />
      </UiProvider>
    );
  }
}
