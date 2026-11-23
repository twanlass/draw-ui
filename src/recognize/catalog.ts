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
  { kind: 'avatar', name: 'Avatar', sketch: 'A plain closed circle, empty or with initials, a simple face or a head-and-shoulders silhouette inside. An empty circle on its own, even with a slight overlap where the stroke closes, is an avatar.' },
  { kind: 'badge', name: 'Badge', sketch: 'A very small pill or rounded rectangle with one short word inside, much smaller than a button.' },
  { kind: 'breadcrumb', name: 'Breadcrumb', sketch: 'A single line of short words separated by slashes or > chevrons, like Home > Docs > Page.' },
  { kind: 'bubble', name: 'Bubble', sketch: 'A chat speech bubble: a rounded box with text and a small tail pointing to one side.' },
  { kind: 'button', name: 'Button', sketch: 'A short, wide rectangle (roughly 60-200px wide, 28-56px tall on screen) with one word, squiggle or short straight line standing for its label, roughly centred inside it. A single line in a small box is a button.' },
  { kind: 'button-group', name: 'Button Group', sketch: 'Two to four buttons drawn touching side by side as one joined strip, divided by vertical lines.' },
  { kind: 'calendar', name: 'Calendar', sketch: 'A grid of small numbered cells in about 7 columns and 5 rows, with a month name and arrows above it.' },
  { kind: 'card', name: 'Card', sketch: 'A large rectangle used as a container, empty or holding a title line and some content. Usually at least about 250px wide and 160px tall on screen; a big empty box that size is a card.' },
  { kind: 'carousel', name: 'Carousel', sketch: 'A box or image placeholder with a left arrow on one side and a right arrow on the other, sometimes with dots below.' },
  { kind: 'chart', name: 'Chart', sketch: 'Axes with bars, a line graph, or a pie: a vertical and horizontal axis with bars or a zigzag line.' },
  { kind: 'checkbox', name: 'Checkbox', sketch: 'A tiny box, under about 45px on each side, empty or containing a check mark or x, often followed by a straight line or scribble to its right standing for its label (so the whole sketch can be much wider than the box). The box is often drawn loosely, a bit wider than tall or not quite closed; any tiny box on its own, or with a line beside it, is a checkbox.' },
  { kind: 'collapsible', name: 'Collapsible', sketch: 'One header row with a label and an up/down chevron, with an indented block of content beneath it.' },
  { kind: 'combobox', name: 'Combobox', sketch: 'A text field with a chevron at the right and a dropdown list of options below it, one possibly checked.' },
  { kind: 'command', name: 'Command', sketch: 'A box with a search field at the top (often a magnifying glass) and a list of menu items beneath, sometimes with group headings.' },
  { kind: 'context-menu', name: 'Context Menu', sketch: 'A small floating list of menu items next to a cursor arrow, as if opened by right-clicking.' },
  { kind: 'dialog', name: 'Dialog', sketch: 'A centered box with a title at the top, an x close button in the top right corner, content, and a button at the bottom right.' },
  { kind: 'drawer', name: 'Drawer', sketch: 'A tall panel sliding up from the bottom edge of a screen, with a short, separate grab handle bar drawn inside it, centred near its top.' },
  { kind: 'dropdown-menu', name: 'Dropdown Menu', sketch: 'A button or label with a downward chevron and a list of menu items drawn directly below it.' },
  { kind: 'empty', name: 'Empty', sketch: 'A centered icon, a short title and a line of text with a button below, all centered: an empty-state placeholder.' },
  { kind: 'field', name: 'Field', sketch: 'A small label word above a text input box, sometimes with a line of helper text below the box.' },
  { kind: 'hover-card', name: 'Hover Card', sketch: 'A link or underlined word with a floating card above or below it showing an avatar and a few lines of text.' },
  { kind: 'input', name: 'Input', sketch: 'A long, thin rectangle about one text line tall (under about 60px) and at least about 100px wide on screen (a tiny box under about 45px is a checkbox, also when a line follows it as its label), empty or with placeholder text pushed to its left side, and no icon, chevron or arrow inside it. A thicker spot, bump or small overlap on the outline is just where the stroke started and ended, not a handle.' },
  { kind: 'input-group', name: 'Input Group', sketch: 'A text input with a magnifying glass, @, $ or similar prefix at its left end, or a separate button attached to one end, like a search box. The icon is drawn inside the outline of the field. A lone down chevron or V at the right end does not count; that is a select. A tiny separate box followed by a line, with no outline around both, is a checkbox with its label.' },
  { kind: 'input-otp', name: 'Input OTP', sketch: 'A row of four to six small separate square boxes for single digits, sometimes with a dash in the middle.' },
  { kind: 'item', name: 'Item', sketch: 'A list row with an icon or avatar on the left, a title and a line of description in the middle, and an action on the right.' },
  { kind: 'kbd', name: 'Kbd', sketch: 'One or more tiny keyboard-key squares with a symbol or letter inside, like ⌘ K.' },
  { kind: 'label', name: 'Label', sketch: 'A single short word or squiggle of text on its own, with no box around it.' },
  { kind: 'marker', name: 'Marker', sketch: 'A small solid filled dot, a map pin (teardrop shape), or a circle with a number inside, used to point at or mark a spot. An empty circle is not a marker.' },
  { kind: 'menubar', name: 'Menubar', sketch: 'A thin horizontal bar holding a row of menu words like File Edit View, possibly with one menu open below.' },
  { kind: 'message', name: 'Message', sketch: 'A chat message row: a small avatar circle beside a block of text lines.' },
  { kind: 'message-scroller', name: 'Message Scroller', sketch: 'A tall box holding a stack of chat bubbles alternating left and right, like a conversation.' },
  { kind: 'native-select', name: 'Native Select', sketch: 'A rectangle with text on the left and a pair of stacked arrows at the right edge, one pointing up above one pointing down, like a plain browser select. A single down chevron is a select, not this.' },
  { kind: 'navigation-menu', name: 'Navigation Menu', sketch: 'A horizontal row of nav words, some with small down chevrons, possibly with a large panel of links dropping below one.' },
  { kind: 'pagination', name: 'Pagination', sketch: 'A row of small numbered boxes like 1 2 3 … with Previous and Next arrows at the ends.' },
  { kind: 'popover', name: 'Popover', sketch: 'A floating box with a small pointer triangle aiming at a button or element beside it.' },
  { kind: 'progress', name: 'Progress', sketch: 'A long thin horizontal bar with the left part filled in or shaded.' },
  { kind: 'radio-group', name: 'Radio Group', sketch: 'A vertical list of small circles, one filled with a dot, each with a label to its right.' },
  { kind: 'resizable', name: 'Resizable', sketch: 'A box split into two or more panels by a dividing line that runs all the way across it, edge to edge, with a small grip handle on that line. Without a line across the box it is not resizable.' },
  { kind: 'scroll-area', name: 'Scroll Area', sketch: 'A box of content lines with a thin vertical scrollbar track and thumb along its right edge.' },
  { kind: 'select', name: 'Select', sketch: 'A rectangle with placeholder text or a line on the left and a single downward chevron, V, check-like tick or small down arrow at its right end: a closed dropdown. Any one down-pointing mark at the right end of a box means a select.' },
  { kind: 'separator', name: 'Separator', sketch: 'A single straight horizontal or vertical line on its own.' },
  { kind: 'sheet', name: 'Sheet', sketch: 'A tall panel along the full height of the left or right edge, with a title and an x close button at the top.' },
  { kind: 'sidebar', name: 'Sidebar', sketch: 'A tall narrow column on the left holding a logo at the top and a vertical list of navigation items with icons.' },
  { kind: 'skeleton', name: 'Skeleton', sketch: 'Shaded or hatched placeholder shapes: grey bars for lines of text and a circle, with no real content.' },
  { kind: 'slider', name: 'Slider', sketch: 'A horizontal line with a circle knob somewhere along it, the part left of the knob sometimes thicker.' },
  { kind: 'sonner', name: 'Sonner', sketch: 'A notification box, usually 250px or wider, with two lines of text (or a title and a description) and often a small action button or close mark at its right: a toast. A small box with a single line inside is a button, not a toast.' },
  { kind: 'spinner', name: 'Spinner', sketch: 'A loading indicator: a circle with a clear gap in it (an open arc, like a C), often with an arrowhead at one end, or short spokes or dashes radiating around an empty centre. A complete closed circle with no gap, arrow or spokes is not a spinner.' },
  { kind: 'switch', name: 'Switch', sketch: 'A horizontal pill or capsule with round ends, about two to four times as wide as it is tall, with a circle knob at its left or right end that may overlap or be drawn over the outline: an on/off toggle. Often sketched much bigger than a real switch.' },
  { kind: 'table', name: 'Table', sketch: 'A grid of rows and columns made of lines, with a header row of column names at the top.' },
  { kind: 'tabs', name: 'Tabs', sketch: 'A row of two to five words with one underlined or boxed as selected, above a content area.' },
  { kind: 'textarea', name: 'Textarea', sketch: 'A mid-sized rectangle a few text lines tall, empty or with placeholder text at the top left, sometimes with a grip mark at the bottom right corner. Roughly 60 to 150px tall and 1.5 to 4 times as wide as tall on screen; an empty box that size is a textarea (taller than one line, so not an input, and too small to be a card).' },
  { kind: 'toggle', name: 'Toggle', sketch: 'A small square button holding a single icon such as B, I, a star, or a heart.' },
  { kind: 'toggle-group', name: 'Toggle Group', sketch: 'A row of two to four small square icon buttons side by side, one shaded as active, like bold/italic/underline.' },
  { kind: 'tooltip', name: 'Tooltip', sketch: 'A tiny dark label box with a pointer triangle sitting just above or beside a button or icon.' },
] as const

export type ComponentKind = (typeof catalog)[number]['kind']

export const componentName = (kind: ComponentKind) => catalog.find((c) => c.kind === kind)!.name
