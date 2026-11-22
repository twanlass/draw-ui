import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { Placed } from './state'

/** Renders the real shadcn component at the sketch's position and size. */
export function PlacedComponent({ placed }: { placed: Placed }) {
  const { box, kind, label } = placed
  return (
    <div
      data-kind={kind}
      className="absolute flex items-center justify-center animate-in fade-in zoom-in-95 duration-150"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      {kind === 'button' && <Button className="size-full">{label ?? 'Button'}</Button>}
      {kind === 'input' && <Input className="size-full" placeholder={label ?? 'Input'} />}
      {kind === 'checkbox' && <Checkbox aria-label={label ?? 'Checkbox'} />}
      {kind === 'card' && <Card className="size-full" />}
    </div>
  )
}
