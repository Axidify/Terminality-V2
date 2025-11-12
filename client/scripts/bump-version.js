// Script to bump version in version.ts
// Usage: npm run version:bump [patch|minor|major]

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'src', 'version.ts');
const changelogFile = path.join(__dirname, '..', '..', 'CHANGELOG.md');

// Read current version
const content = fs.readFileSync(versionFile, 'utf8');
const versionMatch = content.match(/export const VERSION = '(\d+)\.(\d+)\.(\d+)'/);

if (!versionMatch) {
  console.error('❌ Could not parse current version');
  process.exit(1);
}

let [, major, minor, patch] = versionMatch.map(Number);

// Determine bump type
const bumpType = process.argv[2] || 'patch';

switch (bumpType) {
  case 'major':
    major++;
    minor = 0;
    patch = 0;
    break;
  case 'minor':
    minor++;
    patch = 0;
    break;
  case 'patch':
  default:
    patch++;
    break;
}

const newVersion = `${major}.${minor}.${patch}`;
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// Update version.ts
const newContent = `export const VERSION = '${newVersion}'
export const BUILD_DATE = '${today}' // YYYY-MM-DD
`;

fs.writeFileSync(versionFile, newContent, 'utf8');
console.log(`✅ Version bumped to ${newVersion}`);
console.log(`📅 Build date set to ${today}`);

// Check if CHANGELOG.md exists and has the unreleased section
if (fs.existsSync(changelogFile)) {
  const changelog = fs.readFileSync(changelogFile, 'utf8');
  
  // Check if there's an [Unreleased] section
  if (changelog.includes('## [Unreleased]')) {
    // Replace [Unreleased] with new version
    const updatedChangelog = changelog.replace(
      '## [Unreleased]',
      `## [Unreleased]\n\n*No changes yet*\n\n## [${newVersion}] - ${today}`
    );
    fs.writeFileSync(changelogFile, updatedChangelog, 'utf8');
    console.log(`📝 Updated CHANGELOG.md with version ${newVersion}`);
  } else {
    console.log(`⚠️  No [Unreleased] section found in CHANGELOG.md`);
    console.log(`💡 Add your changes manually to CHANGELOG.md`);
  }
} else {
  console.log(`⚠️  CHANGELOG.md not found`);
}

console.log(`\n🎉 Version bump complete!`);
console.log(`\nNext steps:`);
console.log(`1. Update CHANGELOG.md with your changes for v${newVersion}`);
console.log(`2. Commit: git add . && git commit -m "chore: bump version to ${newVersion}"`);
console.log(`3. Tag: git tag v${newVersion}`);
console.log(`4. Push: git push && git push --tags`);
