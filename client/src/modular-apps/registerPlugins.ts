import { ModularAppManifest } from './types'
import { manifest as sampleManifest } from './plugins/SamplePlugin'
import { mockApps } from './plugins/MockApps'

export function registerAllBuiltin(): ModularAppManifest[] {
  return [sampleManifest, ...mockApps]
}

export default registerAllBuiltin
