import type { AddonContext, AddonCommand, ViewTarget } from '@hibi/addon-sdk/api'
import { replacement } from './edit.ts'

export type Context = {
  commands: Pick<AddonContext['commands'], 'register'>
  documents: Pick<
    AddonContext['documents'],
    'getMetadata' | 'readSource' | 'applyEdits' | 'subscribe'
  >
  editorViews: Pick<
    AddonContext['editorViews'],
    'getActive' | 'getSelection' | 'onDidChangeActive' | 'onDidChangeSelection'
  >
  notify: AddonContext['notify']
}
type Invocation = Parameters<AddonCommand['run']>[0]
type Formatter = (source: string) => Promise<string>

function sameView(a: ViewTarget | null | undefined, b: ViewTarget | null | undefined) {
  return (
    !!a &&
    !!b &&
    a.documentId === b.documentId &&
    a.documentGeneration === b.documentGeneration &&
    a.viewId === b.viewId &&
    a.viewGeneration === b.viewGeneration
  )
}
const markdownName = (name: string) => /\.(?:md|markdown)$/i.test(name)

/** Lifecycle and command handling, kept independent of the formatting engine. */
export function createFormatterAddon(formatter: Formatter, cancelFormatter: () => void = () => {}) {
  let generation = 0
  let unregister: (() => void) | undefined
  let pending: { cancel: () => void } | undefined
  return {
    start(context: Context) {
      const activation = ++generation
      unregister = context.commands.register({
        id: 'format',
        label: 'Format Markdown',
        keywords: 'prettier tidy source',
        menu: { location: 'app' },
        when: ({ document }) => {
          if (!document) return false
          const result = context.documents.getMetadata(document)
          return result.status === 'read' && markdownName(result.metadata.name)
        },
        async run(invocation: Invocation) {
          if (generation !== activation) return
          if (pending) {
            context.notify('Markdown formatting is already in progress.')
            return
          }
          const { document, view } = invocation
          if (!document || !view) {
            context.notify('Open a Markdown note in Source view first.')
            return
          }
          const metadata = context.documents.getMetadata(document)
          if (metadata.status !== 'read' || !markdownName(metadata.metadata.name)) {
            context.notify('This command formats Markdown notes only.')
            return
          }
          const selection = context.editorViews.getSelection(view)
          if (
            !selection.ok ||
            selection.value.editor !== 'source' ||
            invocation.selection?.editor === 'rich'
          ) {
            context.notify('Switch to Source view to format this note.')
            return
          }
          const snapshot = context.documents.readSource(document)
          if (snapshot.status !== 'read') {
            context.notify(snapshot.message)
            return
          }
          if (
            !sameView(view, context.editorViews.getActive()) ||
            selection.value.contentVersion !== snapshot.target.contentVersion ||
            (invocation.selection &&
              invocation.selection.contentVersion !== snapshot.target.contentVersion)
          ) {
            context.notify('The note changed before formatting started. Run Format Markdown again.')
            return
          }
          let invalid = false
          const invalidate = () => {
            invalid = true
            cancelFormatter()
          }
          const cleanups: (() => void)[] = []
          const operation = {
            cancel() {
              invalidate()
              for (const cleanup of cleanups.splice(0).reverse()) cleanup()
            },
          }
          pending = operation
          try {
            cleanups.push(
              context.documents.subscribe((event) => {
                const target = event.kind === 'closed' ? event.target : event.metadata.target
                if (
                  target.documentId === document.documentId &&
                  target.documentGeneration === document.documentGeneration
                )
                  invalidate()
              }),
            )
            cleanups.push(
              context.editorViews.onDidChangeActive((active) => {
                if (!sameView(active, view)) invalidate()
              }),
            )
            cleanups.push(
              context.editorViews.onDidChangeSelection((current) => {
                if (
                  !current ||
                  current.editor !== 'source' ||
                  !sameView(current.view, view) ||
                  current.editorGeneration !== selection.value.editorGeneration
                )
                  invalidate()
              }),
            )
            const formatted = await formatter(snapshot.source)
            if (generation !== activation) return
            const currentSelection = context.editorViews.getSelection(view)
            const current = context.documents.readSource(document)
            if (
              invalid ||
              !sameView(context.editorViews.getActive(), view) ||
              !currentSelection.ok ||
              currentSelection.value.editor !== 'source' ||
              currentSelection.value.editorGeneration !== selection.value.editorGeneration ||
              current.status !== 'read' ||
              current.target.contentVersion !== snapshot.target.contentVersion ||
              current.source !== snapshot.source
            ) {
              context.notify(
                'The note or editor changed during formatting. Run Format Markdown again.',
              )
              return
            }
            const change = replacement(snapshot.source, formatted)
            if (!change) {
              context.notify('Markdown is already formatted.')
              return
            }
            const result = context.documents.applyEdits({
              requestId: crypto.randomUUID(),
              target: snapshot.target,
              changes: [change],
            })
            context.notify(result.status === 'applied' ? 'Markdown formatted.' : result.message)
          } catch (error) {
            if (generation === activation)
              context.notify(
                error instanceof Error ? error.message : 'Markdown could not be formatted.',
              )
          } finally {
            operation.cancel()
            if (pending === operation) pending = undefined
          }
        },
      })
    },
    stop() {
      generation++
      pending?.cancel()
      pending = undefined
      unregister?.()
      unregister = undefined
    },
  }
}
