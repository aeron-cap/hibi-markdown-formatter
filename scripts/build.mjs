import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = new URL('../', import.meta.url)
const output = new URL('addons/markdown-formatter/', root)
for (const [entry, file] of [
  ['src/index.ts', 'index.js'],
  ['src/format-worker.ts', 'format-worker.js'],
]) {
  const result = await build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: [entry],
    outfile: fileURLToPath(new URL(file, output)),
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    metafile: true,
    write: !process.argv.includes('--verify'),
  })
  if (
    process.argv.includes('--verify') &&
    (await readFile(new URL(file, output), 'utf8')) !== result.outputFiles[0].text
  )
    throw new Error('The committed addon bundle is out of date. Run npm run build.')
  for (const input of Object.keys(result.metafile.inputs))
    if (input.includes('hibi-addon-sdk') || input.includes('/workspace/hibi/'))
      throw new Error('The runtime bundle must not contain Hibi source or SDK code.')
}
if (!process.argv.includes('--verify')) {
  const prettierLicense = await readFile(new URL('node_modules/prettier/LICENSE', root), 'utf8')
  await writeFile(
    new URL('THIRD_PARTY_NOTICES.txt', output),
    'Prettier 3.9.10\nhttps://github.com/prettier/prettier\n\n' + prettierLicense,
  )
}
console.log('Built offline Markdown formatter and worker.')
