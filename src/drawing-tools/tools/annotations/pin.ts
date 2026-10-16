import { Note, type NoteOptions } from './note';

export type PinOptions = NoteOptions;

/** Anchored Note - a note that keeps its spot on the pane while the chart is scrolled or zoomed. */
export class Pin extends Note {
  override readonly type: string = 'pin';
  protected override readonly pixelAnchored: boolean = true;
}
