import { Component } from "react";
import type { ReactNode } from "react";
import type * as React from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import type { ControllerState } from "../../controller";
import { ALL_ITEMS, GROUPS, type GroupItem, type ToolGroup } from "../../data/tool-groups";
import { FavoritesStarIcon, Icons, toolIcons } from "../icons";
import { GlyphPicker } from "../common/GlyphPicker";
import { Favorites } from "./Favorites";
import styles from "./LeftBar.module.css";
import { ToolbarTooltip } from "./ToolbarTooltip";
import { cx, placeSidePopup, readStorage, type PopupPlacement, writeStorage } from "./utils";

const GROUP_KEY = "chartlab.toolGroups";
const FAVORITES_KEY = "chartlab.favorites";
const FAVORITES_VISIBLE_KEY = "chartlab.favorites.visible";
const TIP_KEYS: Partial<Record<string, string[]>> = { magnet: ["⌘"], hide: ["⌘", "⌥", "H"] };

type MenuKind = "magnet" | "hide" | "remove";

interface TooltipState {
  anchor: HTMLElement;
  text: string;
  keys: string[];
  above?: boolean;
}

interface LeftBarState {
  ctlState: ControllerState;
  currentGroupIds: Record<string, string>;
  favorites: string[];
  favoritesVisible: boolean;
  glyphAnchor: HTMLElement | null;
  openFlyoutGroup: string | null;
  openMenu: MenuKind | null;
  tooltip: TooltipState | null;
  aboveTooltip: TooltipState | null;
}

const GROUP_ORDER = ["cursors", "lines", "fib", "patterns", "forecasting", "shapes", "text", "icons"];

const SmileyIcon = () => (
  <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <circle cx="14" cy="14" r="8.5" />
    <circle cx="11.2" cy="12" r=".6" fill="currentColor" />
    <circle cx="16.8" cy="12" r=".6" fill="currentColor" />
    <path d="M10.5 16.5c1 1.6 2.100 2.300 3.500 2.300s2.500-.7 3.500-2.300" />
  </svg>
);

