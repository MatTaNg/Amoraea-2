// @ts-check
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Only block build output at the *project root* (`<root>/dist`, `<root>/web-build`).
 * Do NOT use a broad `/dist/` pattern — that would also match
 * `node_modules/react-native-web/dist/...` and break web bundling.
 */
const config = getDefaultConfig(__dirname);

function blockOnlyProjectSubdir(dirName) {
  const abs = path.resolve(__dirname, dirName).replace(/\\/g, '/');
  const escaped = abs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Metro may pass Windows or POSIX separators; do not match `.../react-native-web/dist/...`.
  const sepFlexible = escaped.replace(/\//g, '[/\\\\]');
  // No flags — Metro merges blockList regexes and requires identical flags (Expo uses none on /.expo[\\/]types/).
  return new RegExp(`^${sepFlexible}(?:[/\\\\]|$)`);
}

config.resolver.blockList = [
  blockOnlyProjectSubdir('dist'),
  blockOnlyProjectSubdir('web-build'),
].concat(config.resolver.blockList ?? []);

module.exports = config;
