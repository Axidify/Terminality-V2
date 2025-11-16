import { mockApps } from './plugins/MockApps'
import { manifest as onlineChatManifest } from './plugins/OnlineChatPlugin'
import { manifest as sampleManifest } from './plugins/SamplePlugin'
import { ModularAppManifest } from './types'

export function registerAllBuiltin(): ModularAppManifest[] {
  return [sampleManifest, onlineChatManifest, ...mockApps]
}

export default registerAllBuiltin
