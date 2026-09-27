# Hybrid Line Numbers

Relative and hybrid line numbers for Obsidian's editor, for anyone who moves
with Vim counts such as `5j` or `12dd`, or just wants to see how far away a
line is.

```text
 3  ## Method
 2  First step
 1  Second step
14  The cursor is on this line
 1  Third step
 2  ## Results      (folded: counts as one line)
 3  Next paragraph
```

## What it does

- **Hybrid** (the default): the real line number on the cursor line, the
  distance to the cursor on every other line.
- **Relative**: `0` on the cursor line, the distance everywhere else.
- **Absolute**: plain line numbers.
- **A folded section counts as one line**, which is how Vim counts a jump, so
  the number next to a line is always the count that reaches it.
- **Absolute numbers in Vim insert mode** (optional): relative numbers while
  you move around, line numbers while you type, like Vim's popular
  "number toggle" setup.
- In a Vim visual selection the numbers follow the cursor, not the other end
  of the selection.

The plugin draws its own column of numbers and hides Obsidian's while it is on,
so it works whether or not **Settings → Editor → Show line numbers** is
enabled, and you never get two columns.

## Commands

| Command | What it does |
|---|---|
| Toggle line numbers | Shows or hides the numbers. Obsidian's own line numbers come back while they are hidden, if you have them switched on. |
| Switch to the next numbering mode | Hybrid → relative → absolute → hybrid. |

Neither has a hotkey by default; assign one in **Settings → Hotkeys**.

## Vim's `:set number` and `:set relativenumber`

With Vim key bindings on, the numbers answer to Vim's own options, typed on
the `:` command line or put in a vimrc (for example with the Vimrc Support
plugin):

| Vim | Here |
|---|---|
| `:set nu rnu` | Hybrid |
| `:set rnu nonu` | Relative |
| `:set nu nornu` | Absolute |
| `:set nonu nornu` | Hidden |

The short names, `inv…`, `…!` and `:set nu?` work as in Vim, and a change
is saved like one made in the settings.

## Settings

| Setting | Default | |
|---|---|---|
| Show line numbers | On | The same as the toggle command. |
| Numbering | Hybrid | Hybrid, relative or absolute. |
| Absolute numbers in Vim insert mode | Off | Needs **Settings → Editor → Vim key bindings**. |

## Coming from Relative Line Numbers

This plugin does the same job as
[Relative Line Numbers](https://github.com/nadavspi/obsidian-relative-line-numbers),
which has not had a release since 2023. Differences you will notice:

- It works without switching on Obsidian's own line numbers first.
- In a Vim visual selection, or any selection made upwards, the numbers count
  from the cursor. The older plugin counts from the end of the selection, so
  after `Vkk` its numbers still count from the line where the selection
  started.
- The column only redraws when a number actually changes (the cursor moves,
  the note changes, a section folds or unfolds, or the Vim mode changes),
  instead of reconfiguring the editor on every cursor move.
- Hybrid mode, the insert-mode option and the mode command are new.

Disable the old plugin before enabling this one, or you will see two columns
of numbers.

## Installing

Once the plugin is in the community directory: **Settings → Community plugins →
Browse**, search for "Hybrid Line Numbers", then install and enable it.

Until then, download `main.js`, `manifest.json` and `styles.css` from the
[latest release](../../releases/latest) into
`<vault>/.obsidian/plugins/hybrid-line-numbers/`, reload Obsidian and enable
the plugin under **Settings → Community plugins**.

## Development

```bash
npm ci
npm run lint
npm test          # needs Node 22.18 or later
npm run build
```

The numbering itself is plain arithmetic in `src/numbers.ts`, tested under
Node; `src/extension.ts` is the CodeMirror gutter that draws it.

## License

MIT
