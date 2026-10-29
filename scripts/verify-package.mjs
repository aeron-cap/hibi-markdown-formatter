import { readdir, stat, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
const folder = new URL('../addons/markdown-formatter/', import.meta.url)
const files = await readdir(folder)
let bytes = 0
for (const file of files) {
  const info = await stat(new URL(file, folder))
  if (!info.isFile() || info.size > 5 * 1024 * 1024)
    throw new Error('Invalid package file: ' + file)
  bytes += info.size
}
if (files.length > 999 || bytes > 25 * 1024 * 1024) throw new Error('Package exceeds Hibi limits.')
const manifest = JSON.parse(await readFile(new URL('hibi-addon.json', folder), 'utf8'))
if (
  manifest.apiVersion !== 3 ||
  manifest.capabilities.length ||
  manifest.commands[0].id !== 'format' ||
  manifest.commands[0].defaultShortcut
)
  throw new Error('Unexpected addon contract.')
execFileSync(process.execPath, ['scripts/build.mjs', '--verify'], { stdio: 'inherit' })
console.log('Installable package: ' + files.length + ' files, ' + bytes + ' bytes.')
