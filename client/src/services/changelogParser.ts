/**
 * Changelog Parser - Extracts version entries from CHANGELOG.md content
 * Returns structured changelog data for dynamic rendering
 */

export interface ChangelogEntry {
  version: string
  date: string
  added: string[]
  changed: string[]
  fixed: string[]
}

export interface ParsedChangelog {
  entries: ChangelogEntry[]
  latest: ChangelogEntry | null
}

/**
 * Parse CHANGELOG.md content and extract version entries
 * Expects Keep a Changelog format:
 * ## [version] - YYYY-MM-DD
 * ### Added
 * - item
 * ### Changed
 * - item
 * ### Fixed
 * - item
 */
export const parseChangelog = (content: string): ParsedChangelog => {
  const entries: ChangelogEntry[] = []

  // Split by version headers: ## [X.Y.Z] - YYYY-MM-DD
  const versionRegex = /## \[(\d+\.\d+\.\d+)\]\s*-\s*(\d{4}-\d{2}-\d{2})/g
  const matches = Array.from(content.matchAll(versionRegex))

  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i]
    const nextMatch = matches[i + 1]

    const version = currentMatch[1]
    const date = currentMatch[2]

    // Extract content between current and next version header
    const startIndex = currentMatch.index + currentMatch[0].length
    const endIndex = nextMatch ? nextMatch.index : content.length
    const sectionContent = content.substring(startIndex, endIndex)

    // Parse sections (Added, Changed, Fixed)
    const added = extractSection(sectionContent, 'Added')
    const changed = extractSection(sectionContent, 'Changed')
    const fixed = extractSection(sectionContent, 'Fixed')

    if (added.length > 0 || changed.length > 0 || fixed.length > 0) {
      entries.push({
        version,
        date,
        added,
        changed,
        fixed
      })
    }
  }

  return {
    entries,
    latest: entries.length > 0 ? entries[0] : null
  }
}

/**
 * Extract items from a specific section (e.g., "### Added")
 */
const extractSection = (content: string, sectionName: string): string[] => {
  const sectionRegex = new RegExp(
    `### ${sectionName}\\s*\\n([\\s\\S]*?)(?=###|$)`,
    'i'
  )

  const match = content.match(sectionRegex)
  if (!match) return []

  // Extract list items (lines starting with - or *)
  const items = match[1]
    .split('\n')
    .filter(line => line.trim().match(/^[-*]/))
    .map(line => {
      // Remove markdown bullet and clean up
      return line
        .replace(/^\s*[-*]\s*/, '')
        .replace(/^#+\s+/, '')
        .trim()
    })
    .filter(item => item.length > 0)

  return items
}

/**
 * Fetch and parse the CHANGELOG.md from the project root
 */
export const fetchAndParseChangelog = async (): Promise<ParsedChangelog> => {
  try {
    // Fetch from public folder
    const response = await fetch('/CHANGELOG.md')
    if (!response.ok) {
      console.warn('Failed to fetch CHANGELOG.md:', response.statusText)
      return { entries: [], latest: null }
    }

    const content = await response.text()
    return parseChangelog(content)
  } catch (error) {
    console.warn('Error fetching changelog:', error)
    return { entries: [], latest: null }
  }
}