export class LeftBar extends Component<object, LeftBarState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  private groupWrapRefs = new Map<string, HTMLDivElement | null>();
  private actionWrapRefs = new Map<string, HTMLDivElement | null>();
  private unsubscribe: (() => void) | null = null;

  constructor(props: object, context: React.ContextType<typeof LabContext>) {
    super(props, context);
    this.state = {
      ctlState: context.engine.ctl.getState(),
      currentGroupIds: this.loadGroupIds(),
      favorites: this.loadFavorites(),
      favoritesVisible: readStorage<boolean>(FAVORITES_VISIBLE_KEY, true),
      glyphAnchor: null,
      openFlyoutGroup: null,
      openMenu: null,
      tooltip: null,
      aboveTooltip: null,
    };
  }

  componentDidMount() {
    this.unsubscribe = this.context.engine.ctl.subscribe(this.syncFromController);
    this.syncFromController();
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  private loadGroupIds() {
    const stored = readStorage<Record<string, string>>(GROUP_KEY, {});
    const current: Record<string, string> = {};
    for (const group of GROUPS) current[group.id] = group.items.find((item) => item.id === stored[group.id])?.id ?? group.items[0].id;
    return current;
  }

  private loadFavorites() {
    const stored = readStorage<unknown[]>(FAVORITES_KEY, []);
    return stored.filter((id): id is string => typeof id === "string" && ALL_ITEMS.some((item) => item.id === id));
  }

  private syncFromController = () => {
    const ctlState = this.context.engine.ctl.getState();
    const nextGroupIds = { ...this.state.currentGroupIds };
    let changed = false;
    for (const group of GROUPS) {
      const active =
        group.items.find((item) => item.id === ctlState.tool) ??
        (group.id === "icons" && (ctlState.tool === "emoji" || ctlState.tool === "sticker") ? group.items[0] : undefined);
      if (active && nextGroupIds[group.id] !== active.id) {
        nextGroupIds[group.id] = active.id;
        changed = true;
      }
    }
    if (changed) writeStorage(GROUP_KEY, nextGroupIds);
    this.setState({ ctlState, currentGroupIds: nextGroupIds });
  };

  private currentGroupItem(group: ToolGroup) {
    return group.items.find((item) => item.id === this.state.currentGroupIds[group.id]) ?? group.items[0];
  }

  private isGroupActive(group: ToolGroup) {
    return group.items.some((item) => item.id === this.state.ctlState.tool) || (group.id === "icons" && (this.state.ctlState.tool === "emoji" || this.state.ctlState.tool === "sticker"));
  }

  private saveGroupChoice(group: ToolGroup, item: GroupItem) {
    this.setState(
      (state) => ({ currentGroupIds: { ...state.currentGroupIds, [group.id]: item.id } }),
      () => writeStorage(GROUP_KEY, this.state.currentGroupIds),
    );
  }

  private toggleFavorite = (id: string) => {
    this.setState((state) => {
      const adding = !state.favorites.includes(id);
      const favorites = adding ? [...state.favorites, id] : state.favorites.filter((entry) => entry !== id);
      const favoritesVisible = adding && favorites.length === 1 ? true : state.favoritesVisible;
      writeStorage(FAVORITES_KEY, favorites);
      writeStorage(FAVORITES_VISIBLE_KEY, favoritesVisible);
      return { favorites, favoritesVisible };
    });
  };

  private toggleFavoritesVisible = () => {
    this.setState(
      (state) => {
        const favoritesVisible = !state.favoritesVisible;
        writeStorage(FAVORITES_VISIBLE_KEY, favoritesVisible);
        return { favoritesVisible };
      },
      this.hideTooltip,
    );
  };

  private toggleGlyphPicker = (anchor: HTMLElement) => {
    this.setState((state) => ({
      glyphAnchor: state.glyphAnchor === anchor ? null : anchor,
      openFlyoutGroup: null,
      openMenu: null,
      tooltip: null,
      aboveTooltip: null,
    }));
  };

  private openFlyout = (groupId: string) => {
    this.setState((state) => ({
      openFlyoutGroup: state.openFlyoutGroup === groupId ? null : groupId,
      openMenu: null,
      glyphAnchor: null,
      tooltip: null,
      aboveTooltip: null,
    }));
  };

  private openMenu = (kind: MenuKind) => {
    this.setState((state) => ({
      openMenu: state.openMenu === kind ? null : kind,
      openFlyoutGroup: null,
      glyphAnchor: null,
      tooltip: null,
      aboveTooltip: null,
    }));
  };

  private showTooltip = (anchor: HTMLElement, text: string, keys: string[] = []) => {
    this.setState({ tooltip: { anchor, text, keys } });
  };

  private hideTooltip = () => {
    this.setState({ tooltip: null });
  };

  private showAboveTooltip = (anchor: HTMLElement, text: string) => {
    this.setState({ aboveTooltip: { anchor, text, keys: [], above: true } });
  };

  private hideAboveTooltip = () => {
    this.setState({ aboveTooltip: null });
  };

  private setGroupWrapRef = (id: string) => (node: HTMLDivElement | null) => {
    this.groupWrapRefs.set(id, node);
  };

  private setActionWrapRef = (id: string) => (node: HTMLDivElement | null) => {
    this.actionWrapRefs.set(id, node);
  };

  private renderButton(icon: ReactNode, title: string, onClick: () => void, options: { active?: boolean; keys?: string[]; className?: string } = {}) {
    return (
      <button
        type="button"
        className={cx(styles.tbBtn, options.active && styles.active, options.className)}
        aria-label={title}
        onClick={onClick}
        onMouseEnter={(event) => this.showTooltip(event.currentTarget, title, options.keys ?? [])}
        onMouseLeave={this.hideTooltip}
      >
        {icon}
      </button>
    );
  }

  render() {
    const { engine, ui } = this.context;
    const { ctlState } = this.state;
    const magnetTitle = "Magnet Mode snaps drawings placed near price bars to the closest OHLC value";
    const hideTitle =
      ctlState.hideMode === "all"
        ? "Hide all drawings"
        : `${ctlState.hideMode !== "none" ? "Show" : "Hide"} all ${ctlState.hideKind === "indicators" ? "indicators" : "drawings"}`;
    const removeTitle = `Remove ${ctlState.count} drawing${ctlState.count === 1 ? "" : "s"}`;
    const openFlyoutGroup = this.state.openFlyoutGroup ? GROUPS.find((group) => group.id === this.state.openFlyoutGroup) ?? null : null;
    const flyoutAnchor = openFlyoutGroup ? this.groupWrapRefs.get(openFlyoutGroup.id) ?? null : null;
    const menuAnchor = this.state.openMenu ? this.actionWrapRefs.get(this.state.openMenu) ?? null : null;
    const menuItems: Record<MenuKind, ToolbarMenuItem[]> = {
      magnet: [
        { label: "Weak Magnet", icon: <Icons.magnet />, active: ctlState.magnetKind === "weak", onPick: () => engine.ctl.setMagnet("weak") },
        { label: "Strong Magnet", icon: <Icons.magnetStrong />, active: ctlState.magnetKind === "strong", onPick: () => engine.ctl.setMagnet("strong") },
      ],
      hide: [
        { label: "Hide drawings", active: ctlState.hideMode === "drawings", onPick: () => engine.ctl.setHideMode("drawings") },
        { label: "Hide indicators", active: ctlState.hideMode === "indicators", onPick: () => engine.ctl.setHideMode("indicators") },
        { label: "Hide all", active: ctlState.hideMode === "all", onPick: () => engine.ctl.setHideMode("all") },
      ],
      remove: [
        { label: `Remove ${ctlState.count} drawing${ctlState.count === 1 ? "" : "s"}`, active: false, onPick: () => engine.ctl.removeAll() },
        { label: "Remove 0 indicators", active: false, onPick: () => undefined },
        { label: `Remove ${ctlState.count} drawing${ctlState.count === 1 ? "" : "s"} & 0 indicators`, active: false, onPick: () => engine.ctl.removeAll() },
      ],
    };

    return (
      <>
        <div onMouseDownCapture={this.hideTooltip}>
          <div className={styles.tbGroup}>
            {GROUP_ORDER.map((id) => GROUPS.find((entry) => entry.id === id)!).map((group) => {
              const item = this.currentGroupItem(group);
              const active = this.isGroupActive(group);
              const ItemIcon = group.id === "icons" ? SmileyIcon : toolIcons[item.id];
              return (
                <div
                  key={group.id}
                  ref={this.setGroupWrapRef(group.id)}
                  className={cx(styles.tbItem, this.state.openFlyoutGroup === group.id && styles.open)}
                  data-toolbar-item={group.id}
                >
                  <button
                    type="button"
                    className={cx(styles.tbBtn, active && styles.active)}
                    aria-label={item.label}
                    onClick={(event) => {
                      if (group.id === "icons") this.toggleGlyphPicker(event.currentTarget);
                      else engine.ctl.setTool(item.id);
                    }}
                    onMouseEnter={(event) => this.showTooltip(event.currentTarget, item.label)}
                    onMouseLeave={this.hideTooltip}
                  >
                    {ItemIcon ? <ItemIcon /> : null}
                  </button>
                  {group.items.length > 1 && (
                    <button
                      type="button"
                      className={styles.tbArrow}
                      aria-label={group.title}
                      onClick={(event) => {
                        event.stopPropagation();
                        this.openFlyout(group.id);
                      }}
                    >
                      <Icons.chevron />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className={styles.tbSep} />
          <div className={styles.tbGroup}>
            <div ref={this.setActionWrapRef("measure")} className={styles.tbItem} data-toolbar-item="measure">
              {this.renderButton(<Icons.measure />, "Measure", () => engine.ctl.setTool("measure"), { active: ctlState.tool === "measure" })}
            </div>
            <div ref={this.setActionWrapRef("zoom_in")} className={styles.tbItem} data-toolbar-item="zoom_in">
              {this.renderButton(<Icons.zoomIn />, "Zoom In", () => engine.ctl.setTool("zoom_in"), { active: ctlState.tool === "zoom_in" })}
            </div>
            <div ref={this.setActionWrapRef("zoom_out")} className={styles.tbItem} style={{ display: ctlState.zoomDepth > 0 ? "" : "none" }} data-toolbar-item="zoom_out">
              {this.renderButton(<Icons.zoomOut />, "Zoom Out", () => engine.ctl.zoomOut())}
            </div>
          </div>
          <div className={styles.tbSep} />
          <div className={styles.tbGroup}>
            <div ref={this.setActionWrapRef("magnet")} className={cx(styles.tbItem, this.state.openMenu === "magnet" && styles.open)} data-toolbar-item="magnet">
              {this.renderButton(ctlState.magnetKind === "strong" ? <Icons.magnetStrong /> : <Icons.magnet />, magnetTitle, () => engine.ctl.toggleMagnet(), {
                active: ctlState.magnet !== "off",
                keys: TIP_KEYS.magnet,
              })}
              <button
                type="button"
                className={styles.tbArrow}
                aria-label="Magnet options"
                onClick={(event) => {
                  event.stopPropagation();
                  this.openMenu("magnet");
                }}
              >
                <Icons.chevron />
              </button>
            </div>
            <div ref={this.setActionWrapRef("stay")} className={styles.tbItem} data-toolbar-item="stay">
              {this.renderButton(<Icons.stay />, "Stay in Drawing Mode", () => engine.ctl.setStay(!ctlState.stay), { active: ctlState.stay })}
            </div>
            <div ref={this.setActionWrapRef("lock")} className={styles.tbItem} data-toolbar-item="lock">
              {this.renderButton(ctlState.locked ? <Icons.lock /> : <Icons.lockOpen />, "Lock All Drawing Tools", () => engine.ctl.setLocked(!ctlState.locked), {
                active: ctlState.locked,
              })}
            </div>
            <div ref={this.setActionWrapRef("hide")} className={cx(styles.tbItem, this.state.openMenu === "hide" && styles.open)} data-toolbar-item="hide">
              {this.renderButton(ctlState.hideMode !== "none" ? <Icons.eyeOff /> : <Icons.eye />, hideTitle, () => engine.ctl.toggleHide(), {
                active: ctlState.hideMode !== "none",
                keys: TIP_KEYS.hide,
              })}
              <button
                type="button"
                className={styles.tbArrow}
                aria-label="Hide options"
                onClick={(event) => {
                  event.stopPropagation();
                  this.openMenu("hide");
                }}
              >
                <Icons.chevron />
              </button>
            </div>
          </div>
          <div className={styles.tbSep} />
          <div className={styles.tbGroup}>
            <div ref={this.setActionWrapRef("remove")} className={cx(styles.tbItem, this.state.openMenu === "remove" && styles.open)} data-toolbar-item="remove">
              {this.renderButton(<Icons.trash />, removeTitle, () => engine.ctl.removeAll())}
              <button
                type="button"
                className={styles.tbArrow}
                aria-label="Remove options"
                onClick={(event) => {
                  event.stopPropagation();
                  this.openMenu("remove");
                }}
              >
                <Icons.chevron />
              </button>
            </div>
          </div>
          <div className={cx(styles.tbGroup, styles.tbBottom)}>
            <div ref={this.setActionWrapRef("favorites")} className={styles.tbItem} style={{ display: this.state.favorites.length ? "" : "none" }} data-toolbar-item="favorites">
              {this.renderButton(<Icons.star />, "Show Favorite Drawing Tools Toolbar", this.toggleFavoritesVisible, {
                className: this.state.favoritesVisible ? styles.favOn : undefined,
              })}
            </div>
          </div>
        </div>
        <Favorites ctl={engine.ctl} host={this.context.ui.chartArea() ?? engine.overlayHost} ids={this.state.favorites} visible={this.state.favoritesVisible} activeTool={ctlState.tool} />
        {this.state.glyphAnchor && (
          <GlyphPicker
            anchor={this.state.glyphAnchor}
            boundsEl={this.groupWrapRefs.get("icons") ?? undefined}
            onClose={() => this.setState({ glyphAnchor: null })}
          />
        )}
        {openFlyoutGroup && flyoutAnchor && (
          <ToolFlyout
            group={openFlyoutGroup}
            anchor={flyoutAnchor}
            activeTool={ctlState.tool}
            favorites={this.state.favorites}
            onClose={() => this.setState({ openFlyoutGroup: null, aboveTooltip: null })}
            onPick={(item) => {
              engine.ctl.setTool(item.id);
              this.saveGroupChoice(openFlyoutGroup, item);
              this.setState({ openFlyoutGroup: null, aboveTooltip: null });
            }}
            onToggleFavorite={this.toggleFavorite}
            onShowAboveTooltip={this.showAboveTooltip}
            onHideAboveTooltip={this.hideAboveTooltip}
          />
        )}
        {this.state.openMenu && menuAnchor && <ToolbarMenu anchor={menuAnchor} items={menuItems[this.state.openMenu]} onClose={() => this.setState({ openMenu: null })} />}
        {this.state.tooltip && <ToolbarTooltip anchor={this.state.tooltip.anchor} text={this.state.tooltip.text} keys={this.state.tooltip.keys} />}
        {this.state.aboveTooltip && <ToolbarTooltip anchor={this.state.aboveTooltip.anchor} text={this.state.aboveTooltip.text} above />}
      </>
    );
  }
}

interface ToolbarMenuItem {
  label: string;
  icon?: ReactNode;
  active: boolean;
  key?: string;
  onPick(): void;
}

interface ToolbarMenuProps {
  anchor: HTMLElement;
  items: ToolbarMenuItem[];
  onClose(): void;
}

interface PopupState {
  placement: PopupPlacement | null;
}

class ToolbarMenu extends Component<ToolbarMenuProps, PopupState> {
  state: PopupState = { placement: null };
  private menuRef: HTMLDivElement | null = null;

  componentDidMount() {
    document.addEventListener("mousedown", this.onOutside, true);
    document.addEventListener("keydown", this.onEscape, true);
    window.addEventListener("resize", this.updatePlacement);
    this.updatePlacement();
  }

  componentDidUpdate() {
    this.updatePlacement();
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("keydown", this.onEscape, true);
    window.removeEventListener("resize", this.updatePlacement);
  }

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.menuRef?.contains(target) || this.props.anchor.contains(target)) return;
    this.props.onClose();
  };

  private onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.props.onClose();
  };

  private setMenuRef = (node: HTMLDivElement | null) => {
    this.menuRef = node;
    if (node) this.updatePlacement();
  };

  private updatePlacement = () => {
    if (!this.menuRef) return;
    const placement = placeSidePopup(this.props.anchor, this.menuRef, -6);
    const current = this.state.placement;
    if (!current || current.left !== placement.left || current.top !== placement.top || current.maxHeight !== placement.maxHeight) {
      this.setState({ placement });
    }
  };

  render() {
    const plain = this.props.items.every((item) => !item.icon);
    const style = this.state.placement
      ? { left: this.state.placement.left, top: this.state.placement.top, maxHeight: this.state.placement.maxHeight }
      : { visibility: "hidden" as const };
    return createPortal(
      <div ref={this.setMenuRef} className={cx(styles.tbFlyout, styles.flySm, plain && styles.flyPlain)} style={style}>
        {this.props.items.map((item) => (
          <div
            key={item.label}
            className={cx(styles.flyItem, item.active && styles.sel)}
            onClick={() => {
              item.onPick();
              this.props.onClose();
            }}
          >
            {item.icon && <span className={styles.flyIco}>{item.icon}</span>}
            <span className={styles.flyLabel}>{item.label}</span>
            {item.key && <span className={styles.flyKey}>{item.key}</span>}
          </div>
        ))}
      </div>,
      document.body,
    );
  }
}

interface ToolFlyoutProps {
  group: ToolGroup;
  anchor: HTMLElement;
  activeTool: string;
  favorites: string[];
  onClose(): void;
  onPick(item: GroupItem): void;
  onToggleFavorite(id: string): void;
  onShowAboveTooltip(anchor: HTMLElement, text: string): void;
  onHideAboveTooltip(): void;
}

class ToolFlyout extends Component<ToolFlyoutProps, PopupState> {
  state: PopupState = { placement: null };
  private menuRef: HTMLDivElement | null = null;

  componentDidMount() {
    document.addEventListener("mousedown", this.onOutside, true);
    document.addEventListener("keydown", this.onEscape, true);
    window.addEventListener("resize", this.updatePlacement);
    this.updatePlacement();
  }

  componentDidUpdate() {
    this.updatePlacement();
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("keydown", this.onEscape, true);
    window.removeEventListener("resize", this.updatePlacement);
  }

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.menuRef?.contains(target) || this.props.anchor.contains(target)) return;
    this.props.onClose();
  };

  private onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.props.onClose();
  };

  private setMenuRef = (node: HTMLDivElement | null) => {
    this.menuRef = node;
    if (node) this.updatePlacement();
  };

  private updatePlacement = () => {
    if (!this.menuRef) return;
    const placement = placeSidePopup(this.props.anchor, this.menuRef, -5);
    const current = this.state.placement;
    if (!current || current.left !== placement.left || current.top !== placement.top || current.maxHeight !== placement.maxHeight) {
      this.setState({ placement });
    }
  };

  render() {
    const style = this.state.placement
      ? { left: this.state.placement.left, top: this.state.placement.top, maxHeight: this.state.placement.maxHeight }
      : { visibility: "hidden" as const };
    return createPortal(
      <div ref={this.setMenuRef} className={styles.tbFlyout} style={style}>
        {this.props.group.items.map((item) => {
          const favorite = this.props.favorites.includes(item.id);
          const ItemIcon = toolIcons[item.id];
          return (
            <div
              key={item.id}
              className={cx(styles.flyItem, styles.hasStar, item.hotkey && styles.hasKey, item.id === this.props.activeTool && styles.sel)}
              onClick={() => this.props.onPick(item)}
            >
              <span className={styles.flyIco}>{ItemIcon ? <ItemIcon /> : null}</span>
              <span className={styles.flyLabel}>{item.label}</span>
              {item.hotkey && <span className={styles.flyKey}>{item.hotkey.label}</span>}
              <span
                className={cx(styles.flyStar, favorite && styles.on)}
                onMouseEnter={(event) => this.props.onShowAboveTooltip(event.currentTarget, favorite ? "Remove from favorites" : "Add to favorites")}
                onMouseLeave={this.props.onHideAboveTooltip}
                onClick={(event) => {
                  event.stopPropagation();
                  this.props.onToggleFavorite(item.id);
                  this.props.onShowAboveTooltip(event.currentTarget as HTMLElement, favorite ? "Add to favorites" : "Remove from favorites");
                }}
              >
                <FavoritesStarIcon filled={favorite} />
              </span>
            </div>
          );
        })}
      </div>,
      document.body,
    );
  }
}
