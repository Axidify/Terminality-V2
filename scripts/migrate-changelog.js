#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md')
const STATE_PATH = path.join(ROOT, 'server', 'state.json')

function sanitizeLine(value, maxLen = 800) {
  if (!value) return ''
  return String(value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maxLen)
}

function extractSection(block, sectionName) {
  const sectionRegex = new RegExp(`### ${sectionName}\\s*\\n([\\s\\S]*?)(?=###|$)`, 'i')
  const match = block.match(sectionRegex)
  if (!match) return []
  return match[1]
    .split('\n')
    .map(line => sanitizeLine(line.replace(/^[-*]\s*/, ''), 600))
    .filter(Boolean)
}

function parseChangelogMarkdown(markdown) {
  const entries = []
  const versionRegex = /## \[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/g
  const matches = Array.from(markdown.matchAll(versionRegex))

  for (let i = 0; i < matches.length; i++) {
    const [matchText, version, date] = matches[i]
    const start = matches[i].index + matchText.length
    const end = matches[i + 1] ? matches[i + 1].index : markdown.length
    const sectionBlock = markdown.slice(start, end)

    const sections = {
      added: extractSection(sectionBlock, 'Added'),
      changed: extractSection(sectionBlock, 'Changed'),
      fixed: extractSection(sectionBlock, 'Fixed'),
      breaking: extractSection(sectionBlock, 'Breaking')
    }

    if ((sections.added.length + sections.changed.length + sections.fixed.length + sections.breaking.length) === 0) {
      continue
    }

    const summary = sections.added[0] || sections.changed[0] || sections.fixed[0] || sections.breaking[0] || 'New release'
    const highlightParts = [...sections.added.slice(0, 2), ...sections.changed.slice(0, 1)]

    entries.push({
      version,
      date,
      summary,
      highlight: highlightParts.join(' • '),
      spotlight: '',
      sections,
      tags: [],
      links: []
    })
  }

  return entries
}

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
