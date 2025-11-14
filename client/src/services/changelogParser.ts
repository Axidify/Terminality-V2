/**
 * Deprecated: dynamic changelog management now lives at /api/changelog.
 * This stub remains to avoid breaking imports while the new service rolls out.
 */

export { type ChangelogEntry, type ChangelogSections, type ChangelogResponse } from './changelogService'
export { fetchChangelog as fetchAndParseChangelog } from './changelogService'
