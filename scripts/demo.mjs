// Records a scripted demo of the canvas to an mp4: sketch a field, group it,
// duplicate it, edit every text in Edit mode with Tab, then draw a card
// around the form. Drives real mouse and keyboard input against the dev
// server (with Jev), in the installed Google Chrome.
//
//   npm run dev                      # in another terminal, port 5180
//   node scripts/demo.mjs [--port 5180] [--out recordings/demo.mp4] [--show]
//
// Each sketch is checked after recognition; a wrong guess is undone and
// redrawn, so a flaky read doesn't spoil the take.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const port = opt('--port', '5180')
const out = path.resolve(opt('--out', 'recordings/demo.mp4'))
const VIEW = { width: 1280, height: 800 }

// A drawn arrow cursor, since recorded video doesn't include the real one.
const CURSOR = `
  window.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div')
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l7 19 2.5-7.5L21 11z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-3px,-2px)', transition: 'scale 80ms' })
    document.body.appendChild(c)
    addEventListener('pointermove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
    addEventListener('pointerdown', () => (c.style.scale = '0.85'), true)
    addEventListener('pointerup', () => (c.style.scale = '1'), true)
  })`

fs.mkdirSync(path.dirname(out), { recursive: true })
const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.demo-'))
const browser = await chromium.launch({ channel: 'chrome', headless: !args.includes('--show') })
const context = await browser.newContext({ viewport: VIEW, recordVideo: { dir: tmp, size: VIEW } })
await context.addInitScript(CURSOR)
const page = await context.newPage()
const pause = (ms) => page.waitForTimeout(ms)
const mouse = page.mouse

// --- Drawing -------------------------------------------------------------

/** Points along a line with a little hand wobble. */
function line([ax, ay], [bx, by], seed = 0) {
  const n = Math.max(8, Math.round(Math.hypot(bx - ax, by - ay) / 12))
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return [ax + (bx - ax) * t + Math.sin(i * 1.7 + seed) * 0.9, ay + (by - ay) * t + Math.cos(i * 1.3 + seed) * 0.9]
  })
}
const box = (x, y, w, h) => [
  ...line([x, y], [x + w, y], 1),
  ...line([x + w, y], [x + w, y + h], 2).slice(1),
  ...line([x + w, y + h], [x, y + h], 3).slice(1),
  ...line([x, y + h], [x + 2, y + 3], 4).slice(1),
]

/** One stroke at drawing speed. */
async function stroke(points) {
  await mouse.move(...points[0], { steps: 12 })
  await mouse.down()
  for (const p of points.slice(1)) {
    await mouse.move(...p)
    await pause(9)
  }
  await mouse.up()
}

const placed = () =>
  page.$$eval('[data-kind]', (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { id: e.dataset.id, kind: e.dataset.kind, x: r.x, y: r.y, w: r.width, h: r.height }
    }),
  )

/** Wait until there are `count` components and nothing is still being recognized. */
async function settle(count) {
  for (let i = 0; i < 120; i++) {
    const now = await placed()
    const busy = await page.evaluate(() => document.body.innerText.includes('Recognizing'))
    if (now.length >= count && !busy) return now
    await pause(150)
  }
  throw new Error(`timed out waiting for ${count} components`)
}

/** Draw a sketch and check it became `kind`; undo and redraw if not. */
async function sketch(kind, strokes) {
  const was = await placed()
  const old = new Set(was.map((p) => p.id))
  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const s of strokes) await stroke(s)
    const fresh = (await settle(was.length + 1)).filter((p) => !old.has(p.id))
    const made = fresh.find((p) => p.kind === kind)
    if (made) return made
    console.log(`  read as ${fresh.map((p) => p.kind).join(', ')}, not ${kind}; redrawing (attempt ${attempt})`)
    await page.keyboard.press('Meta+z')
    await pause(400)
  }
  throw new Error(`couldn't get a ${kind}`)
}

const step = (n, what) => console.log(`${n}. ${what}`)

// --- The demo ------------------------------------------------------------

await page.goto(`http://localhost:${port}/`)
// The app switches to Jev once the dev server says it has a key.
await pause(1500)
await mouse.move(VIEW.width / 2, VIEW.height - 160)
await pause(600)

const X = 470
step(1, 'draw an input')
const input = await sketch('input', [box(X, 290, 340, 46)])
await pause(400)

step(2, 'draw a label above it')
await sketch('label', [line([X + 4, input.y - 28], [X + 100, input.y - 30], 5)])
await pause(500)

step(3, 'group them (Shift+drag)')
{
  const [l, i] = [...(await placed())].sort((a, b) => a.y - b.y)
  const top = l.y - 18
  const bottom = i.y + i.h + 18
  await mouse.move(X - 30, top, { steps: 15 })
  await page.keyboard.down('Shift')
  await mouse.down()
  await mouse.move(X + i.w + 30, bottom, { steps: 30 })
  await pause(150)
  await mouse.up()
  await page.keyboard.up('Shift')
}
await pause(700)

step(4, 'duplicate it twice (Cmd+D)')
await page.keyboard.press('Meta+d')
await pause(700)
await page.keyboard.press('Meta+d')
await pause(900)

step('4b', 'draw a button under the form')
{
  const groups = (await placed()).filter((p) => p.kind === 'group').sort((a, b) => a.y - b.y)
  const last = groups.at(-1)
  const y = last.y + last.h + 34
  await sketch('button', [box(X, y, 200, 46), line([X + 70, y + 24], [X + 132, y + 23], 6)])
}
await pause(800)

step(5, 'Edit mode (E)')
await page.keyboard.press('e')
await pause(600)

const texts = ['First name', 'Michael', 'Last name', 'Bluth', 'Email', 'michael@bluth.ai', 'Submit']
step(6, 'edit the first label')
{
  const first = (await placed()).filter((p) => p.kind === 'label').sort((a, b) => a.y - b.y)[0]
  await mouse.move(first.x + 20, first.y + first.h / 2, { steps: 25 })
  await pause(300)
  await mouse.dblclick(first.x + 20, first.y + first.h / 2)
}
for (const [i, text] of texts.entries()) {
  if (i > 0) {
    step(6 + i, `Tab, then "${text}"`)
    await page.keyboard.press('Tab')
  }
  await pause(350)
  await page.keyboard.type(text, { delay: 65 })
  await pause(350)
}
await page.keyboard.press('Enter')
await pause(700)

step(13, 'back to Draw mode (D)')
await page.keyboard.press('d')
await pause(500)

step(14, 'draw a card around the form')
{
  const all = await placed()
  const x = Math.min(...all.map((p) => p.x)) - 34
  const y = Math.min(...all.map((p) => p.y)) - 34
  const w = Math.max(...all.map((p) => p.x + p.w)) - x + 34
  const h = Math.max(...all.map((p) => p.y + p.h)) - y + 34
  await sketch('card', [box(x, y, w, h)])
}
await mouse.move(VIEW.width - 200, VIEW.height - 120, { steps: 30 })
await pause(2500)

// --- Save ----------------------------------------------------------------

const video = page.video()
await context.close()
await browser.close()
const webm = await video.path()
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out])
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\nSaved ${path.relative(process.cwd(), out)}`)
