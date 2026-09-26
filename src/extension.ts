/**
 * The CodeMirror side: one gutter that draws the labels from `numbers.ts`,
 * and a watcher that follows Vim between normal and insert mode.
 *
 * The gutter redraws only on what changes a label (the cursor, an edit, a
 * fold opening or closing, a setting, the Vim mode), and never reconfigures
 * the editor to do it.
 */
import { Facet, StateEffect, StateField } from '@codemirror/state';
import type { EditorState, Extension } from '@codemirror/state';
import { EditorView, GutterMarker, ViewPlugin, gutter } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import { foldedRanges } from '@codemirror/language';

import { LineIndex, hiddenSpans, lineLabel, widestLabel } from './numbers.ts';
import type { LabelContext, NumberMode } from './numbers.ts';

export interface GutterOptions {
  mode: NumberMode;
  /** Show absolute numbers while Vim is in insert (or replace) mode. */
  absoluteInInsert: boolean;
}

const DEFAULT_OPTIONS: GutterOptions = { mode: 'hybrid', absoluteInInsert: false };

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

  toDOM(): Node {
    return document.createTextNode(this.text);
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
    numberGutter,
    // Lets the stylesheet hide Obsidian's own line numbers in this editor,
    // so there is one column of numbers, not two.
    EditorView.editorAttributes.of({ class: 'hln-active' }),
  ];
}
