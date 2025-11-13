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
  const publicChangelog = path.join(__dirname, '../client/public/CHANGELOG.md')

  const version = extractVersionFromVersionFile(versionFile)
  if (!version) throw new Error('Could not read version from client/src/version.ts')

  const rootTop = topChangelogVersion(rootChangelog)
  if (!rootTop) throw new Error('Could not find top changelog entry in CHANGELOG.md')
  if (rootTop !== version) throw new Error(`CHANGELOG.md top entry (${rootTop}) does not match version ${version}`)

  const publicTop = topChangelogVersion(publicChangelog)
  if (!publicTop) throw new Error('Could not find top changelog entry in client/public/CHANGELOG.md')
  if (publicTop !== version) throw new Error(`client/public/CHANGELOG.md top entry (${publicTop}) does not match version ${version}`)

  console.log(`Changelog check passed: version ${version} matches top entries`) 
  process.exit(0)
} catch (e) {
  console.error('Changelog validation failed:', e.message || e)
  process.exit(1)
}
