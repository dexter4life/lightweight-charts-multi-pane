import type { Anchor, DrawingOptions, DrawingStyle, DrawingToolDefinition, IDrawing } from '../../core/types';

import { CyclicLines } from './cyclic-lines';
import { ElliottCorrectionWave } from './elliott-correction-wave';
import { ElliottDoubleCombo } from './elliott-double-combo';
import { ElliottImpulseWave } from './elliott-impulse-wave';
import { ElliottTriangleWave } from './elliott-triangle-wave';
import { ElliottTripleCombo } from './elliott-triple-combo';
import { SineLine } from './sine-line';
import { TimeCycles } from './time-cycles';
import { ABCDPattern, CypherPattern, HeadAndShouldersPattern, ThreeDrivesPattern, TrianglePattern } from './harmonic-patterns';
import { XABCDPattern } from './xabcd-pattern';

export { CyclicLines, type CyclicLinesOptions } from './cyclic-lines';
export { TimeCycles, type TimeCyclesOptions } from './time-cycles';
export { SineLine, type SineLineOptions } from './sine-line';
export { XABCDPattern, type XABCDPatternOptions } from './xabcd-pattern';
export { XABCDPatternPaneView } from './xabcd-pattern-pane-view';
export {
  CypherPattern,
  ABCDPattern,
  TrianglePattern,
  ThreeDrivesPattern,
  HeadAndShouldersPattern,
  type CypherPatternOptions,
  type ABCDPatternOptions,
  type TrianglePatternOptions,
  type ThreeDrivesPatternOptions,
  type HeadAndShouldersOptions,
} from './harmonic-patterns';
export { ElliottImpulseWave, type ElliottImpulseWaveOptions } from './elliott-impulse-wave';
export { ElliottCorrectionWave, type ElliottCorrectionWaveOptions } from './elliott-correction-wave';
export { ElliottTriangleWave, type ElliottTriangleWaveOptions } from './elliott-triangle-wave';
export { ElliottDoubleCombo, type ElliottDoubleComboOptions } from './elliott-double-combo';
export { ElliottTripleCombo, type ElliottTripleComboOptions } from './elliott-triple-combo';
export { CycleDrawing, type CycleOptions } from './cycle-drawing';
export { ELLIOTT_DEGREES, ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';

export interface PatternToolDefinition extends DrawingToolDefinition {
  factory: (
    id: string,
    anchors?: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<DrawingOptions>
  ) => IDrawing;
}

export const PATTERN_TOOL_DEFINITIONS: PatternToolDefinition[] = [
  {
    type: 'cyclic-lines',
    name: 'Cyclic Lines',
    category: 'pattern',
    requiredAnchors: 2,
    factory: (id, anchors, style, options) => new CyclicLines(id, anchors, style, options),
  },
  {
    type: 'time-cycles',
    name: 'Time Cycles',
    category: 'pattern',
    requiredAnchors: 2,
    factory: (id, anchors, style, options) => new TimeCycles(id, anchors, style, options),
  },
  {
    type: 'sine-line',
    name: 'Sine Line',
    category: 'pattern',
    requiredAnchors: 2,
    factory: (id, anchors, style, options) => new SineLine(id, anchors, style, options),
  },
  {
    type: 'xabcd-pattern',
    name: 'XABCD Pattern',
    category: 'pattern',
    requiredAnchors: 5,
    factory: (id, anchors, style, options) => new XABCDPattern(id, anchors, style, options),
  },
  {
    type: 'cypher-pattern',
    name: 'Cypher Pattern',
    category: 'pattern',
    requiredAnchors: 5,
    factory: (id, anchors, style, options) => new CypherPattern(id, anchors, style, options),
  },
  {
    type: 'head-and-shoulders',
    name: 'Head and Shoulders',
    category: 'pattern',
    requiredAnchors: 7,
    factory: (id, anchors, style, options) => new HeadAndShouldersPattern(id, anchors, style, options),
  },
  {
    type: 'abcd-pattern',
    name: 'ABCD Pattern',
    category: 'pattern',
    requiredAnchors: 4,
    factory: (id, anchors, style, options) => new ABCDPattern(id, anchors, style, options),
  },
  {
    type: 'triangle-pattern',
    name: 'Triangle Pattern',
    category: 'pattern',
    requiredAnchors: 4,
    factory: (id, anchors, style, options) => new TrianglePattern(id, anchors, style, options),
  },
  {
    type: 'three-drives-pattern',
    name: 'Three Drives Pattern',
    category: 'pattern',
    requiredAnchors: 7,
    factory: (id, anchors, style, options) => new ThreeDrivesPattern(id, anchors, style, options),
  },
  {
    type: 'elliott-impulse-wave',
    name: 'Elliott Impulse Wave (12345)',
    category: 'pattern',
    requiredAnchors: 6,
    factory: (id, anchors, style, options) => new ElliottImpulseWave(id, anchors, style, options),
  },
  {
    type: 'elliott-correction-wave',
    name: 'Elliott Correction Wave (ABC)',
    category: 'pattern',
    requiredAnchors: 4,
    factory: (id, anchors, style, options) => new ElliottCorrectionWave(id, anchors, style, options),
  },
  {
    type: 'elliott-triangle-wave',
    name: 'Elliott Triangle Wave (ABCDE)',
    category: 'pattern',
    requiredAnchors: 6,
    factory: (id, anchors, style, options) => new ElliottTriangleWave(id, anchors, style, options),
  },
  {
    type: 'elliott-double-combo',
    name: 'Elliott Double Combo Wave (WXY)',
    category: 'pattern',
    requiredAnchors: 4,
    factory: (id, anchors, style, options) => new ElliottDoubleCombo(id, anchors, style, options),
  },
  {
    type: 'elliott-triple-combo',
    name: 'Elliott Triple Combo Wave (WXYXZ)',
    category: 'pattern',
    requiredAnchors: 6,
    factory: (id, anchors, style, options) => new ElliottTripleCombo(id, anchors, style, options),
  },
];
