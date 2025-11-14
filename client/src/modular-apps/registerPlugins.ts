import { ModularAppManifest } from './types'
import { manifest as sampleManifest } from './plugins/SamplePlugin'
import { mockApps } from './plugins/MockApps'
import { manifest as onlineChatManifest } from './plugins/OnlineChatPlugin'

export function registerAllBuiltin(): ModularAppManifest[] {
  return [sampleManifest, onlineChatManifest, ...mockApps]
}

export default registerAllBuiltin
