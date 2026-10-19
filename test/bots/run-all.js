// Runs every scenario in sequence and fails if any of them failed
const { spawnSync } = require('child_process')
const path = require('path')

const scenarios = [
  ['global.js'],
  ['global.js', 'hardcore'],
  ['perplayer.js'],
  ['perplayer.js', 'hardcore'],
  ['locale.js']
]

const failed = []
for (const args of scenarios) {
  const name = args.join(' ')
  console.log(`\n=== ${name}`)
  const result = spawnSync(process.execPath, [path.join(__dirname, args[0]), ...args.slice(1)], { stdio: 'inherit' })
  if (result.status !== 0) failed.push(name)
}

console.log(failed.length ? `\nFailed scenarios: ${failed.join(', ')}` : '\nAll scenarios passed')
process.exit(failed.length ? 1 : 0)
