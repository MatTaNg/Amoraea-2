/**
 * Fails the EAS build if patch-package did not apply the Amoraea expo-av iOS audio patch.
 * Hook: package.json "eas-build-post-install"
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const exavM = path.join(root, 'node_modules', 'expo-av', 'ios', 'EXAV', 'EXAV.m');
const exavH = path.join(root, 'node_modules', 'expo-av', 'ios', 'EXAV', 'EXAV.h');
const playerData = path.join(root, 'node_modules', 'expo-av', 'ios', 'EXAV', 'EXAVPlayerData.m');

function mustRead(file) {
  if (!fs.existsSync(file)) {
    console.error(`[verify-expo-av-patch] Missing file: ${file}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

const m = mustRead(exavM);
const markers = [
  '_amoraeaApplyOutputPortOverrideAfterActivation',
  'amoraeaReassertPlaybackSpeakerRoute',
  'dispatch_sync(dispatch_get_main_queue()',
  'Stock behavior skipped category updates while inactive',
];
for (const s of markers) {
  if (!m.includes(s)) {
    console.error(`[verify-expo-av-patch] EXAV.m missing marker: ${s}`);
    process.exit(1);
  }
}

if (!mustRead(exavH).includes('amoraeaReassertPlaybackSpeakerRoute')) {
  console.error('[verify-expo-av-patch] EXAV.h missing amoraeaReassertPlaybackSpeakerRoute');
  process.exit(1);
}

if (!mustRead(playerData).includes('[_exAV amoraeaReassertPlaybackSpeakerRoute]')) {
  console.error('[verify-expo-av-patch] EXAVPlayerData.m missing speaker reassert call');
  process.exit(1);
}

console.log('[verify-expo-av-patch] Amoraea expo-av iOS patch markers OK');
