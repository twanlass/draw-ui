# draw-ui

Sketch an app UI and watch it turn into real components. Draw a box, pause, and the sketch is swapped for the matching [shadcn/ui](https://ui.shadcn.com) component at the same position and size.

Stroke rendering comes from [scribble](https://github.com/twanlass/scribble)'s `freehand.js`, vendored in `src/lib/`.

## Run

```bash
npm install
cp .env.example .env.local   # add your OpenRouter key
npm run dev
npm test
```

With `OPENROUTER_API_KEY` set, sketches are recognized by [Jev](https://openrouter.ai/docs/guides/community/jev) through OpenRouter. Without it, the app falls back to shape heuristics that know four components. The toolbar shows which one is active. The dev server logs each Jev call's latency, cost, and top three guesses.

## How it works

1. **Group.** Strokes collect into an open group. A pause, or starting a new stroke more than 48px away, closes it (`src/canvas/state.ts`). The pause adapts to what you just drew (`src/canvas/idle.ts`): 550ms once you draw inside a frame (a button's label, a checkbox's tick, a select's chevron) or close a shape around strokes, 900ms after a lone frame (room for its contents), 1s after a tiny mark outside any frame, 1.2s after a single straight line (the first side of a box, or half an X), 700ms otherwise.
2. **Recognize.** A few shapes are settled by rule first (`src/recognize/rules.ts`): a tiny square box with a line or scribble beside it is a checkbox with a label. Otherwise the closed group goes to a `Recognizer` (`src/recognize/types.ts`), which returns a component kind and box, or `null` to leave the sketch alone.
3. **Swap.** On a match, the strokes are replaced by the real component (`src/canvas/renderers.tsx`). In debug mode (`?debug`), a chip under it shows the pick and its probability, and opens the runners-up so you can switch. Cmd/Ctrl+Z removes the component and its sketch together.
   A checkbox or switch drawn with its label in one go is split into the control and a Label (`src/recognize/split.ts`), laid out as a row; one undo removes both.
4. **Auto layout.** Placed components get tidied (`src/canvas/layout.ts`). Controls shrink to their real size (a 36px input, a 16px checkbox) around where you drew them. Components drawn one under another become a column: left-aligned, resizable ones stretched to the same width, 16px apart (8px under a label). Components side by side become a row: centred on each other vertically, 8px apart; a row stacks in a column as one item. Inside a card, content sits at 24px padding and spans the card's width. Draw a card around components and it goes beneath them, lays them out, and its height hugs them; a card that runs out of room grows. Groups and cards can nest; moving a container moves what's in it. Inside a container, content is cut into rows wherever nothing crosses between them, and a row into equal-width columns wherever its parts sit side by side, recursively, so one card can mix full-width fields, a two-column header and a row of three label-over-input fields. A row of labels over a row of inputs counts as one row of fields; small things side by side (a checkbox and its label) stay an inline row at their own sizes. Layout decides rows, columns and order from where things were drawn, not from where it last put them, so tidying never snowballs. Only cards, phones and groups hold other components; a sketch started inside one goes in it, even if it's drawn past the edge (the container grows if it has to). Spacing always comes from these standards, never from how far apart things were drawn. Undo puts everything back.
5. **Cross out.** Two roughly straight strokes that cross, drawn over a placed component, delete it instead of going to the recognizer (`src/recognize/gestures.ts`). Everything at least half inside the X goes, so one big X clears a whole form; an X too small to cover anything takes the topmost component where its strokes cross. Erasing a card or group erases what's inside it, a group left empty goes too, and containers that lost something close up. Cmd/Ctrl+Z brings it all back in one step.
6. **Phone frames** (hidden for now; `SketchCanvas`'s `showPhone` brings the button back). The phone button on the left toolbar drops a phone frame onto the canvas (`src/canvas/frames.ts`). Anything whose centre lands in it belongs to it: it's laid out in the screen area (under the status bar, 16px side padding, full width), and the frame keeps its size instead of growing. Undo removes it.
7. **Groups.** Shift+drag (in Draw or Debug) drags out a rect. The components centred inside it get wrapped in an invisible flex container: one column, left-aligned, resizable ones as wide as each other, standard gaps, rows kept as rows, however far apart they were drawn. The group snaps around them and hugs its content like a card with no padding. Its dashed blue outline shows as it's made, then fades after half a second in Draw; Edit and Debug keep outlines showing, Interact hides them. Undo ungroups.
8. **Duplicate.** Cmd/Ctrl+D copies whatever the last sketch (or group) became, with anything inside it, and puts it a standard gap below the original; layout tidies it into the same column, growing a card around it if needed. The copy counts as the last thing created, so pressing again keeps stacking. Phones aren't duplicated.
9. **Edit mode and text styles.** Edit (E, or the toolbar) doesn't draw: hovering puts a light blue highlight behind the component under the pointer. Drag a component (with anything inside it) to move it: while dragging, the card, group or phone it would drop into is highlighted; on drop it joins that container (or the canvas) where you let go, layout snaps it in with standard spacing, the container it left closes up, and a group it leaves empty goes. Undo puts it back. Over a label, + and − step it through help text, label, body, subtitle and title (`src/canvas/textStyles.ts`); each has its own line height, layout re-flows around it, and a form label keeps the tight 8px gap to what's under it while other text gets 16px. The toolbar briefly names the new style. Undo reverts it, and Cmd+D copies it. Double-click a component's text (a label, button text, a field's placeholder, a select's prompt, an alert's title…) to edit it in place: Enter or clicking away saves, Escape cancels, Tab and Shift+Tab save and jump to the next or previous component with text (top to bottom, left to right), empty text goes back to the default, and undo reverts it.

### Jev recognizer

`src/recognize/jev/` renders the sketch to a PNG (256 to 1568 px, small sketches padded rather than blown up) and posts it to `/api/recognize`, a dev-server route in `server/jev-plugin.ts` that holds the API key. That route sends one Decisions API call with **one yes/no question per shadcn component** (`src/recognize/catalog.ts`, 59 questions) and the sketch's on-screen size. Components are ranked by their probability. The top one always wins, however low its probability, so a sketch never silently stays; if it's wrong, the chip under it (in debug mode) switches to a runner-up in one click.

Overlay components (dialog, sheet, drawer, popover, tooltip, dropdown, alert dialog, sonner) render as their real trigger, and open in interact mode.

The route only exists in `vite dev` and `vite preview`. A deployed build needs its own server route.

### Shape heuristics (fallback)

`src/recognize/heuristic.ts` uses shape only:

| Sketch | Component |
| --- | --- |
| Small square | Checkbox |
| Big box | Card |
| One-line-tall box (any width), short mark centred with space either side | Button |
| One-line-tall box, empty or a line from the left edge (short or most of the way) | Input |
| Short line, squiggle or scribbled words on their own | Label |
| Long line on its own (250px+), or vertical | Separator |

Boxes can be drawn in one stroke or as separate sides. It can't read handwriting, so labels are placeholder text.

## Feedback loop

Open the app with `?debug` in the URL (e.g. `http://localhost:5180/?debug`) to get the Debug button in the toolbar, and turn Debug mode on. You draw as usual, and every component shows its chip. When a sketch came out as the wrong component, open the chip and pick the right one. The menu lists the runners-up, then every other component. Switching is the feedback: the dev server saves a report under `feedback/` (gitignored):

- `feedback/inbox.jsonl`: one line per report: what it was read as, what it should have been.
- `feedback/<id>/report.json`: the original guess with its runner-ups, the expected component, the component's drawn and laid-out boxes, every other component on the canvas, and the raw strokes, so a fix can be replayed as a test. It starts with `"status": "open"`.
- `feedback/<id>/sketch.png` and `drawing.png`: the component's sketch as the recognizer saw it, and every sketch on the canvas together.

Claude Code watches `inbox.jsonl` during a tuning session. For each report it adjusts the catalog descriptions (or heuristics), checks the fix with `npm run feedback:replay` (re-sends each saved sketch to Jev; `--all` includes resolved reports as a regression check), and marks the report `"status": "resolved"` with a short `resolution`.

It also runs `npm run eval:guards`, which re-sends the sketches in `eval/guards/` (ones that recognize correctly today, with their expected component and on-screen size in `guards.json`) so a fix for one sketch doesn't break another. Both scripts need the dev server running and call Jev, so they're not part of `npm test`.

## Keys

| Key | Action |
| --- | --- |
| P | Toggle drawing / interacting with placed components |
| E | Toggle edit mode: no drawing; hover highlights a component |
| + / − (edit mode) | Over a label, step its text style: help text, label, body, subtitle, title |
| Drag (edit mode) | Move a component into another container or position |
| Double-click (edit mode) | Edit a component's text |
| Shift+drag | Group the components inside the rect into a flex column |
| D | Draw mode |
| Cmd/Ctrl+D | Duplicate the last thing created (a control comes with its label, a card or group with its contents) straight below it; repeat to keep stacking copies |
| Cmd/Ctrl+Z | Undo the last stroke, component (with its sketch) or cross-out |
