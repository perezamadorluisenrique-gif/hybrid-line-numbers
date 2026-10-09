import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LineIndex, hiddenSpans } from '../src/numbers.ts';
import { firstNonBlank, lineSelection, parseLineTarget, resolveTarget, rowSpan } from '../src/select.ts';
import type { DocLines, LineSpan } from '../src/select.ts';

function docOf(text: string): DocLines {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return { lines: starts.length, length: text.length, lineStart: (line) => starts[line - 1] };
}

/** The selected text, from `anchor` and `head` in either order. */
function selected(text: string, anchor: LineSpan, head: LineSpan): string {
  const sel = lineSelection(anchor, head, docOf(text));
  return text.slice(Math.min(sel.anchor, sel.head), Math.max(sel.anchor, sel.head));
}

const TEXT = ['one', 'two', 'three', 'four', 'five'].join('\n');

test('a click selects the whole line with its line break', () => {
  assert.equal(selected(TEXT, [2, 2], [2, 2]), 'two\n');
  assert.deepEqual(lineSelection([2, 2], [2, 2], docOf(TEXT)), { anchor: 4, head: 8 });
});

test('the last line selects to the end of the note', () => {
  assert.equal(selected(TEXT, [5, 5], [5, 5]), 'five');
  assert.equal(selected('a\nb\n', [3, 3], [3, 3]), '');
  assert.equal(selected('a\nb\n', [2, 2], [2, 2]), 'b\n');
});

test('dragging down selects every line in between, both ends whole', () => {
  assert.equal(selected(TEXT, [2, 2], [4, 4]), 'two\nthree\nfour\n');
  assert.deepEqual(lineSelection([2, 2], [4, 4], docOf(TEXT)), { anchor: 4, head: 19 });
});

test('dragging up puts the head at the top and keeps the first row whole', () => {
  assert.deepEqual(lineSelection([4, 4], [2, 2], docOf(TEXT)), { anchor: 19, head: 4 });
  assert.equal(selected(TEXT, [4, 4], [1, 1]), 'one\ntwo\nthree\nfour\n');
  assert.equal(selected(TEXT, [5, 5], [4, 4]), 'four\nfive');
});

test('a single-line note', () => {
  assert.deepEqual(lineSelection([1, 1], [1, 1], docOf('only')), { anchor: 0, head: 4 });
  assert.deepEqual(lineSelection([1, 1], [1, 1], docOf('')), { anchor: 0, head: 0 });
});

test('a folded heading stands for the lines its fold hides', () => {
  // Line 2 is folded over lines 3-4.
  const index = new LineIndex(hiddenSpans([[2, 4]]));
  assert.deepEqual(rowSpan(2, 2, index), [2, 4]);
  assert.deepEqual(rowSpan(3, 3, index), [2, 4], 'a hidden line belongs to its fold');
  assert.deepEqual(rowSpan(2, 4, index), [2, 4], 'the block CodeMirror draws for the fold');
  assert.deepEqual(rowSpan(1, 1, index), [1, 1]);
  assert.deepEqual(rowSpan(5, 5, index), [5, 5]);
  assert.equal(selected(TEXT, rowSpan(2, 2, index), rowSpan(2, 2, index)), 'two\nthree\nfour\n');
  assert.equal(selected(TEXT, rowSpan(5, 5, index), rowSpan(2, 2, index)), 'two\nthree\nfour\nfive');
});

test('a fold reaching the end of the note selects to the end', () => {
  const index = new LineIndex(hiddenSpans([[3, 5]]));
  assert.equal(selected(TEXT, rowSpan(3, 3, index), rowSpan(3, 3, index)), 'three\nfour\nfive');
});

test('a block of several lines (a rendered table) selects all of them', () => {
  const index = new LineIndex();
  assert.deepEqual(rowSpan(2, 4, index), [2, 4]);
  assert.deepEqual(rowSpan(4, 2, index), [2, 4]);
});

test('nested folds give the outer fold', () => {
  const index = new LineIndex(hiddenSpans([[2, 9], [4, 6]]));
  assert.deepEqual(rowSpan(2, 2, index), [2, 9]);
  assert.deepEqual(rowSpan(5, 5, index), [2, 9]);
});

test('two folds one after the other stay separate rows', () => {
  const index = new LineIndex(hiddenSpans([[1, 3], [4, 6]]));
  assert.deepEqual(rowSpan(1, 1, index), [1, 3]);
  assert.deepEqual(rowSpan(4, 4, index), [4, 6]);
});

