const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scriptVersion: expectedVersion } = require('./fork-version');

const repo = 'https://github.com/E7G/ocsjs-with-uxy';
const dist = 'https://github.com/E7G/ocsjs-with-uxy/releases/latest/download';
// The build and metadata verifier share one fork-version source of truth.

function parseHeader(content) {
  const header = content.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  assert.ok(header, 'Missing userscript metadata header');
  const fields = new Map();
  for (const line of header[0].split(/\r?\n/)) {
    const tag = line.match(/^\/\/\s+@([A-Za-z][A-Za-z0-9-]*)\s+(.+)$/);
    if (tag) fields.set(tag[1], (fields.get(tag[1]) || []).concat(tag[2].trim()));
  }
  return { header: header[0], fields };
}
function one(fields, key) {
  const values = fields.get(key);
  assert.ok(values && values.length === 1, key + ' requires exactly one value');
  return values[0];
}
function verifyForkMetadata(folder) {
  for (const prefix of ['ocs', 'ocs.common']) {
    const filename = prefix + '.user.js';
    const metaFile = prefix + '.meta.js';
    const script = fs.readFileSync(path.join(folder,filename), 'utf8');
    const meta = fs.readFileSync(path.join(folder,metaFile), 'utf8');
    const full = parseHeader(script);
    const only = parseHeader(meta);
    assert.equal(full.header.trim(), only.header.trim(), metaFile + ' must match script');
    const tags = only.fields;
    assert.equal(one(tags,'version'), expectedVersion);
    assert.equal(one(tags,'author'),'E7G (fork; original OCS by enncy)');
    assert.equal(one(tags,'namespace'),repo);
    assert.equal(one(tags,'homepage'),repo);
    assert.equal(one(tags,'homepageURL'),repo);
    assert.equal(one(tags,'source'),repo);
    assert.equal(one(tags,'supportURL'),repo+'/issues');
    assert.equal(one(tags,'license'),'MIT');
    assert.equal(one(tags,'updateURL'),dist+'/'+metaFile);
    assert.equal(one(tags,'downloadURL'),dist+'/'+filename);
    assert.ok(one(tags,'name').includes('OCS-with-uxy'));
    assert.ok((tags.get('match')||[]).some(x=>x.includes('ulearning.cn')));
    assert.ok(!full.header.includes('file:///'));
  }
  const dev = parseHeader(fs.readFileSync(path.join(folder,'ocs.dev.user.js'),'utf8')).fields;
  assert.equal(dev.has('updateURL'),false, 'local dev build should not update from public build');
  assert.equal(dev.has('downloadURL'),false, 'local dev build should not download public build');
  console.log('Fork userscript metadata verified: standard, common, dev');
}

module.exports = { verifyForkMetadata };
if (require.main === module) verifyForkMetadata(path.resolve(__dirname,'../dist'));
