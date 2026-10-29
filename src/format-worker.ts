/// <reference lib="webworker" />
import { formatMarkdown } from './format.ts'

const scope = globalThis as unknown as DedicatedWorkerGlobalScope
scope.onmessage = async (event: MessageEvent<unknown>) => {
  try {
    if (typeof event.data !== 'string') throw new Error('The formatter expects Markdown source.')
    scope.postMessage({ source: await formatMarkdown(event.data) })
  } catch (error) {
    scope.postMessage({
      message: error instanceof Error ? error.message : 'Markdown could not be formatted.',
    })
  }
}
