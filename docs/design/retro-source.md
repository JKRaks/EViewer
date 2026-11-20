# DesignPrompts Retro · 原始提示词

来源：https://designprompts.dev/?style=retro&width=narrow&section=hero
任务：Apply to existing project
保存日期：2026-11-04

```text
<prompt>
<task>
Apply this visual style to the user's existing project. Inspect and preserve its stack, copy, routes, and behavior. Follow existing component and styling conventions. Treat framework, library, and page examples in these design instructions as illustrations; they do not require a stack change or new sections. Scope changes to the user's requested work.

Keep controls keyboard accessible, focus visible, and text legible. Preserve reading order, responsive behavior, and reduced-motion preferences. Verify actual states at the rendered width. The user's stack and content take precedence over illustrative implementation details.
</task>

<design-system>
# Retro

## Identity

Use an overcrowded desktop of offset windows, hard bevels, grey frames, white reading wells, and bright yellow, navy, pink, and teal fields. The familiar window furniture gives the page structure. Large contemporary sans headings keep the main message readable within it.

## Layout

Arrange the wide page on a twelve-column grid with windows that begin and end on different columns. Open with a broad yellow launch window beside a compact monitor-like facts panel. A bright pink strip can span beneath them.

Continue with overlapping readme-like text, a capability window with its own side panel, and a teal field of smaller editorial windows. A setup sequence can use numbered steps and a segmented progress motif. Benefits can occupy yellow; genuine quotations can appear as guestbook entries inside a pink patterned region. Optional comparisons use horizontal rows within a shared window. Close with a smaller dialog above a broad footer with folder-like link headings.

Keep the reading order clear through the offset composition. The brief decides which windows and content types exist; decorative application names, sample interface values, prices, and quotes are optional.

## Typography

Use Host Grotesk for heavy display headings, bound to "Retro Display". Use IBM Plex Sans for reading and interface labels, bound to "Retro Interface", and IBM Plex Mono for compact metadata, bound to "Retro Mono". The opening is uppercase, tightly tracked, and close-set, scaling from 62px to 94px on wider layouts. Keep paragraphs at a comfortable reading size. Do not turn all text into a tiny pixel font.

## Color and surfaces

Grey forms the window frame. Use white for inset reading areas, black for ink, navy for title bars, and teal for selected desktop regions. Yellow, purple, and pink carry strong local emphasis. Links can use a saturated blue hover state.

A fine tiled grey desktop can show between the windows. Use square corners, hard black offsets, and white top-left bevels opposed by dark bottom-right edges. Inset wells reverse the edge treatment. Keep large color fields flat and avoid soft shadows or blurred overlays.

## Components

Buttons resemble raised keys with clear labels and squared bevels. Pressing moves the key slightly and reverses its depth. Preserve a visible keyboard focus treatment.

Window title bars can name real content groups. Any close, minimize, folder, or navigation symbol presented as a control must have a real action and accessible label; otherwise make the ornament clearly decorative. Optional comparison selections use a purple pressed key, with a featured marker kept separate. Disclosures retain recognizable open/close behavior inside their window.

## Images

Use natural-color photographs in small inset picture windows. Keep crops direct and subjects recognizable. If genuine author or customer portraits exist, use compact square avatars beside their attribution and reuse each person's image consistently. Portraits and guestbook entries are not required. Reserve dimensions and supply meaningful alternative text.

## Motion

Controls use immediate pressed feedback. A decorative ticker arrow can shift in two small steps at a slow repeating cadence; keep the text beside it still. Disable that repetition for reduced motion. Do not simulate loading, error dialogs, or system alerts unless they describe a real state.

## Responsive behavior

At 1050px, tighten side panels and move comparison details beneath their main row. At 760px, stack the opening, readme, and major windows while retaining small horizontal offsets. Editorial windows can become image-and-text rows; steps and guestbook entries stack. At 480px, stack editorial contents, features, and benefits, and reduce decorative offsets. Facts and footer groups can remain in two columns. Keep bevels crisp and labels comfortably tappable.

## Design limits

Avoid distressed vintage textures, sepia filters, rounded modern cards, and fake operating-system behavior. Preserve the desktop's compact density without forcing tiny type, overlapping essential content, or horizontal page overflow.

## Authoritative tokens

| CSS variable | Value |
| --- | --- |
| --dp-color-window | #d4d4d4 |
| --dp-color-ink | #000000 |
| --dp-color-bevel-dark | #808080 |
| --dp-color-bevel-light | #ffffff |
| --dp-color-accent | #6600ff |
| --dp-color-highlight | #ffff00 |
| --dp-color-link-hover | #0000ff |
| --dp-color-desktop | #008080 |
| --dp-color-emphasis | #ff00b8 |
| --dp-color-titlebar | #000080 |
| --dp-typography-interface | "Retro Interface", sans-serif |
| --dp-typography-display | "Retro Display", sans-serif |
| --dp-typography-mono | "Retro Mono", monospace |
| --dp-typography-body | 16px |
| --dp-typography-supporting | 15px |
| --dp-typography-label | 12px |
| --dp-typography-body-leading | 1.4 |
| --dp-spacing-pane-inset | 5px |
| --dp-spacing-item-gap | 10px |
| --dp-radius-control | 0 |
| --dp-border-frame | 2px |
| --dp-border-rule | 1px |
| --dp-motion-ticker-cycle | 1s |
</design-system>
</prompt>
```
