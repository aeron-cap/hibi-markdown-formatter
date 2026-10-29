import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
const index = process.argv.indexOf('--hibi')
const hibi = resolve(index < 0 ? '../hibi' : process.argv[index + 1])
const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--test', '--test-concurrency=1', 'test/installed.ts'],
  { stdio: 'inherit', env: { ...process.env, HIBI_CHECKOUT: hibi } },
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
