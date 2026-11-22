/**
 * Every shadcn component the canvas can recognize, with how people usually
 * sketch it. Each entry becomes one yes/no question for Jev, and the
 * description is the "true" criterion, so write it as what the drawing looks
 * like, not what the component does.
 *
 * Left out on purpose: form (a wrapper with no look of its own), direction
 * (a provider), and toast (deprecated in favour of sonner).
 */
export const catalog = [
  { kind: 'accordion', name: 'Accordion', sketch: 'A vertical stack of rows separated by lines, each row with a label on the left and a chevron or plus sign on the right; one row may be expanded with text beneath it.' },
  { kind: 'alert', name: 'Alert', sketch: 'A wide box with an icon (circle, exclamation mark or i) at the top left, followed by a bold title line and a line of text.' },
  { kind: 'alert-dialog', name: 'Alert Dialog', sketch: 'A centered box with a title, a sentence of text, and two buttons at the bottom right such as Cancel and Continue; often over a shaded backdrop.' },
  { kind: 'aspect-ratio', name: 'Aspect Ratio', sketch: 'A box with a diagonal cross or a mountain-and-sun image placeholder inside, drawn at a fixed proportion like 16:9.' },
  { kind: 'attachment', name: 'Attachment', sketch: 'A small rounded tile showing a file icon or thumbnail with a filename and a small x to remove it.' },
  { kind: 'avatar', name: 'Avatar', sketch: 'A small circle, possibly with initials or a simple face or head-and-shoulders silhouette inside.' },
  { kind: 'badge', name: 'Badge', sketch: 'A very small pill or rounded rectangle with one short word inside, much smaller than a button.' },
  { kind: 'breadcrumb', name: 'Breadcrumb', sketch: 'A single line of short words separated by slashes or > chevrons, like Home > Docs > Page.' },
  { kind: 'bubble', name: 'Bubble', sketch: 'A chat speech bubble: a rounded box with text and a small tail pointing to one side.' },
  { kind: 'button', name: 'Button', sketch: 'A short, wide rounded rectangle with a word or squiggle centered inside it.' },
  { kind: 'button-group', name: 'Button Group', sketch: 'Two to four buttons drawn touching side by side as one joined strip, divided by vertical lines.' },
  { kind: 'calendar', name: 'Calendar', sketch: 'A grid of small numbered cells in about 7 columns and 5 rows, with a month name and arrows above it.' },
  { kind: 'card', name: 'Card', sketch: 'A large rounded rectangle used as a container, empty or holding a title line and some content.' },
  { kind: 'carousel', name: 'Carousel', sketch: 'A box or image placeholder with a left arrow on one side and a right arrow on the other, sometimes with dots below.' },
  { kind: 'chart', name: 'Chart', sketch: 'Axes with bars, a line graph, or a pie: a vertical and horizontal axis with bars or a zigzag line.' },
  { kind: 'checkbox', name: 'Checkbox', sketch: 'A small square, empty or containing a check mark or x, possibly with a label to its right.' },
  { kind: 'collapsible', name: 'Collapsible', sketch: 'One header row with a label and an up/down chevron, with an indented block of content beneath it.' },
  { kind: 'combobox', name: 'Combobox', sketch: 'A text field with a chevron at the right and a dropdown list of options below it, one possibly checked.' },
  { kind: 'command', name: 'Command', sketch: 'A box with a search field at the top (often a magnifying glass) and a list of menu items beneath, sometimes with group headings.' },
  { kind: 'context-menu', name: 'Context Menu', sketch: 'A small floating list of menu items next to a cursor arrow, as if opened by right-clicking.' },
  { kind: 'dialog', name: 'Dialog', sketch: 'A centered box with a title at the top, an x close button in the top right corner, content, and a button at the bottom right.' },
  { kind: 'drawer', name: 'Drawer', sketch: 'A panel sliding up from the bottom edge with a short grab handle bar centered at its top.' },
  { kind: 'dropdown-menu', name: 'Dropdown Menu', sketch: 'A button or label with a downward chevron and a list of menu items drawn directly below it.' },
  { kind: 'empty', name: 'Empty', sketch: 'A centered icon, a short title and a line of text with a button below, all centered: an empty-state placeholder.' },
  { kind: 'field', name: 'Field', sketch: 'A small label word above a text input box, sometimes with a line of helper text below the box.' },
  { kind: 'hover-card', name: 'Hover Card', sketch: 'A link or underlined word with a floating card above or below it showing an avatar and a few lines of text.' },
  { kind: 'input', name: 'Input', sketch: 'A long, thin, empty rectangle, or one with placeholder text pushed to its left side.' },
  { kind: 'input-group', name: 'Input Group', sketch: 'A text input with an icon, prefix text, or a button attached inside or at one end, like a search box with a magnifying glass.' },
  { kind: 'input-otp', name: 'Input OTP', sketch: 'A row of four to six small separate square boxes for single digits, sometimes with a dash in the middle.' },
  { kind: 'item', name: 'Item', sketch: 'A list row with an icon or avatar on the left, a title and a line of description in the middle, and an action on the right.' },
  { kind: 'kbd', name: 'Kbd', sketch: 'One or more tiny keyboard-key squares with a symbol or letter inside, like ⌘ K.' },
  { kind: 'label', name: 'Label', sketch: 'A single short word or squiggle of text on its own, with no box around it.' },
  { kind: 'marker', name: 'Marker', sketch: 'A small dot, pin, or numbered circle used to point at or mark a spot.' },
  { kind: 'menubar', name: 'Menubar', sketch: 'A thin horizontal bar holding a row of menu words like File Edit View, possibly with one menu open below.' },
  { kind: 'message', name: 'Message', sketch: 'A chat message row: a small avatar circle beside a block of text lines.' },
  { kind: 'message-scroller', name: 'Message Scroller', sketch: 'A tall box holding a stack of chat bubbles alternating left and right, like a conversation.' },
  { kind: 'native-select', name: 'Native Select', sketch: 'A rectangle with text on the left and up/down arrows or a chevron at the right edge, like a plain browser select.' },
  { kind: 'navigation-menu', name: 'Navigation Menu', sketch: 'A horizontal row of nav words, some with small down chevrons, possibly with a large panel of links dropping below one.' },
  { kind: 'pagination', name: 'Pagination', sketch: 'A row of small numbered boxes like 1 2 3 … with Previous and Next arrows at the ends.' },
  { kind: 'popover', name: 'Popover', sketch: 'A floating box with a small pointer triangle aiming at a button or element beside it.' },
  { kind: 'progress', name: 'Progress', sketch: 'A long thin horizontal bar with the left part filled in or shaded.' },
  { kind: 'radio-group', name: 'Radio Group', sketch: 'A vertical list of small circles, one filled with a dot, each with a label to its right.' },
  { kind: 'resizable', name: 'Resizable', sketch: 'A box split into two or more panels by a line with a small grip handle on it.' },
  { kind: 'scroll-area', name: 'Scroll Area', sketch: 'A box of content lines with a thin vertical scrollbar track and thumb along its right edge.' },
  { kind: 'select', name: 'Select', sketch: 'A rectangle with placeholder text on the left and a single downward chevron at the right edge.' },
  { kind: 'separator', name: 'Separator', sketch: 'A single straight horizontal or vertical line on its own.' },
  { kind: 'sheet', name: 'Sheet', sketch: 'A tall panel along the full height of the left or right edge, with a title and an x close button at the top.' },
  { kind: 'sidebar', name: 'Sidebar', sketch: 'A tall narrow column on the left holding a logo at the top and a vertical list of navigation items with icons.' },
  { kind: 'skeleton', name: 'Skeleton', sketch: 'Shaded or hatched placeholder shapes: grey bars for lines of text and a circle, with no real content.' },
  { kind: 'slider', name: 'Slider', sketch: 'A horizontal line with a circle knob somewhere along it, the part left of the knob sometimes thicker.' },
  { kind: 'sonner', name: 'Sonner', sketch: 'A small notification box in a corner with a line or two of text and maybe a small action button: a toast.' },
  { kind: 'spinner', name: 'Spinner', sketch: 'A small circle or broken circle with an arrow or motion lines, like a loading indicator.' },
  { kind: 'switch', name: 'Switch', sketch: 'A small horizontal pill with a circle knob inside at one end, like an on/off toggle.' },
  { kind: 'table', name: 'Table', sketch: 'A grid of rows and columns made of lines, with a header row of column names at the top.' },
  { kind: 'tabs', name: 'Tabs', sketch: 'A row of two to five words with one underlined or boxed as selected, above a content area.' },
  { kind: 'textarea', name: 'Textarea', sketch: 'A wide rectangle several lines tall, empty or with placeholder text at the top left, sometimes with a grip mark at the bottom right corner.' },
  { kind: 'toggle', name: 'Toggle', sketch: 'A small square button holding a single icon such as B, I, a star, or a heart.' },
  { kind: 'toggle-group', name: 'Toggle Group', sketch: 'A row of two to four small square icon buttons side by side, one shaded as active, like bold/italic/underline.' },
  { kind: 'tooltip', name: 'Tooltip', sketch: 'A tiny dark label box with a pointer triangle sitting just above or beside a button or icon.' },
] as const

export type ComponentKind = (typeof catalog)[number]['kind']

export const componentName = (kind: ComponentKind) => catalog.find((c) => c.kind === kind)!.name
