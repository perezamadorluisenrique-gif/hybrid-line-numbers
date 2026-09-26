# Changelog

The release workflow uses the section named after the version being released
as the release description, so every version needs one. `npm version <x.y.z>`
renames the `Unreleased` heading below to that version.

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
