#!/usr/bin/env node

/**
 * Version Tagging Script - Create and push git tags for releases
 * Usage: npm run version:tag [version]
 * Example: npm run version:tag 0.5.3
 * 
 * This script:
 * 1. Verifies the version matches package.json and version.ts
 * 2. Creates an annotated git tag with release notes
 * 3. Pushes the tag to remote
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const version = process.argv[2];

if (!version) {
  console.error('❌ Usage: npm run version:tag <version>');
  console.error('   Example: npm run version:tag 0.5.3');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`❌ Invalid version format: ${version}`);
  console.error('   Expected format: X.Y.Z (e.g., 0.5.3)');
  process.exit(1);
}

try {
  // Verify version matches version.ts
  const versionFile = path.join(__dirname, '..', 'src', 'version.ts');
  const content = fs.readFileSync(versionFile, 'utf8');
  const versionMatch = content.match(/export const VERSION = '([^']+)'/);
  
  if (!versionMatch || versionMatch[1] !== version) {
    console.error(`❌ Version mismatch!`);
    console.error(`   Expected in version.ts: ${version}`);
    console.error(`   Actual: ${versionMatch ? versionMatch[1] : 'NOT FOUND'}`);
    process.exit(1);
  }

  console.log(`✅ Version verified: ${version}`);

  // Check if tag already exists
  try {
    execSync(`git rev-parse v${version}`, { stdio: 'pipe' });
    console.warn(`⚠️  Tag v${version} already exists`);
    console.log('   Skipping tag creation...');
    process.exit(0);
  } catch (e) {
    // Tag doesn't exist, continue
  }

  // Create annotated tag
  const tagMessage = `Release v${version}`;
  console.log(`\n📌 Creating git tag v${version}...`);
  
  execSync(`git tag -a v${version} -m "${tagMessage}"`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..', '..')
  });
  console.log(`✅ Tag created: v${version}`);

  // Push tag
  console.log(`\n📤 Pushing tag to remote...`);
  execSync(`git push origin v${version}`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..', '..')
  });
  console.log(`✅ Tag pushed successfully!`);

  console.log(`\n🎉 Release v${version} tagged and published!`);
  console.log(`\n📊 Release information:`);
  console.log(`   Version: v${version}`);
  console.log(`   Tag: v${version}`);
  console.log(`   URL: https://github.com/Axidify/Terminality-V2/releases/tag/v${version}`);

} catch (error) {
  console.error(`❌ Error:`, error.message);
  process.exit(1);
}
