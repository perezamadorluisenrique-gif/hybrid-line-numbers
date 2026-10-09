/**
 * The CodeMirror side: one gutter that draws the labels from `numbers.ts`,
 * and a watcher that follows Vim between normal and insert mode.
 *
 * The gutter redraws only on what changes a label (the cursor, an edit, a
 * fold opening or closing, a setting, the Vim mode), and never reconfigures
 * the editor to do it.
 */
import { EditorSelection, EditorState, Facet, StateEffect, StateField } from '@codemirror/state';
import type { Extension, SelectionRange } from '@codemirror/state';
import { EditorView, GutterMarker, ViewPlugin, gutter } from '@codemirror/view';
import type { BlockInfo, ViewUpdate } from '@codemirror/view';
import { foldedRanges } from '@codemirror/language';

import { LineIndex, hiddenSpans, lineLabel, widestLabel } from './numbers.ts';
import type { LabelContext, NumberMode } from './numbers.ts';
import { firstNonBlank, lineSelection, parseLineTarget, resolveTarget, rowSpan } from './select.ts';
import type { DocLines, LineSpan } from './select.ts';

export interface GutterOptions {
  mode: NumberMode;
  /** Show absolute numbers while Vim is in insert (or replace) mode. */
  absoluteInInsert: boolean;
  /** Clicking or dragging over the numbers selects whole lines. */
  selectLines: boolean;
}

const DEFAULT_OPTIONS: GutterOptions = { mode: 'hybrid', absoluteInInsert: false, selectLines: true };

const optionsFacet = Facet.define<GutterOptions, GutterOptions>({
  combine: (values) => values[0] ?? DEFAULT_OPTIONS,
});

const setVimInsert = StateEffect.define<boolean>();

/** Whether Vim is in insert mode in this editor. Always false without Vim. */
const vimInsert = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setVimInsert)) value = effect.value;
    return value;
  },
});

/** The part of @replit/codemirror-vim's CodeMirror 5 adapter used here. */
interface VimAdapter {
  on(type: 'vim-mode-change', handler: (event: { mode?: string }) => void): void;
  off(type: 'vim-mode-change', handler: (event: { mode?: string }) => void): void;
}

/**
 * Obsidian's Vim mode puts its CodeMirror 5 adapter on the view as `cm`, and
 * the adapter signals every mode change. It can appear after this plugin
 * loads (Vim switched on later), so it is looked for on every update.
 */
const vimWatcher = ViewPlugin.fromClass(
  class {
    private adapter: VimAdapter | null = null;
    private destroyed = false;

    constructor(private readonly view: EditorView) {
      this.attach();
    }

    update(): void {
      this.attach();
    }

    destroy(): void {
      this.destroyed = true;
      this.adapter?.off('vim-mode-change', this.onModeChange);
      this.adapter = null;
    }

    private attach(): void {
      const adapter = (this.view as EditorView & { cm?: VimAdapter }).cm ?? null;
      if (adapter === this.adapter) return;
      this.adapter?.off('vim-mode-change', this.onModeChange);
      this.adapter = adapter;
      adapter?.on('vim-mode-change', this.onModeChange);
    }

    private readonly onModeChange = (event: { mode?: string }): void => {
      const insert = event.mode === 'insert' || event.mode === 'replace';
      // Vim signals from inside its own key handling, which may be inside an
      // editor update; dispatching there throws, so it waits a tick.
      queueMicrotask(() => {
        if (this.destroyed || this.view.state.field(vimInsert, false) === insert) return;
        this.view.dispatch({ effects: setVimInsert.of(insert) });
      });
    };
  },
);

class NumberMarker extends GutterMarker {
  constructor(
    readonly text: string,
    current: boolean,
  ) {
    super();
    if (current) this.elementClass = 'hln-current';
  }

  eq(other: GutterMarker): boolean {
    return other instanceof NumberMarker && other.text === this.text && other.elementClass === this.elementClass;
  }

  toDOM(view: EditorView): Node {
    // The editor's own document, so a note in a popout window gets nodes from that window.
    return view.dom.ownerDocument.createTextNode(this.text);
  }
}

/** Everything a label needs, worked out once per editor state, not per line. */
const contexts = new WeakMap<EditorState, LabelContext>();

