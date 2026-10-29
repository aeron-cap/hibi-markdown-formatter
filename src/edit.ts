export type Replacement = { from: number; to: number; insert: string; expectedText: string }

function boundary(text: string, offset: number): boolean {
  if (offset === 0 || offset === text.length) return true
  const before = text.charCodeAt(offset - 1),
    after = text.charCodeAt(offset)
  return (
    !(before === 13 && after === 10) &&
    !(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
  )
}

/** One smallest contiguous replacement, widened only to keep text boundaries valid. */
export function replacement(before: string, after: string): Replacement | null {
  if (before === after) return null
  let from = 0
  while (from < before.length && from < after.length && before[from] === after[from]) from++
  while (!boundary(before, from) || !boundary(after, from)) from--
  let to = before.length,
    end = after.length
  while (to > from && end > from && before[to - 1] === after[end - 1]) {
    to--
    end--
  }
  while (!boundary(before, to) || !boundary(after, end)) {
    to++
    end++
  }
  return { from, to, expectedText: before.slice(from, to), insert: after.slice(from, end) }
}
