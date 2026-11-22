import { useEffect, useState } from 'react'
import { SketchCanvas } from '@/canvas/SketchCanvas'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { heuristicRecognizer } from '@/recognize/heuristic'
import { createJevRecognizer, jevAvailable } from '@/recognize/jev/recognizer'
import type { Recognizer } from '@/recognize/types'

const jevRecognizer = createJevRecognizer()

export default function App() {
  // Use Jev when the dev server has an OpenRouter key; otherwise shapes only.
  const [engine, setEngine] = useState<{ recognizer: Recognizer; status: string }>({
    recognizer: heuristicRecognizer,
    status: 'Shapes only',
  })
  useEffect(() => {
    jevAvailable().then((ok) => {
      if (ok) setEngine({ recognizer: jevRecognizer, status: 'Jev' })
    })
  }, [])

  return (
    <TooltipProvider>
      <main className="h-dvh w-full bg-background">
        <p className="pointer-events-none absolute left-4 top-4 z-10 text-sm text-muted-foreground">
          Sketch a component. Pause, and it becomes the real thing. P toggles drawing, Cmd+Z undoes.
        </p>
        <SketchCanvas recognizer={engine.recognizer} status={engine.status} />
      </main>
      <Toaster />
    </TooltipProvider>
  )
}
