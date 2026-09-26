/**
 * What goes in the gutter, with no editor involved: the line under the
 * cursor, the lines hidden inside folds, and the chosen mode decide every
 * label, so all of it is plain arithmetic that tests can reach.
 */

/**
 * - `relative`: distance from the cursor on every line, 0 on the cursor line.
 * - `hybrid`: distance on every line, the real line number on the cursor line.
 * - `absolute`: the real line number everywhere.
 */
export type NumberMode = 'relative' | 'hybrid' | 'absolute';

export const NUMBER_MODES: readonly NumberMode[] = ['hybrid', 'relative', 'absolute'];

export function isNumberMode(value: unknown): value is NumberMode {
  return typeof value === 'string' && (NUMBER_MODES as readonly string[]).includes(value);
}

/** A run of lines hidden by one fold, 1-based and inclusive. */
export type HiddenSpan = readonly [first: number, last: number];

/**
 * Turns fold ranges, given as the line each fold starts on and the line it
 * ends on, into the lines they hide. A fold keeps its first line visible (it
 * is the heading or list item that was folded) and hides the rest. Nested and
 * overlapping folds collapse into one span.
 */
export function hiddenSpans(folds: Iterable<readonly [startLine: number, endLine: number]>): HiddenSpan[] {
  const spans = [...folds]
    .map(([start, end]): [number, number] => [start + 1, end])
    .filter(([first, last]) => first <= last)
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const previous = merged[merged.length - 1];
    if (previous && span[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], span[1]);
    else merged.push([span[0], span[1]]);
  }
  return merged;
}

/**
 * Answers "how many screen rows apart are these two lines" when folds are
 * taken into account, the way Vim counts `5j`: a folded section is one line.
 */
export class LineIndex {
  private readonly spans: readonly HiddenSpan[];
  /** hiddenBefore[i] is how many lines spans[0..i-1] hide. */
  private readonly hiddenBefore: number[];

  constructor(spans: readonly HiddenSpan[] = []) {
    this.spans = spans;
    this.hiddenBefore = [0];
    for (const [first, last] of spans) {
      this.hiddenBefore.push(this.hiddenBefore[this.hiddenBefore.length - 1] + last - first + 1);
    }
  }

  /** Index of the last span starting at or before `line`, or -1. */
  private spanAt(line: number): number {
    let low = 0;
    let high = this.spans.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.spans[mid][0] <= line) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found;
  }

  /** The line that shows on screen for `line`: itself, or the fold's first line when it is hidden. */
  shownLine(line: number): number {
    const i = this.spanAt(line);
    if (i >= 0 && line <= this.spans[i][1]) return this.spans[i][0] - 1;
    return line;
  }

  /** Position of `line` counting only lines that are on screen. */
  screenRow(line: number): number {
    const shown = this.shownLine(line);
    const i = this.spanAt(shown);
    // `shown` is visible, so every span up to and including i lies before it.
    return shown - this.hiddenBefore[i + 1];
  }

  distance(line: number, cursorLine: number): number {
    return Math.abs(this.screenRow(line) - this.screenRow(cursorLine));
  }
}

export interface LabelContext {
  mode: NumberMode;
  cursorLine: number;
  index: LineIndex;
}

/** The text for one line's gutter cell. */
export function lineLabel(line: number, { mode, cursorLine, index }: LabelContext): string {
  if (mode === 'absolute') return String(line);
  const onCursor = index.shownLine(cursorLine) === line;
  if (onCursor) return mode === 'hybrid' ? String(line) : '0';
  return String(index.distance(line, cursorLine));
}

/**
 * The widest label the gutter can need, so its width is fixed per note and
 * does not jump as the cursor moves: the note's last line number, which is
 * never narrower than any distance inside the note.
 */
export function widestLabel(lineCount: number): string {
  return '9'.repeat(String(Math.max(lineCount, 1)).length);
}
