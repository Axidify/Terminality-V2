#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const { parseChangelogMarkdown } = require('../server/utils/markdownChangelog')

const ROOT = path.join(__dirname, '..')
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md')
const STATE_PATH = path.join(ROOT, 'server', 'state.json')

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { version: 1, desktop: {}, story: {} }
  }
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { version: 1, desktop: {}, story: {} }
  }
}

function main() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error('CHANGELOG.md not found at', CHANGELOG_PATH)
    process.exit(1)
  }
  const markdown = fs.readFileSync(CHANGELOG_PATH, 'utf8')
  const entries = parseChangelogMarkdown(markdown)
  if (!entries.length) {
    console.warn('No changelog entries detected; aborting migration')
    process.exit(1)
  }
  const state = loadState()
  state.changelog = { entries }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
  console.log(`Migrated ${entries.length} changelog entries into server/state.json`)
}

if (require.main === module) {
  main()
}
