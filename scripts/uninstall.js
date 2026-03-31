const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const EXTENSION_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';
const ARC_USER_DATA = path.join(os.homedir(), 'Library/Application Support/Arc/User Data');

if (!fs.existsSync(ARC_USER_DATA)) {
  console.error(`❌ Could not find Arc User Data directory (${ARC_USER_DATA}). Is Arc installed?`);
  process.exit(1);
}

// Find profiles that have a backup (i.e., were previously patched)
// Profile directories can have any name (Default, Profile 1, custom names, etc.)
const profilesToRestore = [];
for (const entry of fs.readdirSync(ARC_USER_DATA, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const extDir = path.join(ARC_USER_DATA, entry.name, 'Extensions', EXTENSION_ID);
  if (!fs.existsSync(extDir)) continue;

  const backupDirs = fs.readdirSync(extDir).filter(d =>
    fs.statSync(path.join(extDir, d)).isDirectory() && /^\d+\.\d+\.\d+_\d+_backup$/.test(d)
  );

  if (backupDirs.length > 0) {
    backupDirs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    profilesToRestore.push({ name: entry.name, extDir, backupName: backupDirs[backupDirs.length - 1] });
  }
}

if (profilesToRestore.length === 0) {
  console.error("❌ No backups found in any Arc profile. It looks like the patch was never applied (or already uninstalled).");
  process.exit(1);
}

console.log(`Found backups in ${profilesToRestore.length} profile(s): ${profilesToRestore.map(p => p.name).join(', ')}\n`);

let restoredCount = 0;

for (const { name: profileName, extDir, backupName } of profilesToRestore) {
  console.log(`\n━━━ Profile: ${profileName} ━━━`);

  const backupDir = path.join(extDir, backupName);
  const versionName = backupName.replace(/_backup$/, '');
  const targetDir = path.join(extDir, versionName);

  console.log(`  ✅ Found backup: ${backupDir}`);

  if (fs.existsSync(targetDir)) {
    console.log(`  🗑️  Removing patched extension...`);
    execSync(`rm -rf "${targetDir}"`);
  }

  console.log(`  ♻️  Restoring original extension from backup...`);
  execSync(`cp -R "${backupDir}" "${targetDir}"`);

  console.log(`  🗑️  Removing backup directory...`);
  execSync(`rm -rf "${backupDir}"`);

  console.log(`  ✅ Profile "${profileName}" restored successfully!`);
  restoredCount++;
}

console.log(`\n🎉 Done! Restored ${restoredCount} profile(s) to the original Claude extension.`);
console.log(`👉 Please go to Arc's extensions page (arc://extensions), locate "Claude", and click the Reload button.`);
