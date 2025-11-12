import { ModularAppManifest } from './types'
import { manifest as sampleManifest } from './plugins/SamplePlugin'

export function registerAllBuiltin(): ModularAppManifest[] {
  return [sampleManifest]
}

export default registerAllBuiltin
