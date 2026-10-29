import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMarkdown } from '../src/format.ts'
import { replacement } from '../src/edit.ts'

const fixtures: [string, string][] = [
  ['heading', 'Title\n===\n\n##  Two  ##\n'],
  ['lists', '* one\n* two\n  * nested\n\n1. first\n2. second\n'],
  ['table', '|a|long name|\n|-|-|\n|one|two|\n'],
  ['tasks', '* [ ] open\n* [x] done\n'],
  ['quote', '> text\n>\n> * nested\n'],
  ['links', '[a](https://example.com "title") and **strong** and _emphasis_\n'],
  ['references', '[link][ref]\n\n[ref]: https://example.com "title"\n'],
  ['hard breaks', 'first  \nsecond\\\nthird\n'],
  ['code', '\`\`\`js\nconst value={a:1,b: 2}\n\`\`\`\n'],
  ['unicode', '* 😀 café\n* é and 漢字\n'],
  ['empty', ''],
  ['blank', '\n\n'],
]
for (const [label, source] of fixtures)
  test(label + ' formats idempotently', async () => {
    const result = await formatMarkdown(source)
    assert.equal(await formatMarkdown(result), result)
  })

test('known Markdown and GFM formatting results', async () => {
  assert.equal(await formatMarkdown('##  Title  ##\n'), '## Title\n')
  assert.equal(await formatMarkdown('* one\n* two\n'), '- one\n- two\n')
  assert.equal(
    await formatMarkdown('|a|b|\n|-|-|\n|c|d|\n'),
    '| a   | b   |\n| --- | --- |\n| c   | d   |\n',
  )
  assert.equal(await formatMarkdown('first  \nsecond\n'), 'first  \nsecond\n')
})

test('preserves paragraph wrapping and the contents of fenced code', async () => {
  const prose = 'A deliberately short\nparagraph with existing wrapping.\n'
  assert.equal(await formatMarkdown(prose), prose)
  const code = '\`\`\`js\nconst value={a:1,b: 2}\n\`\`\`\n'
  assert.equal(await formatMarkdown(code), code)
})

for (const eol of ['\n', '\r\n', '\r'])
  test(
    'preserves BOM, metadata bytes and first body line ending ' + JSON.stringify(eol),
    async () => {
      const prefix = '\uFEFF---\r\ntitle:   Untouched # comment\r\nitems: [a,b]\r\n---\r\n\r\n'
      const result = await formatMarkdown(prefix + '* one' + eol + '* two' + eol)
      assert.equal(result, prefix + '- one' + eol + '- two' + eol)
      assert.equal(await formatMarkdown(result), result)
    },
  )

test('recognizes alternate frontmatter terminator and metadata-only notes', async () => {
  for (const source of ['---\nkey: value\n...\n', '\uFEFF', '', '---\nkey: [unparsed\n---\n'])
    assert.equal(await formatMarkdown(source), source)
  assert.equal(await formatMarkdown('\uFEFF* one\n'), '\uFEFF- one\n')
})

test('rejects unclosed frontmatter and leaves the caller source unchanged', async () => {
  const source = '---\ntitle: unfinished\n* one\n'
  await assert.rejects(formatMarkdown(source), /Close the YAML frontmatter/)
  assert.equal(source, '---\ntitle: unfinished\n* one\n')
})

test('normalizes mixed body endings using the first body ending', async () => {
  assert.equal(await formatMarkdown('* one\r\n* two\n'), '- one\r\n- two\r\n')
})

test('replacement isolates the changed range', () => {
  assert.deepEqual(replacement('abc middle xyz', 'abc MIDDLE xyz'), {
    from: 4,
    to: 10,
    expectedText: 'middle',
    insert: 'MIDDLE',
  })
  assert.equal(replacement('same', 'same'), null)
})

test('replacement never splits CRLF or a surrogate pair', () => {
  const samples = ['', 'a', '\r', '\n', '\r\n', '😀', '😁', 'a😀\r\nz', 'a😁\nz', 'x\r\ny']
  const boundary = (text: string, offset: number) => {
    const a = text.charCodeAt(offset - 1),
      b = text.charCodeAt(offset)
    return !(a === 13 && b === 10) && !(a >= 0xd800 && a <= 0xdbff && b >= 0xdc00 && b <= 0xdfff)
  }
  for (const before of samples)
    for (const after of samples) {
      const edit = replacement(before, after)
      if (!edit) {
        assert.equal(before, after)
        continue
      }
      assert.equal(before.slice(0, edit.from) + edit.insert + before.slice(edit.to), after)
      assert.equal(before.slice(edit.from, edit.to), edit.expectedText)
      assert.ok(boundary(before, edit.from) && boundary(before, edit.to))
      assert.ok(boundary(after, edit.from) && boundary(after, edit.from + edit.insert.length))
    }
})
