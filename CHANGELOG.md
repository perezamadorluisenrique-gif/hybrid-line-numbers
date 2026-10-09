# Changelog

The release workflow uses the section named after the version being released
as the release description, so every version needs one. `npm version <x.y.z>`
renames the `Unreleased` heading below to that version.

## 0.3.0

- Select lines from the numbers, like a code editor: click a number to select its line, drag to select several (the note scrolls along), Shift-click to extend, Alt-click (Option on a Mac) to add another selection. A folded section's number selects the whole section. On by default; switch it off with "Select lines by clicking the numbers".
- New command "Go to relative line…": type `+12`, `-5` or `42`. It counts a folded section as one line, like the numbers.

## 0.2.2

- Line numbers in a popout window are created in that window's document, and the stylesheet no longer mentions `!important`; the gutter looks the same.

## 0.2.1

- Fix the review finding about a CSS rule using !important: the native line numbers are now hidden without it.

## 0.2.0

- Vim's `:set number` and `:set relativenumber` (`nu`, `rnu`, and their
  `no`, `inv` and `!` forms) now drive the line numbers, from the `:`
  command line or a vimrc: `nu rnu` is hybrid, `rnu` relative, `nu`
  absolute, neither hides them. `:set nu?` reports the current state.
- Both commands have an icon, so they show what they do instead of a
  question mark when added to the mobile toolbar.

## 0.1.0

First release.

- **Hybrid, relative or absolute** line numbers in the editor. Hybrid, the
  default, shows the real line number on the cursor line and the distance to
  the cursor on every other line.
- **A folded section counts as one line**, the way Vim counts a jump such as
  `5j`.
- **Absolute numbers in Vim insert mode**, as an option: relative while you
  move, line numbers while you type.
- In a Vim visual selection the numbers count from the cursor, not from the
  other end of the selection.
- Works whether or not Obsidian's own line numbers are switched on, and hides
  them while it is on so there is only one column.
- Commands to toggle the numbers and to switch to the next mode.
