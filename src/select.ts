/**
 * Selecting whole lines from the gutter, and the "Go to relative line"
 * command, as plain arithmetic on line numbers: which lines a click stands
 * for, where the selection starts and ends, and which line `+12` reaches.
 * Folds count the way the gutter counts them: a folded section is one row.
 */
import type { LineIndex } from './numbers.ts';

/** A run of whole lines, 1-based and inclusive. */
export type LineSpan = readonly [first: number, last: number];

/** What the selection math needs from a document. */
export interface DocLines {
  /** Number of lines; at least 1. */
  readonly lines: number;
  /** Length of the whole text. */
  readonly length: number;
  /** Offset where a line (1-based) starts. */
  lineStart(line: number): number;
}

/**
 * The lines one gutter row stands for, from the first line of the row to the
 * last: a plain line is itself, a folded heading takes every line its fold
 * hides. `from`..`to` are the lines CodeMirror drew as one block (a fold, or
 * a rendered table in Live Preview); usually the same line.
 */
export function rowSpan(from: number, to: number, index: LineIndex): LineSpan {
  return [index.shownLine(Math.min(from, to)), index.rowEnd(Math.max(from, to))];
}

function lineAfter(line: number, doc: DocLines): number {
  return line < doc.lines ? doc.lineStart(line + 1) : doc.length;
}

/**
 * The selection from the row clicked first (`anchor`) to the row under the
 * pointer now (`head`), the way a code editor selects from its line numbers:
 * whole lines, line break included, so the selection ends at the start of
 * the next line, or at the end of the note on its last line. Dragging upwards
 * puts the head at the top, so the selection keeps both rows whole.
 */
export function lineSelection(anchor: LineSpan, head: LineSpan, doc: DocLines): { anchor: number; head: number } {
  if (head[0] >= anchor[0]) {
    return { anchor: doc.lineStart(anchor[0]), head: lineAfter(Math.max(anchor[1], head[1]), doc) };
  }
  return { anchor: lineAfter(anchor[1], doc), head: doc.lineStart(head[0]) };
}

/** What the user typed into "Go to relative line". */
export type LineTarget = { kind: 'relative'; delta: number } | { kind: 'absolute'; line: number };

/**
 * `+12` and `-5` move that many rows down or up from the cursor, `42` goes to
 * line 42. Spaces around the text and between sign and digits are ignored,
 * and the typographic minus counts as `-`. Anything else is not a target.
 */
export function parseLineTarget(text: string): LineTarget | null {
  const match = /^\s*([+\-−]?)\s*(\d{1,9})\s*$/.exec(text);
  if (!match) return null;
  const count = Number(match[2]);
  if (match[1] === '') return { kind: 'absolute', line: count };
  return { kind: 'relative', delta: match[1] === '+' ? count : -count };
}

/**
 * The line a target lands on, never inside a fold: a relative move counts a
 * folded section as one row (so `+3` reaches the line the gutter labels 3),
 * a line hidden in a fold lands on the fold's first line, and anything past
 * either end of the note stops at the first or last line.
 */
export function resolveTarget(target: LineTarget, cursorLine: number, lineCount: number, index: LineIndex): number {
  const last = Math.max(lineCount, 1);
  if (target.kind === 'absolute') return index.shownLine(Math.min(Math.max(target.line, 1), last));
  const lastRow = index.screenRow(last);
  const row = Math.min(Math.max(index.screenRow(cursorLine) + target.delta, 1), lastRow);
  return index.lineAtRow(row);
}

/** Where the cursor goes on a line it jumps to: the first character that is not a space or tab, as in Vim. */
export function firstNonBlank(text: string): number {
  return /^[ \t]*/.exec(text)?.[0].length ?? 0;
}
