import { performance } from 'node:perf_hooks'
import { formatMarkdown } from '../src/format.ts'
await formatMarkdown('* warm up\n')
for (const paragraphs of [100, 1000, 5000]) {
  const source =
    '##  Heading  ##\n\n* one\n* two\n\nA paragraph with **bold** and a [link](https://example.com).\n\n'.repeat(
      paragraphs,
    )
  const start = performance.now()
  const result = await formatMarkdown(source)
  console.log(
    JSON.stringify({
      bytes: Buffer.byteLength(source),
      milliseconds: +(performance.now() - start).toFixed(1),
      outputBytes: Buffer.byteLength(result),
    }),
  )
}