function labelContext(state: EditorState): LabelContext {
  let context = contexts.get(state);
  if (context) return context;
  const folds: [number, number][] = [];
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    folds.push([state.doc.lineAt(from).number, state.doc.lineAt(to).number]);
  });
  const options = state.facet(optionsFacet);
  const insert = state.field(vimInsert, false) ?? false;
  context = {
    mode: options.absoluteInInsert && insert ? 'absolute' : options.mode,
    // The head, not the anchor: in a Vim visual selection it is the cursor.
    cursorLine: state.doc.lineAt(state.selection.main.head).number,
    index: new LineIndex(hiddenSpans(folds)),
  };
  contexts.set(state, context);
  return context;
}

function labelsChanged(update: ViewUpdate): boolean {
  const before = update.startState;
  const after = update.state;
  return (
    update.docChanged ||
    update.selectionSet ||
    foldedRanges(before) !== foldedRanges(after) ||
    before.facet(optionsFacet) !== after.facet(optionsFacet) ||
    before.field(vimInsert, false) !== after.field(vimInsert, false)
  );
}

function docLines(state: EditorState): DocLines {
  const doc = state.doc;
  return { lines: doc.lines, length: doc.length, lineStart: (line) => doc.line(line).from };
}

/** The rows a gutter block stands for: a line, a folded section, or a block CodeMirror drew as one. */
function blockSpan(state: EditorState, block: BlockInfo): LineSpan {
  const from = state.doc.lineAt(block.from).number;
  const to = state.doc.lineAt(block.to).number;
  return rowSpan(from, to, labelContext(state).index);
}

/** A drag that started on the gutter and lasts until the button comes up. */
interface Drag {
  /** The rows the drag (or the Shift-click) started from. */
  anchor: LineSpan;
  /** The other selections, kept as they were, when Alt added this one. */
  others: readonly SelectionRange[];
  /** Pointer height, in the window's coordinates. */
  clientY: number;
  timer: number;
  move: (event: MouseEvent) => void;
  up: (event: MouseEvent) => void;
}

/** How far outside the editor, in pixels, the pointer has to be for the fastest scroll. */
const SCROLL_RAMP = 80;
const SCROLL_MAX_STEP = 40;
const SCROLL_INTERVAL_MS = 30;

/**
 * Selects whole lines from the gutter, the way a code editor's line numbers
 * do: click a number to select that line, drag to select line by line
 * (scrolling when the pointer leaves the editor), Shift-click to extend the
 * selection to a line, Alt-click (Option on a Mac) to add a line as another
 * selection.
 */
