// Re-runs every saved feedback report's sketch through the dev server's Jev
// route and checks it now comes out as the component the user switched to.
//
//   node scripts/replay-feedback.mjs [reps] [--all] [--port 5180]
//
// By default only open reports are replayed; --all includes resolved ones,
// which is the regression check after changing the catalog.
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const reps = Number(args.find((a) => /^\d+$/.test(a)) ?? 1)
const all = args.includes('--all')
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '5180'
const dir = path.resolve('feedback')

const reports = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'sketch.png')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(dir, d.name, 'report.json'), 'utf8')))
  .filter((r) => r.status !== 'invalid' && (all || r.status !== 'resolved'))

let ok = 0
let total = 0
for (const r of reports) {
  const image = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, r.id, 'sketch.png')).toString('base64')
  const { w, h } = r.target.drawnBox
  for (let i = 0; i < reps; i++) {
    const res = await fetch(`http://localhost:${port}/api/recognize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, width: w, height: h }),
    })
    const { ranked, error } = await res.json()
    if (error) {
      console.log(`ERR  ${r.id}: ${error}`)
      continue
    }
    const hit = ranked[0].kind === r.expected
    ok += hit
    total++
    const top = ranked.slice(0, 4).map((x) => `${x.kind} ${x.p.toFixed(2)}`).join(', ')
    console.log(`${hit ? 'OK  ' : 'MISS'} want ${r.expected.padEnd(13)} ${r.status.padEnd(8)} | ${top}  (${r.id})`)
  }
}
console.log(`\n${ok}/${total} as expected`)
