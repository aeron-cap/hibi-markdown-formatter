// @ts-nocheck -- This boundary imports Hibi's runtime-only Electron test helpers and preload.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import test from 'node:test'

const hibi = resolve(process.env.HIBI_CHECKOUT ?? '../hibi')
const { electron, waitForDocumentEditor, waitForAsync } = await import(
  pathToFileURL(join(hibi, 'tests/electron.mjs')).href
)
const { clickMenu, pressShortcut, replaceSourceText } = await import(
  pathToFileURL(join(hibi, 'tests/keyboard.mjs')).href
)
const addonFolder = fileURLToPath(new URL('../addons/markdown-formatter/', import.meta.url))
const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url))

test(
  'installed package: source, split, rejection, history, shortcut, lifecycle and save',
  { timeout: 180_000 },
  async (t) => {
    const profile = await mkdtemp(join(tmpdir(), 'hibi-markdown-formatter-'))
    const file = join(profile, 'note.md')
    const original = '\uFEFF---\r\ntitle:   Untouched\r\n---\r\n\r\n* one\r\n* two\r\n'
    const formatted = original.replace('* one', '- one').replace('* two', '- two')
    await writeFile(file, original)
    const app = await electron.launch({ args: [hibi, '--user-data-dir=' + profile] })
    t.after(async () => {
      await app
        .evaluate(({ dialog }) => {
          dialog.showMessageBox = async () => ({ response: 1 })
        })
        .catch(() => {})
      await app.close()
      await rm(profile, { recursive: true, force: true })
    })
    const page = await app.firstWindow()
    page.setDefaultTimeout(12_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.getByRole('textbox', { name: /document editor/i }).waitFor()
    await page.evaluate(() =>
      window.hibi.setAddonTrustSettings({ allowUnsigned: true, checkRevocations: false }),
    )
    await app.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] })
      dialog.showMessageBox = async () => ({ response: 1 })
    }, addonFolder)
    const installPackage = async () => {
      await clickMenu(app, 'Command palette')
      const palette = page.getByRole('dialog', { name: /^command palette$/i })
      await palette.getByRole('combobox', { name: /search commands/i }).fill('Install addon')
      await palette.locator('[id="command-install-addon"]').click()
      await palette.waitFor({ state: 'hidden' })
      await waitForAsync(page, async () =>
        (await window.hibi.getInstalledAddons()).some(
          (x) => x.manifest.id === 'markdown-formatter',
        ),
      )
    }
    await installPackage()
    assert.equal(
      (await page.evaluate(() => window.hibi.getInstalledAddons())).some(
        (x) => x.manifest.id === 'markdown-formatter',
      ),
      true,
    )
    const setEnabled = async (enabled) => {
      await clickMenu(app, 'Settings')
      await page.getByRole('tab', { name: /^addon manager$/i, exact: true }).click()
      const addons = page.locator('#settings-addons')
      await addons.getByRole('searchbox', { name: /filter addons/i }).fill('Markdown Formatter')
      const toggle = addons.locator('#addon-markdown-formatter')
      if ((await toggle.isChecked()) !== enabled) await toggle.click()
      await page.waitForFunction(
        (expected) => document.querySelector('#addon-markdown-formatter')?.checked === expected,
        enabled,
      )
      await page.getByRole('button', { name: 'Back to app', exact: true }).click()
    }
    await setEnabled(true)
    const open = async () => {
      await app.evaluate(({ dialog }, selected) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] })
      }, file)
      await clickMenu(app, 'Open…')
      await waitForAsync(page, async () => (await window.hibi.getDocument()).name === 'note.md')
      await page
        .locator('#document-editor-panel [contenteditable="true"]:visible')
        .first()
        .waitFor()
    }
    await open()
    const waitSource = async (value) => {
      await waitForAsync(
        page,
        async (expected) => (await window.hibi.getDocument()).markdown === expected,
        value,
      )
    }
    await waitSource(original)
    const subtest = async (name, fn) => {
      let failure
      await t.test(name, async () => {
        try {
          await fn()
        } catch (error) {
          failure = error
          console.error('UI failure:', (await page.locator('body').innerText()).slice(-1200))
          console.error('Page errors:', errors)
          await mkdir(artifacts, { recursive: true })
          await page.screenshot({ path: join(artifacts, 'failure.png') })
          throw error
        }
      })
      if (failure) throw failure
    }
    const run = async () => {
      await clickMenu(app, 'Command palette')
      const palette = page.getByRole('dialog', { name: /^command palette$/i })
      await palette.getByRole('combobox', { name: /search commands/i }).fill('Format Markdown')
      await palette.locator('[id="command-markdown-formatter.format"]').click()
    }
    await subtest('Normal view rejects without changing the file', async () => {
      await page.getByRole('button', { name: /^normal$/i }).click()
      await run()
      await page.getByText('Switch to Source view to format this note.', { exact: true }).waitFor()
      await waitSource(original)
      assert.equal(await readFile(file, 'utf8'), original)
    })
    await page.getByRole('button', { name: 'Source view', exact: true }).click()
    const editor = page.locator('.source-pane:not([inert]) .cm-content')
    await editor.waitFor()
    await editor.click()
    await subtest('Source command runs the real worker, preserving metadata and CRLF', async () => {
      await run()
      await waitSource(formatted)
      assert.equal(await readFile(file, 'utf8'), original)
      assert.equal((await page.evaluate(() => window.hibi.getDocument())).dirty, true)
      await mkdir(artifacts, { recursive: true })
      await page.screenshot({ path: join(artifacts, 'source-formatted.png') })
    })
    await subtest('one undo restores original bytes; redo reapplies formatting', async () => {
      await editor.click()
      await pressShortcut(app, process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')
      await waitSource(original)
      await editor.click()
      await pressShortcut(app, process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z')
      await waitSource(formatted)
      await run()
      await page.getByText('Markdown is already formatted.', { exact: true }).waitFor()
      await editor.click()
      await pressShortcut(app, process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')
      await waitSource(original)
      await editor.click()
      await pressShortcut(app, process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z')
      await waitSource(formatted)
    })
    await subtest('save and reopen retain the formatted source', async () => {
      await clickMenu(app, 'Save')
      await waitForAsync(page, async () => !(await window.hibi.getDocument()).dirty)
      assert.equal(await readFile(file, 'utf8'), formatted)
      await page.getByRole('button', { name: 'Close note.md', exact: true }).click()
      await waitForAsync(page, async () => (await window.hibi.getDocument()).name !== 'note.md')
      await open()
      await waitSource(formatted)
    })
    await page.getByRole('button', { name: 'Source view', exact: true }).click()
    await editor.click()
    await subtest('a user-assigned shortcut formats with no default binding', async () => {
      const binding = await page.evaluate(async () => {
        const bindings = await window.hibi.getAddonHotkeys()
        return bindings.find((x) => x.id === 'markdown-formatter.format')
      })
      assert.equal(binding.defaultShortcut, '')
      await page.evaluate(() =>
        window.hibi.saveAddonHotkey('markdown-formatter.format', 'ctrl+alt+shift+f'),
      )
      await replaceSourceText(page, editor, '* shortcut\n')
      await waitSource('* shortcut\r\n')
      await pressShortcut(app, 'Control+Alt+Shift+F')
      await waitSource('- shortcut\r\n')
    })
    await subtest('source pane in side-by-side mode formats', async () => {
      await page.getByRole('button', { name: /^side-by-side$/i }).click()
      await editor.waitFor()
      await replaceSourceText(page, editor, '* split\n')
      await waitSource('* split\r\n')
      await run()
      await waitSource('- split\r\n')
    })
    await subtest('disable, re-enable and replace leave one command', async () => {
      await setEnabled(false)
      await clickMenu(app, 'Command palette')
      let palette = page.getByRole('dialog', { name: /^command palette$/i })
      await palette.getByRole('combobox', { name: /search commands/i }).fill('Format Markdown')
      assert.equal(await palette.getByRole('option', { name: /Format Markdown/i }).count(), 0)
      await page.keyboard.press('Escape')
      await setEnabled(true)
      await app.evaluate(({ dialog }, selected) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] })
      }, addonFolder)
      await installPackage()
      await clickMenu(app, 'Command palette')
      palette = page.getByRole('dialog', { name: /^command palette$/i })
      await palette.getByRole('combobox', { name: /search commands/i }).fill('Format Markdown')
      assert.equal(await palette.getByRole('option', { name: /Format Markdown/i }).count(), 1)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Source view', exact: true }).click()
      await editor.click()
      await replaceSourceText(page, editor, '* enabled\n')
      await waitSource('* enabled\r\n')
      await run()
      await waitSource('- enabled\r\n')
    })
    await subtest(
      'large-note formatting keeps the renderer responsive and can be cancelled',
      async () => {
        await page.getByRole('button', { name: 'Source view', exact: true }).click()
        const large = '* one\n* two\n\nA paragraph with **bold** text.\n\n'.repeat(5000)
        await replaceSourceText(page, editor, large)
        const typedLarge = large.replaceAll('\n', '\r\n')
        await waitSource(typedLarge)
        await page.evaluate(() => {
          window.formatterTicks = 0
          window.formatterWorkersStarted = 0
          window.formatterWorkersTerminated = 0
          window.formatterReplies = 0
          const OriginalWorker = window.Worker
          window.Worker = class extends OriginalWorker {
            constructor(url, options) {
              super(url, options)
              this.isFormatter = String(url).includes('/format-worker.js')
              if (this.isFormatter) {
                window.formatterWorkersStarted++
                this.addEventListener('message', () => window.formatterReplies++)
              }
            }
            terminate() {
              if (this.isFormatter) window.formatterWorkersTerminated++
              super.terminate()
            }
          }
          window.formatterInterval = setInterval(() => window.formatterTicks++, 10)
        })
        const start = performance.now()
        await pressShortcut(app, 'Control+Alt+Shift+F')
        await page.waitForFunction(
          () => window.formatterWorkersStarted === 1 && window.formatterTicks > 10,
        )
        assert.equal(
          await page.evaluate(() => window.formatterReplies),
          0,
          'formatting is still running',
        )
        await page.keyboard.insertText('x')
        await waitSource(typedLarge + 'x')
        await page.waitForFunction(() => window.formatterWorkersTerminated === 1)
        assert.equal(await page.evaluate(() => window.formatterReplies), 0)
        assert.equal(
          (await page.evaluate(() => window.hibi.getDocument())).markdown,
          typedLarge + 'x',
        )
        const ticks = await page.evaluate(() => {
          clearInterval(window.formatterInterval)
          return window.formatterTicks
        })
        t.diagnostic(
          JSON.stringify({
            largeNoteBytes: Buffer.byteLength(typedLarge),
            cancelledAfterMs: Math.round(performance.now() - start),
            rendererTicks: ticks,
          }),
        )
      },
    )
    assert.deepEqual(errors, [])
  },
)
