import type { Anchor, DrawingOptions, DrawingStyle, DrawingToolDefinition, IDrawing } from '../../core/types';

import { AnchoredVolumeProfile } from './anchored-volume-profile';
import { AnchoredVwap } from './anchored-vwap';
import { FixedRangeVolumeProfile } from './fixed-range-volume-profile';
import { GhostFeed } from './ghost-feed';
import { PositionForecast } from './position-forecast';
import { Sector } from './sector';

export { PositionForecast, type PositionForecastOptions } from './position-forecast';
export { PositionForecastPaneView } from './position-forecast-pane-view';
export { GhostFeed, type GhostFeedOptions } from './ghost-feed';
export { Sector, type SectorOptions } from './sector';
export { SectorPaneView } from './sector-pane-view';
export { AnchoredVwap, type AnchoredVwapOptions, type AnchoredVwapPoint } from './anchored-vwap';
export { AnchoredVwapPaneView } from './anchored-vwap-pane-view';
export {
  FixedRangeVolumeProfile,
  type FixedRangeVolumeProfileOptions,
  type VolumeProfileRenderData,
} from './fixed-range-volume-profile';
export { FixedRangeVolumeProfilePaneView } from './fixed-range-volume-profile-pane-view';
export {
  AnchoredVolumeProfile,
  type AnchoredVolumeProfileOptions,
  type AnchoredVolumeProfileRenderData,
} from './anchored-volume-profile';
export { AnchoredVolumeProfilePaneView } from './anchored-volume-profile-pane-view';

export type ForecastExtraToolDefinition = DrawingToolDefinition & {
  factory: (id: string, anchors?: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<DrawingOptions>) => IDrawing;
};

export const FORECAST_EXTRA_TOOL_DEFINITIONS: ForecastExtraToolDefinition[] = [
  {
    type: 'position-forecast',
    name: 'Position Forecast',
    category: 'forecasting',
    requiredAnchors: 3,
    factory: (id, anchors, style, options) => new PositionForecast(id, anchors, style, options),
  },
  {
    type: 'ghost-feed',
    name: 'Ghost Feed',
    category: 'forecasting',
    requiredAnchors: 2,
    factory: (id, anchors, style, options) => new GhostFeed(id, anchors, style, options),
  },
  {
    type: 'sector',
    name: 'Sector',
    category: 'forecasting',
    requiredAnchors: 2,
    factory: (id, anchors, style, options) => new Sector(id, anchors, style, options),
  },
  {
    type: 'anchored-vwap',
    name: 'Anchored VWAP',
    category: 'forecasting',
    requiredAnchors: 1,
    factory: (id, anchors, style, options) => new AnchoredVwap(id, anchors, style, options),
  },
  {
    type: 'fixed-range-volume-profile',
    name: 'Fixed Range Volume Profile',
    category: 'forecasting',
    requiredAnchors: 2,
    factory: (id, anchors, style, options) => new FixedRangeVolumeProfile(id, anchors, style, options),
  },
  {
    type: 'anchored-volume-profile',
    name: 'Anchored Volume Profile',
    category: 'forecasting',
    requiredAnchors: 1,
    factory: (id, anchors, style, options) => new AnchoredVolumeProfile(id, anchors, style, options),
  },
];
