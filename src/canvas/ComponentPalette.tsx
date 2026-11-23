import { Dialog as DialogPrimitive } from 'radix-ui'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { catalog, type ComponentKind } from '@/recognize/catalog'

/**
 * Cmd/Ctrl+K: a search box in the middle of the screen over a light dim.
 * Type to filter the components; Enter (or a click) adds the highlighted one.
 */
export function ComponentPalette({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (kind: ComponentKind) => void
}) {
  const kinds = [...catalog].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-background shadow-lg outline-none sm:max-w-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Add a component</DialogPrimitive.Title>
          <Command filter={rank}>
            <CommandInput placeholder="Add a component…" />
            {/* Five rows (32px each) plus padding, the same height whatever matches, so typing never resizes it. */}
            <CommandList className="h-[168px] max-h-none scroll-py-1 p-1">
              <CommandEmpty>No components found.</CommandEmpty>
              {kinds.map((c) => (
                <CommandItem
                  key={c.kind}
                  // Searched by name, and by kind for names like "Native Select".
                  value={`${c.name} ${c.kind}`}
                  onSelect={() => onPick(c.kind)}
                >
                  {c.name}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * Plain matching, not fuzzy: a name starting with the query first, then a word
 * in it starting with it, then containing it anywhere. "car" finds Card,
 * Carousel and Hover Card, but not Chart or Breadcrumb.
 */
function rank(value: string, search: string): number {
  const v = value.toLowerCase()
  const q = search.trim().toLowerCase()
  if (!q) return 1
  if (v.startsWith(q)) return 1
  if (v.split(/[\s-]+/).some((w) => w.startsWith(q))) return 0.8
  return v.includes(q) ? 0.5 : 0
}
