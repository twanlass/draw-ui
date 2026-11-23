import { useEffect, useState } from 'react'
import { SketchCanvas } from '@/canvas/SketchCanvas'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { heuristicRecognizer } from '@/recognize/heuristic'
import { createJevRecognizer, jevAvailable } from '@/recognize/jev/recognizer'
import type { Recognizer } from '@/recognize/types'

const jevRecognizer = createJevRecognizer()
/** Debug mode (match chips, feedback reports) is only offered with ?debug in the URL. */
const showDebug = new URLSearchParams(window.location.search).has('debug')

export default function App() {
  // Use Jev when the dev server has an OpenRouter key; otherwise shapes only.
  const [engine, setEngine] = useState<{ recognizer: Recognizer; name: string }>({
    recognizer: heuristicRecognizer,
    name: 'Shapes only',
  })
  useEffect(() => {
    jevAvailable().then((ok) => {
      if (ok) setEngine({ recognizer: jevRecognizer, name: 'Jev' })
    })
  }, [])

  return (
    <TooltipProvider>
      <main className="h-dvh w-full bg-background">
        <SketchCanvas recognizer={engine.recognizer} engine={engine.name} showDebug={showDebug} />
      </main>
      <Toaster />
    </TooltipProvider>
  )
}
