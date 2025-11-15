#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function extractVersionFromVersionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const match = content.match(/VERSION\s*=\s*['"](.+?)['"]/)
  return match && match[1]
}

function topChangelogVersion(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const match = content.match(/^## \[(\d+\.\d+\.\d+)\]/m)
  return match && match[1]
}

try {
  const versionFile = path.join(__dirname, '../client/src/version.ts')
  const rootChangelog = path.join(__dirname, '../CHANGELOG.md')
  const stateFile = path.join(__dirname, '../server/state.json')

  const version = extractVersionFromVersionFile(versionFile)
  if (!version) throw new Error('Could not read version from client/src/version.ts')

  const rootTop = topChangelogVersion(rootChangelog)
  if (!rootTop) throw new Error('Could not find top changelog entry in CHANGELOG.md')
  if (rootTop !== version) throw new Error(`CHANGELOG.md top entry (${rootTop}) does not match version ${version}`)

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  const stateTop = state?.changelog?.entries?.[0]?.version
  if (!stateTop) throw new Error('server/state.json is missing changelog entries')
  if (stateTop !== version) throw new Error(`server/state.json top entry (${stateTop}) does not match version ${version}`)

  console.log(`Changelog check passed: version ${version} matches CHANGELOG.md and server/state.json`)
  process.exit(0)
} catch (e) {
  console.error('Changelog validation failed:', e.message || e)
  process.exit(1)
}
