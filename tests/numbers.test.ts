import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LineIndex, hiddenSpans, isNumberMode, lineLabel, widestLabel } from '../src/numbers.ts';
import type { NumberMode } from '../src/numbers.ts';

function labels(lines: number[], cursorLine: number, mode: NumberMode, folds: [number, number][] = []) {
  const index = new LineIndex(hiddenSpans(folds));
  return lines.map((line) => lineLabel(line, { mode, cursorLine, index }));
}

test('hybrid: distance everywhere, the real number on the cursor line', () => {
  assert.deepEqual(labels([1, 2, 3, 4, 5], 3, 'hybrid'), ['2', '1', '3', '1', '2']);
});

test('relative: 0 on the cursor line', () => {
  assert.deepEqual(labels([1, 2, 3, 4, 5], 3, 'relative'), ['2', '1', '0', '1', '2']);
});

test('absolute: plain line numbers', () => {
  assert.deepEqual(labels([1, 2, 3], 2, 'absolute'), ['1', '2', '3']);
});

test('a folded section counts as one line, below the cursor', () => {
  // Line 3 is a heading folded over lines 4-9; line 10 is the next one on screen.
  assert.deepEqual(labels([1, 2, 3, 10, 11], 1, 'hybrid', [[3, 9]]), ['1', '1', '2', '3', '4']);
});

test('a folded section counts as one line, above the cursor', () => {
  assert.deepEqual(labels([1, 2, 3, 10, 11], 11, 'hybrid', [[3, 9]]), ['4', '3', '2', '1', '11']);
});

test('a fold outside the range between line and cursor changes nothing', () => {
  assert.deepEqual(labels([10, 11, 12], 11, 'relative', [[2, 6]]), ['1', '0', '1']);
});

test('several folds between line and cursor', () => {
  // Folds hide 3-5 and 8-12; on screen: 1 2 [2..] 6 7 [7..] 13.
  assert.deepEqual(labels([1, 2, 6, 7, 13], 1, 'relative', [[2, 5], [7, 12]]), ['0', '1', '2', '3', '4']);
});

test('nested folds are counted once', () => {
  assert.deepEqual(hiddenSpans([[1, 10], [3, 5]]), [[2, 10]]);
  assert.deepEqual(labels([1, 11], 11, 'relative', [[1, 10], [3, 5]]), ['1', '0']);
});

test('a fold right after another keeps its own first line on screen', () => {
  assert.deepEqual(hiddenSpans([[1, 3], [4, 6]]), [[2, 3], [5, 6]]);
});

test('spans that touch merge', () => {
  assert.deepEqual(hiddenSpans([[1, 3], [3, 6]]), [[2, 6]]);
});

test('a one-line fold hides nothing', () => {
  assert.deepEqual(hiddenSpans([[4, 4]]), []);
});

test('folds given out of order', () => {
  assert.deepEqual(hiddenSpans([[20, 25], [2, 5]]), [[3, 5], [21, 25]]);
});

test('a cursor inside a fold counts from the fold line', () => {
  const index = new LineIndex(hiddenSpans([[3, 9]]));
  assert.equal(index.shownLine(6), 3);
  assert.equal(lineLabel(3, { mode: 'hybrid', cursorLine: 6, index }), '3');
  assert.equal(lineLabel(1, { mode: 'hybrid', cursorLine: 6, index }), '2');
  assert.equal(lineLabel(10, { mode: 'hybrid', cursorLine: 6, index }), '1');
});

test('screen rows skip hidden lines', () => {
  const index = new LineIndex(hiddenSpans([[3, 9], [12, 14]]));
  assert.deepEqual(
    [1, 2, 3, 10, 11, 12, 15].map((line) => index.screenRow(line)),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

test('many folds (binary search) agree with a direct count', () => {
  const folds: [number, number][] = [];
  for (let start = 5; start < 2000; start += 17) folds.push([start, start + 6]);
  const spans = hiddenSpans(folds);
  const index = new LineIndex(spans);
  const hidden = (line: number) => spans.some(([a, b]) => line >= a && line <= b);
  let row = 0;
  for (let line = 1; line <= 2000; line++) {
    if (hidden(line)) continue;
    row++;
    assert.equal(index.screenRow(line), row, `line ${line}`);
  }
});

test('the gutter is as wide as the last line number', () => {
  assert.equal(widestLabel(0), '9');
  assert.equal(widestLabel(9), '9');
  assert.equal(widestLabel(10), '99');
  assert.equal(widestLabel(1234), '9999');
});

test('stored modes are validated', () => {
  assert.equal(isNumberMode('hybrid'), true);
  assert.equal(isNumberMode('Relative'), false);
  assert.equal(isNumberMode(undefined), false);
});
