import type { ReactNode } from 'react'
import { Bar, BarChart, XAxis } from 'recharts'
import {
  AlertCircleIcon,
  BatteryFullIcon,
  BoldIcon,
  ChevronRightIcon,
  FileIcon,
  HomeIcon,
  InboxIcon,
  ItalicIcon,
  SearchIcon,
  SettingsIcon,
  SignalIcon,
  UnderlineIcon,
  WifiIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Attachment, AttachmentContent, AttachmentMedia, AttachmentTitle } from '@/components/ui/attachment'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Bubble, BubbleContent, BubbleGroup } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Marker, MarkerContent } from '@/components/ui/marker'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Box } from '@/lib/geometry'
import { cn } from '@/lib/utils'
import { PHONE_BEZEL, type PlacedKind } from './frames'
import { textStyleInfo, type TextStyle } from './textStyles'

export interface RenderProps {
  box: Box
  label?: string
  /** For a label: which kind of text. */
  textStyle?: TextStyle
}

/** How each kind of text looks; line heights match textStyles.ts so layout fits them. */
const TEXT_CLASS: Record<Exclude<TextStyle, 'label'>, string> = {
  help: 'text-xs leading-4 text-muted-foreground',
  body: 'text-base leading-6',
  subtitle: 'text-lg leading-7 text-muted-foreground',
  title: 'text-2xl leading-8 font-semibold tracking-tight',
}

const isWide = (b: Box) => b.w >= b.h

const chartConfig = { value: { label: 'Value', color: 'var(--primary)' } } satisfies ChartConfig
const chartData = [3, 5, 2, 6, 4, 7].map((value, i) => ({ month: 'JFMAMJ'[i], value }))

/**
 * How each component looks when it replaces a sketch, centred in the sketch's
 * box. Containers (card, textarea, table…) fill it. Controls with a standard
 * height (input, button, select…) take the sketch's width but keep their real
 * height, since nobody draws a field exactly 36px tall. Overlays (dialogs, menus, tooltips) render as their real trigger and
 * open for real in interact mode, since an always-open overlay can't sit in
 * place on a canvas.
 */
