// Runs the guard sketches in eval/guards through the dev server's Jev route
// and checks each still comes out as expected. The guards are sketches that
// recognize correctly today; run this after changing catalog descriptions,
// alongside feedback:replay, to catch a fix for one sketch breaking another.
//
//   node scripts/eval-guards.mjs [reps] [--port 5180]
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const reps = Number(args.find((a) => /^\d+$/.test(a)) ?? 1)
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '5180'
const dir = path.resolve('eval/guards')
const guards = JSON.parse(fs.readFileSync(path.join(dir, 'guards.json'), 'utf8'))

let ok = 0
let total = 0
for (const [name, { expected, w, h }] of Object.entries(guards)) {
  const image = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, `${name}.png`)).toString('base64')
  for (let i = 0; i < reps; i++) {
    const res = await fetch(`http://localhost:${port}/api/recognize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image, width: w, height: h }),
    })
    const { ranked, error } = await res.json()
    if (error) {
      console.log(`ERR  ${name}: ${error}`)
      continue
    }
    const hit = ranked[0].kind === expected
    ok += hit
    total++
    const top = ranked.slice(0, 4).map((x) => `${x.kind} ${x.p.toFixed(2)}`).join(', ')
    console.log(`${hit ? 'OK  ' : 'MISS'} ${name.padEnd(17)} want ${expected.padEnd(13)} | ${top}`)
  }
}
console.log(`\n${ok}/${total} as expected`)
