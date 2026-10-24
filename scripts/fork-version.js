// Increment forkRevision when releasing fork changes without an upstream package version bump.
const { version } = require('../package.json');
const forkRevision = 2;
module.exports = { scriptVersion: `${version}.${forkRevision}` };
