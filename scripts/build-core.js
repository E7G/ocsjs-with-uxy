// @ts-check

const { series } = require('gulp');
const del = require('del');
const util = require('util');
const { scriptVersion } = require('./fork-version');
const repoURL = 'https://github.com/E7G/ocsjs-with-uxy';
// GitHub Actions builds userscripts and publishes them as Release assets.
const distributionBase = 'https://github.com/E7G/ocsjs-with-uxy/releases/latest/download';
/** @type {(...args: any[])=> Promise<void>} */
const execOut = util.promisify(require('./utils').execOut);
const { createUserScript, createMetaFile } = require('../packages/utils');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { build: buildStyle } = require('./build-style');

dotenv.config();

const distPath = process.env.BUILD_PATH || '../dist';
console.log('BUILD_PATH: ', distPath);
const distResolvedPath = path.resolve(__dirname, distPath);

function cleanOutput() {
	return del([distPath, '../lib'], { force: true });
}

async function testResolver() {
	await execOut('tsx ../tests/resolver.test.ts');
	await execOut('tsx ../tests/fork-customization.test.ts');
}

async function buildPackages() {
	await execOut('tsc', { cwd: '../packages/core' });
	await execOut('vite build', { cwd: '../packages/core' });
	await execOut('tsc', { cwd: '../packages/scripts' });
	await execOut('vite build', { cwd: '../packages/scripts' });
}

const CSS_PATH = path.join(__dirname, '../packages/scripts/assets/css/style.css');

/**
 * 加载 dist 产物（清除 require 缓存，供 dev 监听模式重复调用）
 * @returns {import('../packages/scripts/src/index')}
 */
function loadDistOcs() {
	const distIndex = path.join(distPath, 'index.js');
	delete require.cache[require.resolve(distIndex)];
	// @ts-ignore
	return require(distIndex);
}

/** @return {import('../packages/utils').CreateOptions} */
function createOptions(ocs) {
	const { CXProject, ZHSProject, ZJYProject, IcveMoocProject, ICourseProject, YKTProject, ULearningProject } = ocs;
	const projectList = [CXProject, ZHSProject, ZJYProject, IcveMoocProject, ICourseProject, YKTProject, ULearningProject]
		.map((s) => `【${s.name}】`)
		.join(' ');

	const matchMetadata = Array.from(
		new Set(
			ocs
				.definedProjects()
				.map((p) => (p.domains || []).map((d) => `*://*.${d}/*`))
				.flat()
		)
	);

	return {
		parseRequire: true,
		parseResource: true,
		resourceBuilder: (key, value) => `const ${key} = \`${value}\`;`,
		metaDataFormatter: {
			header: '==UserScript==',
			footer: '==/UserScript==',
			prefix: '// ',
			symbol: '@',
			gap: '\t'.repeat(4)
		},
		metadata: {
			name: 'OCS-with-uxy 网课助手',
			version: scriptVersion,
			description: ['OCS-with-uxy 是 E7G 维护的 OCS 5.x 定制分支，保留上游 OCS 功能并扩展优学院、雨课堂及学习通支持。', '支持平台：', projectList, '。项目与问题反馈：' + repoURL].join(' '),
			author: 'E7G (fork; original OCS by enncy)',
			contributor: 'enncy and OCS contributors',
			license: 'MIT',
			namespace: repoURL,
			homepage: repoURL,
			homepageURL: repoURL,
			source: repoURL,
			supportURL: repoURL + '/issues',
			updateURL: distributionBase + '/ocs.meta.js',
			downloadURL: distributionBase + '/ocs.user.js',
			icon: 'https://cdn.ocsjs.com/logo.png',
			connect: [
				'enncy.cn',
				'icodef.com',
				'ocsjs.com',
				'zaizhexue.top',
				'localhost',
				'127.0.0.1',
				// 智慧树阿里云资源，应用： 图片题资源访问
				'aliyuncs.com'
			],
			match: matchMetadata,
			grant: [
				'GM_info',
				'GM_getTab',
				'GM_saveTab',
				'GM_setValue',
				'GM_getValue',
				'unsafeWindow',
				'GM_listValues',
				'GM_deleteValue',
				'GM_notification',
				'GM_xmlhttpRequest',
				'GM_getResourceText',
				'GM_addValueChangeListener',
				'GM_removeValueChangeListener'
			],
			require: [path.join(__dirname, distPath, 'index.js')],
			resource: [`STYLE ${CSS_PATH}`],
			'run-at': 'document-start',
			antifeature: 'payment'
		},
		entry: path.join(__dirname, '../packages/scripts/entry.js'),
		dist: path.join(__dirname, distPath, 'ocs.user.js')
	};
}

