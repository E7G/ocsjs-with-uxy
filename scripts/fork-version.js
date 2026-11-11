// Userscript versions must be valid SemVer: MAJOR.MINOR.PATCH.
// Increment the patch offset for fork-only releases; never append a fourth number.
// When upstream package.json changes, review the resulting version before tagging.
const { version } = require('../package.json');
const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
if (!match) {
  throw new Error('Upstream version must be MAJOR.MINOR.PATCH: ' + version);
}
const forkPatchOffset = 1;
const scriptVersion = `${match[1]}.${match[2]}.${Number(match[3]) + forkPatchOffset}`;
module.exports = { scriptVersion };
