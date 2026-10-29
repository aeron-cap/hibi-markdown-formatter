import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { createWorkerFormatter } from '../src/worker-client.ts'

function fixture(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker')
  const workers: FakeWorker[] = []
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void
    onerror?: (event: { message: string; preventDefault: () => void }) => void
    onmessageerror?: () => void
    sent: unknown
    terminated = false
    constructor(url: URL, options: { type: string }) {
      assert.ok(url.href.endsWith('/format-worker.js'))
      assert.equal(options.type, 'module')
      workers.push(this)
    }
    postMessage(source: unknown) {
      this.sent = source
    }
    terminate() {
      this.terminated = true
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous)
    else Reflect.deleteProperty(globalThis, 'Worker')
  })
  return { client: createWorkerFormatter(), workers }
}

test('worker receives source, returns output and terminates', async (t) => {
  const { client, workers } = fixture(t)
  const pending = client.format('* one')
  assert.equal(workers[0]!.sent, '* one')
  workers[0]!.onmessage!({ data: { source: '- one\n' } })
  assert.equal(await pending, '- one\n')
  assert.equal(workers[0]!.terminated, true)
})

test('worker cancellation rejects pending work and a later call gets a new worker', async (t) => {
  const { client, workers } = fixture(t)
  const pending = client.format('* one')
  const rejected = assert.rejects(pending, /cancelled/)
  client.cancel()
  await rejected
  assert.equal(workers[0]!.terminated, true)
  const next = client.format('* two')
  workers[0]!.onmessage!({ data: { source: 'stale' } })
  workers[1]!.onmessage!({ data: { source: '- two\n' } })
  assert.equal(await next, '- two\n')
})

test('worker reports formatter failures and malformed responses without output', async (t) => {
  const { client, workers } = fixture(t)
  for (const data of [{ message: 'Invalid source.' }, null, { source: 42 }]) {
    const pending = client.format('source')
    const rejected = assert.rejects(pending, /Invalid source|invalid result/)
    workers.at(-1)!.onmessage!({ data })
    await rejected
    assert.equal(workers.at(-1)!.terminated, true)
  }
})

test('worker rejects concurrent requests without replacing the active job', async (t) => {
  const { client, workers } = fixture(t)
  const pending = client.format('first')
  await assert.rejects(client.format('second'), /already in progress/)
  assert.equal(workers.length, 1)
  const rejected = assert.rejects(pending, /cancelled/)
  client.cancel()
  await rejected
})

test('worker deadline terminates a stuck formatter', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { client, workers } = fixture(t)
  const pending = client.format('source')
  const rejected = assert.rejects(pending, /took too long/)
  t.mock.timers.tick(30_000)
  await rejected
  assert.equal(workers[0]!.terminated, true)
})

test('worker loading failure leaves no running request', async (t) => {
  const { client, workers } = fixture(t)
  const pending = client.format('source')
  const rejected = assert.rejects(pending, /could not run/)
  workers[0]!.onerror!({ message: 'Could not load module.', preventDefault() {} })
  await rejected
  assert.equal(workers[0]!.terminated, true)
})
