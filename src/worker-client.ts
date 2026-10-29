export function createWorkerFormatter() {
  let running:
    | { worker: Worker; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }
    | undefined
  function cancel() {
    if (!running) return
    const { worker, reject, timer } = running
    running = undefined
    clearTimeout(timer)
    worker.terminate()
    reject(new Error('Formatting was cancelled because the note or editor changed.'))
  }
  return {
    cancel,
    format(source: string): Promise<string> {
      if (running) return Promise.reject(new Error('Markdown formatting is already in progress.'))
      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./format-worker.js', import.meta.url), {
          type: 'module',
        })
        const finish = (error?: Error, result?: string) => {
          if (running?.worker !== worker) return
          clearTimeout(running.timer)
          running = undefined
          worker.terminate()
          if (error) reject(error)
          else resolve(result!)
        }
        const timer = setTimeout(
          () => finish(new Error('Formatting took too long. Try a smaller note.')),
          30_000,
        )
        running = { worker, reject, timer }
        worker.onmessage = (event) => {
          const data: unknown = event.data
          if (
            data &&
            typeof data === 'object' &&
            'source' in data &&
            typeof data.source === 'string'
          )
            finish(undefined, data.source)
          else
            finish(
              new Error(
                data &&
                  typeof data === 'object' &&
                  'message' in data &&
                  typeof data.message === 'string'
                  ? data.message
                  : 'The formatter returned an invalid result.',
              ),
            )
        }
        worker.onerror = (event) => {
          event.preventDefault()
          finish(new Error('The formatter could not run. ' + event.message))
        }
        worker.onmessageerror = () =>
          finish(new Error('The formatter returned an unreadable result.'))
        try {
          worker.postMessage(source)
        } catch (error) {
          finish(error instanceof Error ? error : new Error('The formatter could not start.'))
        }
      })
    },
  }
}