const lineSelector = ViewPlugin.fromClass(
  class {
    private drag: Drag | null = null;
    /** The last selection this made and the rows it started from, so Shift-click extends from them. */
    private last: { selection: EditorSelection; anchor: LineSpan } | null = null;

    constructor(private readonly view: EditorView) {}

    destroy(): void {
      this.stop();
    }

    /** The gutter's mousedown. True when it is handled here. */
    start(block: BlockInfo, event: MouseEvent): boolean {
      const view = this.view;
      if (!view.state.facet(optionsFacet).selectLines) return false;
      if (event.button !== 0 || event.ctrlKey || event.metaKey) return false;
      this.stop();
      const state = view.state;
      const clicked = blockSpan(state, block);
      const add = event.altKey && state.facet(EditorState.allowMultipleSelections);
      let anchor = clicked;
      if (event.shiftKey && !add) {
        const last = this.last;
        // From the rows the last gutter selection started on, while it is
        // still the selection; otherwise from the line the selection starts on.
        const line = state.doc.lineAt(state.selection.main.anchor).number;
        anchor = last?.selection.eq(state.selection) ? last.anchor : rowSpan(line, line, labelContext(state).index);
      }
      const others = add ? state.selection.ranges : [];
      const doc = view.dom.ownerDocument;
      const win = doc.defaultView ?? activeWindow;
      const drag: Drag = {
        anchor,
        others,
        clientY: event.clientY,
        timer: win.setInterval(() => this.autoScroll(), SCROLL_INTERVAL_MS),
        move: (move) => {
          if ((move.buttons & 1) === 0) return this.stop();
          drag.clientY = move.clientY;
          this.extend();
        },
        up: () => this.stop(),
      };
      this.drag = drag;
      doc.addEventListener('mousemove', drag.move);
      doc.addEventListener('mouseup', drag.up);
      view.focus();
      this.select(clicked);
      return true;
    }

    /** Selects from the drag's anchor to `head`, keeping the other selections when Alt added this one. */
    private select(head: LineSpan): void {
      const drag = this.drag;
      if (!drag) return;
      const state = this.view.state;
      const { anchor, head: to } = lineSelection(drag.anchor, head, docLines(state));
      const range = EditorSelection.range(anchor, to);
      const selection = EditorSelection.create([...drag.others, range], drag.others.length);
      if (!selection.eq(state.selection)) this.view.dispatch({ selection, userEvent: 'select.pointer' });
      this.last = { selection: this.view.state.selection, anchor: drag.anchor };
    }

    /** The rows under the pointer, held to the first and last line of the note. */
    private extend(): void {
      const drag = this.drag;
      if (!drag) return;
      const view = this.view;
      const height = drag.clientY - view.documentTop;
      const block = view.lineBlockAtHeight(Math.min(Math.max(height, 0), Math.max(view.contentHeight - 1, 0)));
      this.select(blockSpan(view.state, block));
    }

    /** While the pointer is above or below the editor, scroll towards it and keep selecting. */
    private autoScroll(): void {
      const drag = this.drag;
      if (!drag) return;
      const scroller = this.view.scrollDOM;
      const rect = scroller.getBoundingClientRect();
      let past = 0;
      if (drag.clientY < rect.top) past = drag.clientY - rect.top;
      else if (drag.clientY > rect.bottom) past = drag.clientY - rect.bottom;
      if (past === 0) return;
      const step = Math.sign(past) * Math.ceil((Math.min(Math.abs(past), SCROLL_RAMP) / SCROLL_RAMP) * SCROLL_MAX_STEP);
      const before = scroller.scrollTop;
      scroller.scrollTop = before + step;
      if (scroller.scrollTop !== before) this.extend();
    }

    private stop(): void {
      const drag = this.drag;
      if (!drag) return;
      this.drag = null;
      const doc = this.view.dom.ownerDocument;
      doc.removeEventListener('mousemove', drag.move);
      doc.removeEventListener('mouseup', drag.up);
      (doc.defaultView ?? activeWindow).clearInterval(drag.timer);
    }
  },
);

/**
 * "Go to relative line": `+12` or `-5` rows from the cursor, counting a
 * folded section as one row as the gutter does, or `42` for line 42. The
 * cursor lands on the first character of the line that is not a space.
 * Returns false, changing nothing, when the text is not a target.
 */
export function goToLine(view: EditorView, text: string): boolean {
  const target = parseLineTarget(text);
  if (!target) return false;
  const state = view.state;
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const line = state.doc.line(resolveTarget(target, cursorLine, state.doc.lines, labelContext(state).index));
  const pos = line.from + firstNonBlank(line.text);
  view.dispatch({ selection: EditorSelection.cursor(pos), scrollIntoView: true, userEvent: 'select' });
  return true;
}

const numberGutter = gutter({
  // `cm-lineNumbers` picks up the theme's styling for line numbers.
  class: 'cm-lineNumbers hln-gutter',
  lineMarker(view, block) {
    const line = view.state.doc.lineAt(block.from).number;
    const context = labelContext(view.state);
    const current = context.index.shownLine(context.cursorLine) === line;
    return new NumberMarker(lineLabel(line, context), current);
  },
  lineMarkerChange: labelsChanged,
  domEventHandlers: {
    mousedown: (view, block, event) => view.plugin(lineSelector)?.start(block, event as MouseEvent) ?? false,
  },
  initialSpacer: (view) => new NumberMarker(widestLabel(view.state.doc.lines), false),
  updateSpacer(spacer, update) {
    const widest = widestLabel(update.state.doc.lines);
    return spacer instanceof NumberMarker && spacer.text === widest ? spacer : new NumberMarker(widest, false);
  },
});

/** The whole editor extension, for one set of options. */
export function hybridLineNumbers(options: GutterOptions): Extension {
  return [
    optionsFacet.of(options),
    vimInsert,
    vimWatcher,
    lineSelector,
    numberGutter,
    // Lets the stylesheet hide Obsidian's own line numbers in this editor,
    // so there is one column of numbers, not two.
    EditorView.editorAttributes.of({ class: options.selectLines ? 'hln-active hln-select-lines' : 'hln-active' }),
  ];
}
