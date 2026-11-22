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

1. **Group.** Strokes collect into an open group. A 700ms pause, or starting a new stroke more than 48px away, closes it (`src/canvas/state.ts`).
2. **Recognize.** The closed group goes to a `Recognizer` (`src/recognize/types.ts`), which returns a component kind and box, or `null` to leave the sketch alone.
3. **Swap.** On a match, the strokes are replaced by the real component (`src/canvas/renderers.tsx`). A chip under it shows the pick and its probability, and opens the runners-up so you can switch. Cmd/Ctrl+Z restores the sketch.

### Jev recognizer

`src/recognize/jev/` renders the sketch to a PNG (256 to 1568 px, small sketches padded rather than blown up) and posts it to `/api/recognize`, a dev-server route in `server/jev-plugin.ts` that holds the API key. That route sends one Decisions API call with **one yes/no question per shadcn component** (`src/recognize/catalog.ts`, 59 questions) and the sketch's on-screen size. Components are ranked by their probability. The top one wins if it's at least 0.5; otherwise the sketch stays.

Overlay components (dialog, sheet, drawer, popover, tooltip, dropdown, alert dialog, sonner) render as their real trigger, and open in interact mode.

The route only exists in `vite dev` and `vite preview`. A deployed build needs its own server route.

### Shape heuristics (fallback)

`src/recognize/heuristic.ts` uses shape only:

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