/**
 * 生成开发调试脚本（ocs.dev.user.js）。
 * entry.dev.js 的内容会被原样内联进用户脚本（script.builder.ts），
 * 因此 entry 文件改动后必须重新执行本函数，Tampermonkey 中才能拿到最新入口代码。
 */
async function createDevUserScript() {
	require('browser-env')();
	// @ts-ignore
	globalThis.unsafeWindow = {};
	const ocs = loadDistOcs();

	const devOpts = createOptions(ocs);
	devOpts.parseRequire = false;
	devOpts.parseResource = false;
	devOpts.metadata.name = devOpts.metadata.name + '(dev)';
	// Developer version uses local file:// dependencies; do not publish an auto-update URL.
	delete devOpts.metadata.updateURL;
	delete devOpts.metadata.downloadURL;
	devOpts.metadata.require = ['file:///' + path.join(distResolvedPath, 'index.js')];
	devOpts.metadata.resource = [`STYLE file:///${CSS_PATH}`];
	devOpts.entry = path.join(__dirname, '../packages/scripts/entry.dev.js');
	devOpts.dist = path.join(distResolvedPath, 'ocs.dev.user.js');
	/** 导出样式文件 */
	fs.copyFileSync(CSS_PATH, path.join(distResolvedPath, 'style.css'));
	console.log('createUserScript: ', devOpts.metadata.name, devOpts.dist);
	await createUserScript(devOpts);
}

async function createUserJs() {
	/** 模拟浏览器环境 */
	require('browser-env')();

	/** 先编译样式（easy-us 基础样式 + OCS 自定义样式），保证 style.css 为最新 */
	await buildStyle();

	// @ts-ignore
	globalThis.unsafeWindow = {};

	const ocs = loadDistOcs();

	const officialOpts = createOptions(ocs);
	console.log('CreateUserScript: ', officialOpts.metadata.name, officialOpts.dist);
	await createUserScript(officialOpts);
	console.log('createMetaFile: ', path.join(distResolvedPath, 'ocs.meta.js'));
	await createMetaFile({ dist: officialOpts.dist, metaDist: path.join(distResolvedPath, 'ocs.meta.js') });

	/** 创建调试脚本 */
	await createDevUserScript();

	/** 创建全Connect域名通用脚本 */
	const commonOpts = createOptions(ocs);
	commonOpts.metadata.name = commonOpts.metadata.name + ' - 全域名通用版';
	const connect = Array.isArray(commonOpts.metadata.connect) ? commonOpts.metadata.connect : [];
	connect.push('*');
	commonOpts.metadata.connect = connect;
	commonOpts.entry = path.join(__dirname, '../packages/scripts/entry.common.js');
	commonOpts.dist = path.join(distResolvedPath, 'ocs.common.user.js');
	commonOpts.metadata.updateURL = distributionBase + '/ocs.common.meta.js';
	commonOpts.metadata.downloadURL = distributionBase + '/ocs.common.user.js';

	console.log('createUserScript: ', commonOpts.metadata.name, commonOpts.dist);
	await createUserScript(commonOpts);
	await createMetaFile({ dist: commonOpts.dist, metaDist: path.join(distResolvedPath, 'ocs.common.meta.js') });
	// Fail the build if a published userscript has stale or inconsistent metadata.
	require('./verify-fork-metadata').verifyForkMetadata(distResolvedPath);
}

exports.createDevUserScript = createDevUserScript;
exports.default = series(cleanOutput, testResolver, buildPackages, createUserJs);
