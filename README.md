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

![Hybrid line numbers in Obsidian: the cursor line shows 12, the lines around it show their distance, and the folded "Day one" section counts as a single line](https://raw.githubusercontent.com/perezamadorluisenrique-gif/hybrid-line-numbers/main/docs/hybrid.png)

_The cursor is on line 12. Every other line shows how far away it is, and the
folded "Day one" section counts as one line, so `3k` lands on it._

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
- **Select lines from the numbers**, like a code editor: see below.

The plugin draws its own column of numbers and hides Obsidian's while it is on,
so it works whether or not **Settings → Editor → Show line numbers** is
enabled, and you never get two columns.

## Selecting lines from the numbers

The numbers work like the line numbers of a code editor:

- **Click a number** to select that whole line, line break included, so
  Backspace or Cut takes the line out cleanly. On the last line the selection
  runs to the end of the note.
- **Drag** over the numbers to select line by line. Drag above or below the
  editor and the note scrolls along.
- **Shift-click** a number to extend the selection to that line.
- **Alt-click** (Option-click on a Mac) to add the line as another selection,
  for editing several places at once.
- **A folded section's number selects the whole section**, the hidden lines
  too, and the section stays folded.

With Vim key bindings, a selected line works like a Vim visual selection, so
`d`, `y` or `c` act on it. Turn this off with **Select lines by clicking the
numbers** if you prefer the numbers to ignore clicks.

## Commands

| Command | What it does |
|---|---|
| Toggle line numbers | Shows or hides the numbers. Obsidian's own line numbers come back while they are hidden, if you have them switched on. |
| Switch to the next numbering mode | Hybrid → relative → absolute → hybrid. |
| Go to relative line… | Type `+12` to move 12 lines down, `-5` to move 5 up, or `42` to go to line 42. |

**Go to relative line** counts the way the numbers do, so typing the number
you see next to a line, with `+` or `-`, takes you there, and a folded section
counts as one line. A line hidden inside a fold takes you to the fold, which
stays closed. The cursor lands on the first character of the line that is not
a space, as in Vim.

None has a hotkey by default; assign one in **Settings → Hotkeys**.

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
| Select lines by clicking the numbers | On | Click, drag, Shift-click and Alt-click on the numbers select lines. |

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

The numbering itself is plain arithmetic in `src/numbers.ts`, and the line
ranges a click selects and the line `+12` reaches are in `src/select.ts`, both
tested under Node; `src/extension.ts` is the CodeMirror gutter that draws the
numbers and handles the clicks.

## More plugins by Siulved54

| Plugin | What it does | Source |
| --- | --- | --- |
| [Shared Blocks](https://obsidian.md/plugins?id=shared-blocks) | Write a block of text once and reuse it in any note. Edit the source and every reference re-renders live. | [shared-blocks](https://github.com/perezamadorluisenrique-gif/shared-blocks) |
| [Text Case and Cleanup](https://obsidian.md/plugins?id=text-format) | Change case, make camelCase or slugs, sort lines and remove duplicates, and repair text pasted out of a PDF, without touching code or URLs. | [text-format](https://github.com/perezamadorluisenrique-gif/text-format) |
| [Typography as You Type](https://obsidian.md/plugins?id=typography-as-you-type) | Curly quotes, dashes and ellipses as you type, kept out of code and maths, with Backspace to take one back. | [smart-typography-plugin](https://github.com/perezamadorluisenrique-gif/smart-typography-plugin) |
| [Section Numbering](https://obsidian.md/plugins?id=section-numbering) | Number headings as an outline (1, 1.1, 1.2) and keep every link to them working when they renumber. | [section-numbering](https://github.com/perezamadorluisenrique-gif/section-numbering) |
| [Spreadsheet to Table](https://obsidian.md/plugins?id=spreadsheet-to-table) | Paste cells from Excel or Google Sheets as a Markdown table with a real header, insert CSV files, and copy tables back out. | [spreadsheet-to-table](https://github.com/perezamadorluisenrique-gif/spreadsheet-to-table) |
| [List Item Callouts](https://obsidian.md/plugins?id=list-item-callouts) | Colour a single list item as a callout by starting it with a character such as `&`, `!` or `?`. | [list-item-callouts](https://github.com/perezamadorluisenrique-gif/list-item-callouts) |
| [Folder Counts](https://obsidian.md/plugins?id=folder-counts) | See how many notes or files each folder holds, right in the file explorer, with a vault total and folder exclusions. | [folder-counts](https://github.com/perezamadorluisenrique-gif/folder-counts) |
| [Note Reading Time](https://obsidian.md/plugins?id=note-reading-time) | Reading time of the current note or your selection in the status bar, optionally saved to a property. | [note-reading-time](https://github.com/perezamadorluisenrique-gif/note-reading-time) |
| [Task Rollover](https://obsidian.md/plugins?id=task-rollover) | Roll unfinished tasks from your last daily note into today's when it is created, with a real undo. | [task-rollover](https://github.com/perezamadorluisenrique-gif/task-rollover) |
| [Zoom Into Section](https://obsidian.md/plugins?id=zoom-into-section) | Zoom into a heading or list item to see only it and its contents, with a breadcrumb bar to climb back out. | [zoom-into-section](https://github.com/perezamadorluisenrique-gif/zoom-into-section) |
| [Link Title on Paste](https://obsidian.md/plugins?id=link-title-on-paste) | Paste a web address and get a Markdown link with the page's title, fetched in the background and undone in one step. | [link-title-on-paste](https://github.com/perezamadorluisenrique-gif/link-title-on-paste) |
| [Update Radar](https://obsidian.md/plugins?id=update-radar) | Checks your installed community plugins for updates in the background, shows what changed, and flags the ones that look abandoned. | [community-update-checker](https://github.com/perezamadorluisenrique-gif/community-update-checker) |
| [Dataview to Bases](https://obsidian.md/plugins?id=dataview-to-bases) | Convert Dataview queries into Bases blocks, and see which queries in your vault can be converted. | [dataview-to-bases](https://github.com/perezamadorluisenrique-gif/dataview-to-bases) |
| [Line Editing Commands](https://obsidian.md/plugins?id=line-editing-commands) | Duplicate, join, sort and reverse lines, insert blank lines and jump to a line number, with multi-cursor support. | [line-editing-commands](https://github.com/perezamadorluisenrique-gif/line-editing-commands) |
| [Note Mover Rules](https://obsidian.md/plugins?id=note-mover-rules) | Move notes into folders by ordered rules on tags, properties, titles and paths, with a preview before any bulk move. | [note-mover-rules](https://github.com/perezamadorluisenrique-gif/note-mover-rules) |
| [Tab History](https://obsidian.md/plugins?id=tab-history) | Keeps each tab's back and forward history across restarts, and adds commands to move, maximize and close tabs. | [tab-history](https://github.com/perezamadorluisenrique-gif/tab-history) |
| [URL Cards](https://obsidian.md/plugins?id=url-cards) | Shows web addresses as cards with title, description and image, and reads existing cardlink blocks. | [url-cards](https://github.com/perezamadorluisenrique-gif/url-cards) |
| [Vim Config](https://obsidian.md/plugins?id=vim-config) | Loads a vimrc-style file from your vault so your key mappings and editor commands are ready when vim mode starts. | [vim-config](https://github.com/perezamadorluisenrique-gif/vim-config) |
| [Task Archive](https://obsidian.md/plugins?id=task-archive) | Moves completed tasks, with their sub-items, into an archive section or note. | [task-archive](https://github.com/perezamadorluisenrique-gif/task-archive) |
| [Revisit Later](https://obsidian.md/plugins?id=revisit-later) | Link the current note into a future daily note, with a date typed in plain English, so it comes back when you want to review it. | [revisit-later](https://github.com/perezamadorluisenrique-gif/revisit-later) |
| [Explorer Colors Plus](https://obsidian.md/plugins?id=explorer-colors-plus) | Color files and folders in the file explorer, with a palette, cascading to children, and import from File Color. | [explorer-colors-plus](https://github.com/perezamadorluisenrique-gif/explorer-colors-plus) |
| [Book Lookup](https://obsidian.md/plugins?id=book-lookup) | Create book notes from Open Library or Google Books, with cover images, ISBN search and Book Search compatible templates. | [book-lookup](https://github.com/perezamadorluisenrique-gif/book-lookup) |
| [Web Search Menu](https://obsidian.md/plugins?id=web-search-menu) | Search the web for selected text or the note title from the right-click menu, with engines you define. | [web-search-menu](https://github.com/perezamadorluisenrique-gif/web-search-menu) |

All of them are in the community directory: Settings -> Community plugins ->
Browse, then search for the name.

## License

MIT
