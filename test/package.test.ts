import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { Context } from '../src/addon.ts'
// This checks the compiled artifact, not just the development modules.
test('the committed package is self-contained and exposes the declared command', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../addons/markdown-formatter/hibi-addon.json', import.meta.url),
      'utf8',
    ),
  )
  const { default: factory } = (await import(
    new URL('../addons/markdown-formatter/index.js', import.meta.url).href
  )) as typeof import('../src/index.ts')
  const addon = factory()
  let command: { id: string; label: string } | undefined
  addon.start({
    commands: {
      register(value: typeof command) {
        command = value
        return () => {
          command = undefined
        }
      },
    },
  } as Context)
  assert.deepEqual(
    { id: command!.id, label: command!.label },
    { id: manifest.commands[0].id, label: manifest.commands[0].label },
  )
  addon.stop()
  assert.equal(command, undefined)
})
