# draw-ui

Sketch an app UI and watch it turn into real components. Draw a box, pause, and the sketch is swapped for the matching [shadcn/ui](https://ui.shadcn.com) component at the same position and size.

Stroke rendering comes from [scribble](https://github.com/twanlass/scribble)'s `freehand.js`, vendored in `src/lib/`.

## Run

```bash
npm install
npm run dev
npm test
```

## How it works

1. **Group.** Strokes collect into an open group. A 700ms pause, or starting a new stroke more than 48px away, closes it (`src/canvas/state.ts`).
2. **Recognize.** The closed group goes to a `Recognizer` (`src/recognize/types.ts`), which returns a component kind and box, or `null` to leave the sketch alone.
3. **Swap.** On a match, the strokes are replaced by the real component (`src/canvas/PlacedComponent.tsx`). Cmd/Ctrl+Z restores the sketch.

The v1 recognizer (`src/recognize/heuristic.ts`) uses shape only:

| Sketch | Component |
| --- | --- |
| Small square | Checkbox |
| Big box | Card |
| Short wide box, marks centered inside | Button |
| Short wide box, empty or marks on the left | Input |

Boxes can be drawn in one stroke or as separate sides. It can't read handwriting, so labels are placeholder text.

## Keys

| Key | Action |
| --- | --- |
| P | Toggle drawing / interacting with placed components |
| Cmd/Ctrl+Z | Undo the last stroke or swap |
