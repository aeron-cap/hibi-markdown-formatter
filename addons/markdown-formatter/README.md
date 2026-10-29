# Markdown Formatter

Format standard Markdown and GitHub Flavored Markdown (GFM) in Hibi.

## Install and use

Install this package folder with **Install addon…**, then enable **Markdown Formatter** in **Settings → Addons**. Local development packages are unsigned; enable **Allow unsigned addons** in **Settings → Addon Manager → Security** to test one.

Open a Markdown note, switch to **Source view**, and run **Format Markdown** from the command palette or the **Addons** menu. The source pane in **Side-by-side** view also works. Assign a shortcut in **Settings → Hotkeys** if you want one. The addon supplies no default shortcut or toolbar button.

Formatting changes the open note as one undo step. Undo restores the previous source, and redo restores the formatted text. Saving and autosave continue to use Hibi's existing settings. Disable the addon in **Settings → Addons** to remove its command.

## Behavior

The formatter runs in a bundled Web Worker so editing stays responsive. Work is cancelled when the note or view changes and stops after 30 seconds if it cannot finish.

The formatter runs offline using bundled Prettier 3.9.10. It tidies headings, lists, tables, and other standard Markdown and GFM syntax. Existing paragraph wrapping is preserved, embedded code formatting is disabled, print width is 80, and indentation is two spaces.

A leading BOM and closed YAML frontmatter, including its following blank lines, remain unchanged. An unclosed leading YAML block is rejected. The formatted body uses its first line-ending style; mixed body line endings become consistent. Empty notes remain empty. An unchanged result creates no undo step.

If you edit the note, change editor views or tabs, or close the note while formatting runs, the result is discarded. Run the command again on the current source. Disabling the addon also discards pending work.

## Limits

Version 0.1 supports Hibi API 3 and Source view only. It formats whole notes, not selections. Normal view displays a message asking you to switch views. Formatting does not repair invalid Markdown.

Wikilinks, math, and syntax added by other addons are outside this version's compatibility guarantees. Use the formatter for standard Markdown and GFM notes; it does not detect every extension construct.

There are no formatter settings or format-on-save option yet. Workspace Prettier configuration files and plugins are not loaded.

## Credits

Original addon code is MIT licensed. Prettier and its bundled dependencies retain the notices in THIRD_PARTY_NOTICES.txt.