test('targets: +N, -N and a line number', () => {
  assert.deepEqual(parseLineTarget('+12'), { kind: 'relative', delta: 12 });
  assert.deepEqual(parseLineTarget('-5'), { kind: 'relative', delta: -5 });
  assert.deepEqual(parseLineTarget('−5'), { kind: 'relative', delta: -5 });
  assert.deepEqual(parseLineTarget(' + 3 '), { kind: 'relative', delta: 3 });
  assert.deepEqual(parseLineTarget('42'), { kind: 'absolute', line: 42 });
  assert.deepEqual(parseLineTarget('0'), { kind: 'absolute', line: 0 });
  assert.deepEqual(parseLineTarget('+0'), { kind: 'relative', delta: 0 });
});

test('anything else is not a target', () => {
  for (const text of ['', ' ', '+', '-', 'abc', '12j', '1.5', '1e3', '--2', '+-2', '1 2', '1234567890']) {
    assert.equal(parseLineTarget(text), null, JSON.stringify(text));
  }
});

test('relative moves count rows, line numbers are absolute', () => {
  const index = new LineIndex();
  assert.equal(resolveTarget({ kind: 'relative', delta: 3 }, 5, 20, index), 8);
  assert.equal(resolveTarget({ kind: 'relative', delta: -4 }, 5, 20, index), 1);
  assert.equal(resolveTarget({ kind: 'relative', delta: 0 }, 5, 20, index), 5);
  assert.equal(resolveTarget({ kind: 'absolute', line: 12 }, 5, 20, index), 12);
});

test('moves past either end stop at the first or last line', () => {
  const index = new LineIndex();
  assert.equal(resolveTarget({ kind: 'relative', delta: 100 }, 5, 20, index), 20);
  assert.equal(resolveTarget({ kind: 'relative', delta: -100 }, 5, 20, index), 1);
  assert.equal(resolveTarget({ kind: 'absolute', line: 999 }, 5, 20, index), 20);
  assert.equal(resolveTarget({ kind: 'absolute', line: 0 }, 5, 20, index), 1);
});

test('a folded section is one row, as the gutter counts it', () => {
  // Line 3 is folded over 4-9: on screen 1 2 3 10 11 12.
  const index = new LineIndex(hiddenSpans([[3, 9]]));
  assert.equal(resolveTarget({ kind: 'relative', delta: 1 }, 2, 12, index), 3);
  assert.equal(resolveTarget({ kind: 'relative', delta: 2 }, 2, 12, index), 10);
  assert.equal(resolveTarget({ kind: 'relative', delta: -2 }, 11, 12, index), 3);
  assert.equal(resolveTarget({ kind: 'relative', delta: -3 }, 11, 12, index), 2);
  assert.equal(resolveTarget({ kind: 'relative', delta: 50 }, 1, 12, index), 12);
});

test('every relative move lands on the line whose label is that distance', () => {
  const folds: [number, number][] = [[3, 9], [12, 15], [20, 30]];
  const index = new LineIndex(hiddenSpans(folds));
  const lines = 40;
  const visible = [];
  for (let line = 1; line <= lines; line++) if (index.shownLine(line) === line) visible.push(line);
  for (const cursor of visible) {
    for (const target of visible) {
      const delta = visible.indexOf(target) - visible.indexOf(cursor);
      assert.equal(resolveTarget({ kind: 'relative', delta }, cursor, lines, index), target);
      assert.equal(index.distance(target, cursor), Math.abs(delta));
    }
  }
});

test('a line hidden in a fold lands on the fold, which stays closed', () => {
  const index = new LineIndex(hiddenSpans([[3, 9]]));
  assert.equal(resolveTarget({ kind: 'absolute', line: 6 }, 1, 12, index), 3);
  // A cursor inside the fold counts from the fold's row.
  assert.equal(resolveTarget({ kind: 'relative', delta: 1 }, 6, 12, index), 10);
});

test('a fold at the end of the note is the last row', () => {
  const index = new LineIndex(hiddenSpans([[8, 12]]));
  assert.equal(resolveTarget({ kind: 'relative', delta: 10 }, 1, 12, index), 8);
  assert.equal(resolveTarget({ kind: 'absolute', line: 12 }, 1, 12, index), 8);
});

test('the cursor goes to the first character that is not a space', () => {
  assert.equal(firstNonBlank('text'), 0);
  assert.equal(firstNonBlank('    - item'), 4);
  assert.equal(firstNonBlank('\t\tcode'), 2);
  assert.equal(firstNonBlank('   '), 3);
  assert.equal(firstNonBlank(''), 0);
});

test('rowEnd and lineAtRow agree with screenRow', () => {
  const index = new LineIndex(hiddenSpans([[3, 9], [12, 14]]));
  assert.equal(index.rowEnd(3), 9);
  assert.equal(index.rowEnd(5), 9);
  assert.equal(index.rowEnd(10), 10);
  assert.equal(index.rowEnd(12), 14);
  for (let line = 1; line <= 20; line++) {
    const shown = index.shownLine(line);
    assert.equal(index.lineAtRow(index.screenRow(line)), shown, `line ${line}`);
  }
});