export const renderers: Record<PlacedKind, (p: RenderProps) => ReactNode> = {
  // An invisible flex container from a Shift+drag; outlined while drawing.
  group: () => <div className="size-full" />,
  // A device frame: bezel, status bar and home indicator. What's drawn inside
  // it is laid out in its screen area (see PHONE_INSETS).
  phone: () => (
    <div
      className="relative size-full rounded-[44px] border-neutral-900 bg-background shadow-xl dark:border-neutral-700"
      style={{ borderWidth: PHONE_BEZEL }}
    >
      <div className="flex h-11 items-center justify-between px-7 text-xs font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <SignalIcon className="size-3.5" />
          <WifiIcon className="size-3.5" />
          <BatteryFullIcon className="size-4" />
        </span>
      </div>
      <div className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
      <div className="absolute bottom-2 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-foreground/80" />
    </div>
  ),
  accordion: () => (
    <Accordion type="single" collapsible defaultValue="a" className="size-full overflow-hidden">
      {['Is it accessible?', 'Is it styled?', 'Is it animated?'].map((q, i) => (
        <AccordionItem key={q} value={'abc'[i]}>
          <AccordionTrigger>{q}</AccordionTrigger>
          <AccordionContent>Yes.</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
  alert: ({ label }) => (
    <Alert className="size-full">
      <AlertCircleIcon />
      <AlertTitle>{label ?? 'Heads up!'}</AlertTitle>
      <AlertDescription>You can add components to your app.</AlertDescription>
    </Alert>
  ),
  'alert-dialog': ({ label }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full">
          {label ?? 'Open alert dialog'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  'aspect-ratio': ({ box }) => (
    <div style={{ width: box.w }}>
      <AspectRatio ratio={box.w / box.h} className="rounded-md bg-muted" />
    </div>
  ),
  attachment: ({ label }) => (
    <Attachment>
      <AttachmentMedia>
        <FileIcon />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{label ?? 'report.pdf'}</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
  ),
  // Auto layout has already sized the box to a standard size (layout.ts).
  avatar: ({ box }) => (
    <Avatar style={{ width: Math.min(box.w, box.h), height: Math.min(box.w, box.h) }}>
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
  badge: ({ label }) => <Badge>{label ?? 'Badge'}</Badge>,
  breadcrumb: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Components</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  bubble: ({ label }) => (
    <BubbleGroup className="size-full">
      <Bubble>
        <BubbleContent>{label ?? 'Hey, how is it going?'}</BubbleContent>
      </Bubble>
    </BubbleGroup>
  ),
  button: ({ label }) => <Button className="w-full">{label ?? 'Button'}</Button>,
  'button-group': () => (
    <ButtonGroup>
      <Button variant="outline">Archive</Button>
      <Button variant="outline">Report</Button>
      <Button variant="outline">Snooze</Button>
    </ButtonGroup>
  ),
  calendar: () => <Calendar mode="single" className="rounded-md border" />,
  card: () => <Card className="size-full" />,
  carousel: ({ box }) => (
    <Carousel className="h-full" style={{ width: Math.max(box.w - 96, 80) }}>
      <CarouselContent>
        {[1, 2, 3].map((n) => (
          <CarouselItem key={n}>
            <Card style={{ height: box.h }}>
              <CardContent className="flex h-full items-center justify-center text-3xl font-semibold">
                {n}
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
  chart: () => (
    <ChartContainer config={chartConfig} className="size-full">
      <BarChart data={chartData}>
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
  checkbox: ({ label }) => <Checkbox aria-label={label ?? 'Checkbox'} />,
  collapsible: () => (
    <Collapsible defaultOpen className="w-full space-y-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          3 repositories <ChevronRightIcon />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-2 text-sm">@radix-ui/primitives</div>
        <div className="rounded-md border px-4 py-2 text-sm">@radix-ui/colors</div>
      </CollapsibleContent>
    </Collapsible>
  ),
  combobox: ({ label }) => (
    <Combobox items={['Next.js', 'Remix', 'Astro']}>
      <ComboboxInput placeholder={label ?? 'Select framework...'} className="w-full" />
      <ComboboxContent>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  ),
  command: () => (
    <Command className="size-full rounded-lg border">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandGroup heading="Suggestions">
          <CommandItem>Calendar</CommandItem>
          <CommandItem>Search</CommandItem>
          <CommandItem>Settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
  'context-menu': () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex size-full items-center justify-center rounded-md border border-dashed text-sm">
        Right click here
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>Back</ContextMenuItem>
        <ContextMenuItem>Forward</ContextMenuItem>
        <ContextMenuItem>Reload</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
  dialog: ({ label }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          {label ?? 'Open dialog'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Make changes to your profile here.</DialogDescription>
        </DialogHeader>
        <Input defaultValue="Pedro Duarte" />
        <DialogFooter>
          <Button>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
  drawer: ({ label }) => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full">
          {label ?? 'Open drawer'}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Move goal</DrawerTitle>
          <DrawerDescription>Set your daily activity goal.</DrawerDescription>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  ),
  'dropdown-menu': ({ label }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full">
          {label ?? 'Open menu'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  empty: () => (
    <Empty className="size-full border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No messages</EmptyTitle>
        <EmptyDescription>You're all caught up.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
  field: ({ label }) => (
    <Field className="w-full">
      <FieldLabel htmlFor="field">{label ?? 'Email'}</FieldLabel>
      <Input id="field" placeholder="you@example.com" />
      <FieldDescription>We'll never share it.</FieldDescription>
    </Field>
  ),
  'hover-card': () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@nextjs</Button>
      </HoverCardTrigger>
      <HoverCardContent>The React Framework, created and maintained by @vercel.</HoverCardContent>
    </HoverCard>
  ),
  input: ({ label }) => <Input className="w-full" placeholder={label ?? 'Input'} />,
  'input-group': ({ label }) => (
    <InputGroup className="w-full">
      <InputGroupInput placeholder={label ?? 'Search...'} />
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
    </InputGroup>
  ),
  'input-otp': () => (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  ),
  item: ({ label }) => (
    <Item variant="outline" className="w-full">
      <ItemMedia variant="icon">
        <FileIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{label ?? 'Quarterly report'}</ItemTitle>
        <ItemDescription>Updated 2 hours ago</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          Open
        </Button>
      </ItemActions>
    </Item>
  ),
  kbd: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
  label: ({ label, textStyle = 'label' }) =>
    textStyle === 'label' ? (
      <Label className="w-full">{label ?? 'Label'}</Label>
    ) : (
      <p className={cn('w-full truncate', TEXT_CLASS[textStyle])}>{label ?? textStyleInfo(textStyle).placeholder}</p>
    ),
  marker: () => (
    <Marker>
      <MarkerContent>1</MarkerContent>
    </Marker>
  ),
  menubar: () => (
    <Menubar className="w-full">
      {['File', 'Edit', 'View'].map((m) => (
        <MenubarMenu key={m}>
          <MenubarTrigger>{m}</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New</MenubarItem>
            <MenubarItem>Open</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  ),
  message: ({ label }) => (
    <Message>
      <MessageAvatar>
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>{label ?? 'Here is the summary you asked for.'}</MessageContent>
    </Message>
  ),
  'message-scroller': () => (
    <MessageScrollerProvider>
      <MessageScroller className="rounded-md border">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-2 p-3">
            {['Hi there!', 'Hey! What can I help with?', 'Sketch me a login form.'].map((t, i) => (
              <MessageScrollerItem key={t}>
                <Bubble align={i % 2 ? 'start' : 'end'}>
                  <BubbleContent>{t}</BubbleContent>
                </Bubble>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  ),
  'native-select': ({ label }) => (
    <NativeSelect className="w-full">
      <NativeSelectOption value="">{label ?? 'Select a fruit'}</NativeSelectOption>
      <NativeSelectOption value="apple">Apple</NativeSelectOption>
    </NativeSelect>
  ),
  'navigation-menu': () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink className="w-48">Introduction</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#">Docs</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
  pagination: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        {[1, 2, 3].map((n) => (
          <PaginationItem key={n}>
            <PaginationLink href="#" isActive={n === 2}>
              {n}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
  popover: ({ label }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full">
          {label ?? 'Open popover'}
        </Button>
      </PopoverTrigger>
      <PopoverContent>Set the dimensions for the layer.</PopoverContent>
    </Popover>
  ),
  progress: () => <Progress value={60} className="w-full" />,
  'radio-group': () => (
    <RadioGroup defaultValue="a">
      {['Default', 'Comfortable', 'Compact'].map((o, i) => (
        <div key={o} className="flex items-center gap-2">
          <RadioGroupItem value={'abc'[i]} id={`r-${o}`} />
          <Label htmlFor={`r-${o}`}>{o}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
  resizable: ({ box }) => (
    <ResizablePanelGroup orientation={isWide(box) ? 'horizontal' : 'vertical'} className="rounded-lg border">
      <ResizablePanel defaultSize={50}>
        <div className="flex h-full items-center justify-center text-sm">One</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50}>
        <div className="flex h-full items-center justify-center text-sm">Two</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
  'scroll-area': () => (
    <ScrollArea className="size-full rounded-md border">
      <div className="p-4 text-sm">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="py-1">
            v1.2.0-beta.{i}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
  select: ({ label }) => (
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={label ?? 'Select a fruit'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectContent>
    </Select>
  ),
  separator: ({ box }) => <Separator orientation={isWide(box) ? 'horizontal' : 'vertical'} />,
  sheet: ({ label }) => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full">
          {label ?? 'Open sheet'}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Make changes to your profile here.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  sidebar: () => (
    <SidebarProvider className="size-full min-h-0">
      <Sidebar collapsible="none" className="size-full rounded-md border">
        <SidebarHeader className="font-semibold">Acme</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {[
                ['Home', HomeIcon],
                ['Inbox', InboxIcon],
                ['Settings', SettingsIcon],
              ].map(([name, Icon]) => (
                <SidebarMenuItem key={name as string}>
                  <SidebarMenuButton>
                    <Icon />
                    <span>{name as string}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  ),
  skeleton: () => (
    <div className="flex size-full items-center gap-3">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  ),
  slider: () => <Slider defaultValue={[50]} max={100} className="w-full" />,
  sonner: ({ label }) => (
    <Button variant="outline" className="w-full" onClick={() => toast('Event has been created')}>
      {label ?? 'Show toast'}
    </Button>
  ),
  spinner: ({ box }) => <Spinner style={{ width: Math.min(box.w, box.h), height: Math.min(box.w, box.h) }} />,
  switch: () => <Switch />,
  table: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {['INV001', 'INV002', 'INV003'].map((inv) => (
          <TableRow key={inv}>
            <TableCell>{inv}</TableCell>
            <TableCell>Paid</TableCell>
            <TableCell className="text-right">$250.00</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  tabs: () => (
    <Tabs defaultValue="account" className="size-full">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="text-sm text-muted-foreground">
        Make changes to your account here.
      </TabsContent>
      <TabsContent value="password" className="text-sm text-muted-foreground">
        Change your password here.
      </TabsContent>
    </Tabs>
  ),
  textarea: ({ label }) => <Textarea className="size-full resize-none" placeholder={label ?? 'Type your message here.'} />,
  toggle: () => (
    <Toggle aria-label="Toggle bold">
      <BoldIcon />
    </Toggle>
  ),
  'toggle-group': () => (
    <ToggleGroup type="multiple" variant="outline">
      <ToggleGroupItem value="bold" aria-label="Bold">
        <BoldIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <ItalicIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <UnderlineIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
  tooltip: ({ label }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" className="w-full">
          {label ?? 'Hover'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Add to library</TooltipContent>
    </Tooltip>
  ),
}
