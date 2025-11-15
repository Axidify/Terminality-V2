const fs = require('fs')

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
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return []
  }
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

function readChangelogMarkdown(changelogPath) {
  if (!changelogPath) return ''
  if (!fs.existsSync(changelogPath)) return ''
  try {
    return fs.readFileSync(changelogPath, 'utf8')
  } catch (err) {
    console.warn('[changelog] Failed to read markdown file:', err)
    return ''
  }
}

function loadChangelogFromFile(changelogPath) {
  if (!changelogPath) return []
  if (!fs.existsSync(changelogPath)) return []
  try {
    const markdown = readChangelogMarkdown(changelogPath)
    if (!markdown) return []
    return parseChangelogMarkdown(markdown)
  } catch (err) {
    console.warn('[changelog] Failed to read markdown file:', err)
    return []
  }
}

module.exports = {
  parseChangelogMarkdown,
  loadChangelogFromFile,
  readChangelogMarkdown
}
