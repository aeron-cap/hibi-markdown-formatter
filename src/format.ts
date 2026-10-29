import { format } from 'prettier/standalone'
import * as markdown from 'prettier/plugins/markdown'

/** Preserve metadata verbatim rather than asking a formatter to serialize YAML. */
export function splitPrefix(source: string): { prefix: string; body: string } {
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : ''
  const text = source.slice(bom.length)
  const opening = /^---[ \t]*(?:\r\n|\n|\r)/.exec(text)
  if (!opening) return { prefix: bom, body: text }
  const rest = text.slice(opening[0].length)
  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r\n|\n|\r|$)/m.exec(rest)
  if (!closing) throw new Error('Close the YAML frontmatter before formatting this note.')
  const end = opening[0].length + closing.index + closing[0].length
  // Blank lines belong to the protected metadata prefix too.
  const spacing = /^(?:[ \t]*(?:\r\n|\n|\r))*/.exec(text.slice(end))![0]
  const boundary = end + spacing.length
  return { prefix: bom + text.slice(0, boundary), body: text.slice(boundary) }
}

/** Pure source-to-source operation; it neither reads Hibi state nor saves files. */
export async function formatMarkdown(source: string): Promise<string> {
  const { prefix, body } = splitPrefix(source)
  if (!body) return source
  const firstBreak = /\r\n|\n|\r/.exec(body)?.[0]
  const endOfLine = firstBreak === '\r\n' ? 'crlf' : firstBreak === '\r' ? 'cr' : 'lf'
  const formatted = await format(body, {
    parser: 'markdown',
    plugins: [markdown],
    proseWrap: 'preserve',
    embeddedLanguageFormatting: 'off',
    printWidth: 80,
    tabWidth: 2,
    endOfLine,
  })
  return prefix + formatted
}
