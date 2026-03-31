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

// Find all profiles that have the Claude extension installed
// Profile directories can have any name (Default, Profile 1, custom names, etc.)
const profilesToPatch = [];
for (const d of fs.readdirSync(ARC_USER_DATA)) {
  const extDir = path.join(ARC_USER_DATA, d, 'Extensions', EXTENSION_ID);
  if (fs.statSync(path.join(ARC_USER_DATA, d)).isDirectory() && fs.existsSync(extDir)) {
    profilesToPatch.push({ name: d, extDir });
  }
}

if (profilesToPatch.length === 0) {
  console.error(`❌ Claude extension not found in any Arc profile. Is it installed?`);
  process.exit(1);
}

console.log(`Found Claude extension in ${profilesToPatch.length} profile(s): ${profilesToPatch.map(p => p.name).join(', ')}\n`);

const srcDir = path.join(__dirname, '..', 'src');
let patchedCount = 0;
let failedCount = 0;

for (const { name: profileName, extDir } of profilesToPatch) {
  console.log(`\n━━━ Profile: ${profileName} ━━━`);

  // Find the latest version folder like 1.0.63_0
  const dirs = fs.readdirSync(extDir).filter(d => fs.statSync(path.join(extDir, d)).isDirectory() && /^\d+\.\d+\.\d+_\d+$/.test(d));

  if (dirs.length === 0) {
    console.error(`  ❌ No version directories found. Skipping.`);
    failedCount++;
    continue;
  }

  dirs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const latestVersion = dirs[dirs.length - 1];
  const targetDir = path.join(extDir, latestVersion);

  console.log(`  ✅ Found extension directory: ${targetDir}`);

  const backupDir = targetDir + '_backup';
  if (!fs.existsSync(backupDir)) {
    console.log(`  📦 Creating backup at ${backupDir}...`);
    execSync(`cp -R "${targetDir}" "${backupDir}"`);
  } else {
    console.log(`  ℹ️ Backup already exists.`);
    console.log(`  ♻️  Reverting from backup to ensure clean state before patching...`);
    execSync(`rm -rf "${targetDir}"`);
    execSync(`cp -R "${backupDir}" "${targetDir}"`);
  }

  console.log(`  🔧 Injecting custom script assets...`);
  const assetsDir = path.join(targetDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  fs.copyFileSync(path.join(srcDir, 'claude-panel-injector.js'), path.join(assetsDir, 'claude-panel-injector.js'));
  fs.copyFileSync(path.join(srcDir, 'viewport-override.js'), path.join(assetsDir, 'viewport-override.js'));
  fs.copyFileSync(path.join(srcDir, 'zoom-service-worker.js'), path.join(assetsDir, 'zoom-service-worker.js'));

  console.log(`  📝 Patching manifest.json...`);
  const manifestPath = path.join(targetDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.name = "Claude in Arc v0.1";

  manifest.content_scripts = manifest.content_scripts || [];
  const injectorScript = {
    "matches": ["<all_urls>"],
    "js": ["assets/claude-panel-injector.js"],
    "run_at": "document_idle"
  };
  const overrideScript = {
    "matches": ["<all_urls>"],
    "js": ["assets/viewport-override.js"],
    "run_at": "document_start",
    "world": "MAIN"
  };

  const existingScripts = manifest.content_scripts.map(c => c.js && c.js[0]);
  if (!existingScripts.includes("assets/claude-panel-injector.js")) manifest.content_scripts.push(injectorScript);
  if (!existingScripts.includes("assets/viewport-override.js")) manifest.content_scripts.push(overrideScript);

  manifest.permissions = manifest.permissions || [];
  if (!manifest.permissions.includes("scripting")) manifest.permissions.push("scripting");
  if (!manifest.permissions.includes("tabs")) manifest.permissions.push("tabs");

  manifest.web_accessible_resources = manifest.web_accessible_resources || [];
  const warFound = manifest.web_accessible_resources.find(war => war.resources && war.resources.includes("sidepanel.html"));
  if (!warFound) {
    manifest.web_accessible_resources.push({
      "matches": ["<all_urls>"],
      "resources": ["sidepanel.html", "assets/*", "public/*"]
    });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`  📝 Patching service-worker-loader.js...`);
  const swLoaderPath = path.join(targetDir, 'service-worker-loader.js');
  if (fs.existsSync(swLoaderPath)) {
    let swLoader = fs.readFileSync(swLoaderPath, 'utf8');
    if (!swLoader.includes('zoom-service-worker.js')) {
      swLoader += "\nimport './assets/zoom-service-worker.js';\n";
      fs.writeFileSync(swLoaderPath, swLoader);
    }
  } else {
    console.error(`  ⚠️ service-worker-loader.js not found! The background script structure may have changed.`);
  }

  console.log(`  📝 Patching sidepanel.html for Cmd+E Fix...`);
  const sidepanelPath = path.join(targetDir, 'sidepanel.html');
  if (fs.existsSync(sidepanelPath)) {
    const fallbackJsContent = `
document.addEventListener("keydown", (e) => {
  const modifier = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
  if (modifier && e.key.toLowerCase() === "e") {
    e.preventDefault();
    window.parent.postMessage({ type: "CLAUDE_ARC_TOGGLE_PANEL" }, "*");
  }
}, true);
`;
    fs.writeFileSync(path.join(assetsDir, 'cmd-e-fallback.js'), fallbackJsContent);

    let sidepanelHtml = fs.readFileSync(sidepanelPath, 'utf8');

    const inlineScriptMatch = sidepanelHtml.match(/<script>\s*\/\/(?:.|\n)*?<\/script>/i);
    if (inlineScriptMatch) {
      const scriptContent = inlineScriptMatch[0].replace('<script>', '').replace('</script>', '');
      fs.writeFileSync(path.join(assetsDir, 'theme-init.js'), scriptContent);
      sidepanelHtml = sidepanelHtml.replace(inlineScriptMatch[0], '<script src="/assets/theme-init.js"></script>');
    }

    const fallbackScript = `
    <!-- Arc Cmd+E Fallback for injected iframe focus -->
    <script src="/assets/cmd-e-fallback.js"></script>
  </body>`;

    if (!sidepanelHtml.includes('Arc Cmd+E Fallback')) {
      sidepanelHtml = sidepanelHtml.replace('</body>', fallbackScript);
    }
    fs.writeFileSync(sidepanelPath, sidepanelHtml);
  } else {
    console.error(`  ⚠️ sidepanel.html not found!`);
  }

  console.log(`  ✅ Profile "${profileName}" patched successfully!`);
  patchedCount++;
}

console.log(`\n🎉 Done! Patched ${patchedCount} profile(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}.`);
console.log(`👉 Please go to Arc's extensions page (arc://extensions), locate "Claude in Arc v0.1", and click the Reload button.`);
