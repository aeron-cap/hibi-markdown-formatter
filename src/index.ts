import { createFormatterAddon } from './addon.ts'
import { createWorkerFormatter } from './worker-client.ts'

// Installed Hibi addons export a factory; no Hibi runtime modules are bundled.
export default () => {
  const formatter = createWorkerFormatter()
  return createFormatterAddon(formatter.format, formatter.cancel)
}
