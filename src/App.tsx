import { SketchCanvas } from '@/canvas/SketchCanvas'

export default function App() {
  return (
    <main className="h-dvh w-full bg-background">
      <p className="pointer-events-none absolute left-4 top-4 z-10 text-sm text-muted-foreground">
        Sketch a box. Pause, and it becomes a real component. P toggles drawing, Cmd+Z undoes.
      </p>
      <SketchCanvas />
    </main>
  )
}
