const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const EXTENSION_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';
const EXT_BASE_DIR = path.join(os.homedir(), `Library/Application Support/Arc/User Data/Default/Extensions/${EXTENSION_ID}`);

if (!fs.existsSync(EXT_BASE_DIR)) {
  console.error(`❌ Could not find Claude extension directory (${EXT_BASE_DIR}). Is it installed in Arc?`);
  process.exit(1);
}

// Find backup directories (e.g., 1.0.63_0_backup)
const allDirs = fs.readdirSync(EXT_BASE_DIR).filter(d => fs.statSync(path.join(EXT_BASE_DIR, d)).isDirectory());
const backupDirs = allDirs.filter(d => /^\d+\.\d+\.\d+_\d+_backup$/.test(d));

if (backupDirs.length === 0) {
  console.error("❌ No backup found. It looks like the patch was never applied (or the backup was already removed).");
  process.exit(1);
}

// Sort and pick the latest backup
backupDirs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
const latestBackup = backupDirs[backupDirs.length - 1];
const backupDir = path.join(EXT_BASE_DIR, latestBackup);

// Derive the original version directory name by stripping "_backup"
const versionName = latestBackup.replace(/_backup$/, '');
const targetDir = path.join(EXT_BASE_DIR, versionName);

console.log(`✅ Found backup: ${backupDir}`);

// Restore the original extension from backup
if (fs.existsSync(targetDir)) {
  console.log(`🗑️  Removing patched extension at ${targetDir}...`);
  execSync(`rm -rf "${targetDir}"`);
}

console.log(`♻️  Restoring original extension from backup...`);
execSync(`cp -R "${backupDir}" "${targetDir}"`);

// Remove the backup directory
console.log(`🗑️  Removing backup directory...`);
execSync(`rm -rf "${backupDir}"`);

console.log(`\n🎉 Uninstall completed successfully! The original Claude extension has been restored.`);
console.log(`👉 Please go to Arc's extensions page (arc://extensions), locate "Claude", and click the Reload button.`);
