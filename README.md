# Claude-in-Arc
A deep patching toolkit designed to inject Anthropic's Official Claude Chrome Extension natively into Arc Browser's visual structure.

Because Arc doesn't officially support Chrome's `chrome.sidePanel` APIs natively yet, this script intercepts the extension's unpacked local files and re-wires them to run as an injected iFrame, matching Arc's aesthetic perfectly.

## Installation

This script automatically finds your active Claude Extension directory across all Arc profiles, safely backs up everything, and applies the injection patches.

1. Ensure the **Official Claude Extension** is installed via the Chrome Web Store on Arc.

2. Clone or download this repository:

   ```bash
   git clone https://github.com/junkim100/Claude-in-Arc.git
   cd Claude-in-Arc
   ```

3. Run the install script:

   ```bash
   node scripts/install.js
   ```

4. Go to `arc://extensions` in Arc and enable **Developer mode** (top-right toggle).

5. **Remove** the existing Claude extension (the Chrome Web Store version).

6. Click **"Load unpacked"** and select the patched extension directory printed by the script (e.g., `~/Library/Application Support/Arc/User Data/<Profile>/Extensions/fcoeoabgfenejglbffodgkkbkcdhcgfn/1.0.64_0`).

7. Refresh any open tabs.

8. Use `Cmd+E` or the extension icon to toggle the panel!

> **Note:** Since the extension is loaded as unpacked, it will not auto-update from the Chrome Web Store. To update, re-run the install script after the Chrome Web Store version is updated.

## Uninstallation / Revert to Official

To revert to the official Claude extension:

1. Run the uninstall script:

   ```bash
   node scripts/uninstall.js
   ```

2. Go to `arc://extensions` and remove the "Claude in Arc" unpacked extension.

3. Reinstall the official Claude extension from the Chrome Web Store.

## TODO

- [ ] **Arc Folder Cross-Tab Collaboration:** Implement tab orchestration and cross-tab collaboration specifically within Arc's folder structure. We plan to explore workarounds to allow Claude to interact with multiple tabs seamlessly as long as they reside within the same Arc folder.
- [ ] **Claude Desktop Connection:** Establish a connection via Native Messaging to link the extension with the local Claude Code CLI and Claude Desktop application for advanced local capabilities.
