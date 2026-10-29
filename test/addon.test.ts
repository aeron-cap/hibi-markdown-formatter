import assert from 'node:assert/strict'
import test from 'node:test'
import type { AddonCommand, ViewTarget, EditorViewSelection } from '@hibi/addon-sdk/api'
import { createFormatterAddon, type Context } from '../src/addon.ts'

function harness(formatter: (source: string) => Promise<string> = async () => '- one\n') {
  const target = {
    documentId: 'document' as ViewTarget['documentId'],
    documentGeneration: 1,
    contentVersion: 1,
  }
  const view: ViewTarget = { ...target, viewId: 'view' as ViewTarget['viewId'], viewGeneration: 1 }
  let source = '* one\n',
    version = 1,
    name = 'note.md',
    active: ViewTarget | null = view,
    closed = false
  let editor: 'source' | 'rich' = 'source',
    editorGeneration = 1
  let command: AddonCommand | undefined
  const notices: string[] = []
  const requests: Parameters<Context['documents']['applyEdits']>[0][] = []
  const documentListeners = new Set<Parameters<Context['documents']['subscribe']>[0]>()
  const viewListeners = new Set<Parameters<Context['editorViews']['onDidChangeActive']>[0]>()
  const selectionListeners = new Set<
    Parameters<Context['editorViews']['onDidChangeSelection']>[0]
  >()
  const metadata = () => ({
    target: { ...target, contentVersion: version },
    tabId: 'tab',
    name,
    dirty: false,
    ephemeral: false,
    canAutosave: true,
  })
  const selection = (): EditorViewSelection => ({
    view,
    editor,
    editorGeneration,
    contentVersion: version,
    anchor: 0,
    head: 0,
  })
  let applyStatus: 'applied' | 'stale' | 'invalid' | 'composing' | 'busy' | 'unsupported-view' =
    'applied'
  const context: Context = {
    commands: {
      register(value) {
        assert.equal(command, undefined)
        command = value
        return () => {
          command = undefined
        }
      },
    },
    documents: {
      getMetadata() {
        return closed
          ? { status: 'stale', message: 'Closed.' }
          : { status: 'read', metadata: metadata() }
      },
      readSource() {
        return closed
          ? { status: 'stale', message: 'Closed.' }
          : { status: 'read', source, target: { ...target, contentVersion: version } }
      },
      subscribe(listener) {
        documentListeners.add(listener)
        return () => {
          documentListeners.delete(listener)
        }
      },
      applyEdits(request) {
        requests.push(request)
        if (applyStatus !== 'applied')
          return { status: applyStatus, message: 'Host rejected: ' + applyStatus }
        assert.equal(request.target.contentVersion, version)
        assert.equal(request.changes.length, 1)
        const change = request.changes[0]!
        assert.equal(source.slice(change.from, change.to), change.expectedText)
        source = source.slice(0, change.from) + change.insert + source.slice(change.to)
        return { status: 'applied', contentVersion: ++version }
      },
    },
    editorViews: {
      getActive: () => active,
      getSelection: () =>
        closed
          ? { ok: false, code: 'stale', message: 'Closed.' }
          : { ok: true, value: selection() },
      onDidChangeActive(listener) {
        viewListeners.add(listener)
        return () => {
          viewListeners.delete(listener)
        }
      },
      onDidChangeSelection(listener) {
        selectionListeners.add(listener)
        return () => {
          selectionListeners.delete(listener)
        }
      },
    },
    notify: (message) => {
      notices.push(message)
    },
  }
  const addon = createFormatterAddon(formatter)
  addon.start(context)
  const invocation = () => ({
    source: 'palette' as const,
    document: { ...target },
    view,
    selection: {
      targetId: 'selection',
      editor,
      contentVersion: version,
      anchor: 0,
      head: 0,
      position: 0,
      selectedText: '',
    },
  })
  return {
    addon,
    context,
    notices,
    requests,
    view,
    target,
    source: () => source,
    version: () => version,
    command: () => command,
    invoke: () => command!.run(invocation()),
    change(value = 'new user text') {
      source = value
      version++
      for (const listener of documentListeners) listener({ kind: 'changed', metadata: metadata() })
    },
    name(value: string) {
      name = value
    },
    mode(value: 'source' | 'rich') {
      editor = value
      for (const listener of selectionListeners) listener(selection())
    },
    replaceEditor() {
      editorGeneration++
      for (const listener of selectionListeners) listener(selection())
    },
    active(value: ViewTarget | null) {
      active = value
      for (const listener of viewListeners) listener(value)
    },
    close() {
      closed = true
      for (const listener of documentListeners) listener({ kind: 'closed', target })
    },
    hostStatus(value: typeof applyStatus) {
      applyStatus = value
    },
    listeners: () => documentListeners.size + viewListeners.size + selectionListeners.size,
  }
}
function deferred() {
  let release!: (value: string) => void
  const promise = new Promise<string>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

test('registers one command, applies a versioned atomic edit, and cleans up', async () => {
  const h = harness()
  assert.equal(h.command()!.id, 'format')
  assert.equal(h.command()!.defaultShortcut, undefined)
  await h.invoke()
  assert.equal(h.source(), '- one\n')
  assert.equal(h.requests.length, 1)
  assert.equal(h.notices.at(-1), 'Markdown formatted.')
  assert.equal(h.listeners(), 0)
  h.addon.stop()
  assert.equal(h.command(), undefined)
  h.addon.start(h.context)
  assert.equal(h.command()!.label, 'Format Markdown')
  h.addon.stop()
})

test('an unchanged note creates no edit', async () => {
  const h = harness(async (source) => source)
  await h.invoke()
  assert.equal(h.requests.length, 0)
  assert.equal(h.version(), 1)
  assert.equal(h.notices.at(-1), 'Markdown is already formatted.')
})

test('Normal view gives the requested message without formatting', async () => {
  const h = harness(async () => {
    assert.fail('formatter called')
  })
  h.mode('rich')
  await h.invoke()
  assert.equal(h.notices.at(-1), 'Switch to Source view to format this note.')
  assert.equal(h.requests.length, 0)
})

for (const name of ['note.txt', 'code.ts', 'note.mdx', 'math.tex'])
  test('does not format ' + name, async () => {
    const h = harness()
    h.name(name)
    assert.equal(h.command()!.when!({ source: 'palette', document: h.target }), false)
    await h.invoke()
    assert.equal(h.requests.length, 0)
  })

for (const scenario of [
  'edit',
  'close',
  'switch tab',
  'leave and return',
  'view',
  'replace editor',
] as const)
  test('discards pending result after ' + scenario, async () => {
    const d = deferred(),
      h = harness(() => d.promise)
    const pending = h.invoke()
    if (scenario === 'edit') h.change()
    if (scenario === 'close') h.close()
    if (scenario === 'switch tab')
      h.active({ ...h.view, documentId: 'other' as ViewTarget['documentId'] })
    if (scenario === 'leave and return') {
      h.active(null)
      h.active(h.view)
    }
    if (scenario === 'view') {
      h.mode('rich')
      h.mode('source')
    }
    if (scenario === 'replace editor') h.replaceEditor()
    d.release('- one\n')
    await pending
    assert.equal(h.requests.length, 0)
    assert.match(h.notices.at(-1)!, /changed during formatting/)
    assert.equal(h.listeners(), 0)
  })

test('one operation at a time and no queued retry', async () => {
  const d = deferred(),
    h = harness(() => d.promise)
  const pending = h.invoke()
  await h.invoke()
  assert.equal(h.notices.at(-1), 'Markdown formatting is already in progress.')
  d.release('- one\n')
  await pending
  assert.equal(h.requests.length, 1)
})

test('stop discards pending work, removes subscriptions, and allows a fresh activation', async () => {
  const d = deferred(),
    h = harness(() => d.promise)
  const pending = h.invoke()
  assert.equal(h.listeners(), 3)
  h.addon.stop()
  assert.equal(h.listeners(), 0)
  h.addon.start(h.context)
  d.release('- one\n')
  await pending
  assert.equal(h.requests.length, 0)
  assert.equal(h.notices.length, 0)
  await h.invoke()
  assert.equal(h.requests.length, 1)
})

test('formatter exceptions leave source and history untouched', async () => {
  const h = harness(async () => {
    throw new Error('Invalid input.')
  })
  await h.invoke()
  assert.equal(h.requests.length, 0)
  assert.equal(h.source(), '* one\n')
  assert.equal(h.notices.at(-1), 'Invalid input.')
  assert.equal(h.listeners(), 0)
})

for (const status of ['stale', 'invalid', 'composing', 'busy', 'unsupported-view'] as const)
  test('reports host rejection without retry: ' + status, async () => {
    const h = harness()
    h.hostStatus(status)
    await h.invoke()
    assert.equal(h.requests.length, 1)
    assert.equal(h.source(), '* one\n')
    assert.equal(h.notices.at(-1), 'Host rejected: ' + status)
  })
