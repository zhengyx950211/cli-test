'use strict';

module.exports = core;

// require 支持加载的文件类型：.js/.json/.node
// .js -> module.exports/exports
// .json -> JSON.parse
// .node -> c++ 插件，使用 process.dlopen 解析
// any -> .js 对于其他类型的文件，会使用js解析器解析

// const file = require('../file.txt');
// file();

const semver = require('semver');
const colors = require('colors/safe');
const log = require('@cli-test/log');

const constance = require('./const');
const pkg = require('../package.json');

function core() {
  try {
    checkPkgVersion();
    checkNodeVersion();
    checkRoot();
  } catch (error) {
    log.error('cli', error.message)
  }
}

/**
 * root 账户检查并自动降级
 * 防止 root 启动带来的文件读写权限问题
 */
function checkRoot() {
  // const rootCheck = require('root-check');

  // rootCheck()
}

/**
 * 检查 node 版本
 * 可能使用的 node 的方法在某些版本不支持
 */
function checkNodeVersion() {
  // 获取当前版本号
  const currentVersion = process.version;
  const lowestVersion = constance.LOWEST_NODE_VERSION;

  if (!semver.gte(currentVersion, lowestVersion)) {
    throw Error(colors.red(`使用 cli-test 的 node 版本号需 >= v${lowestVersion} `))
  }
}

/**
 * 检查版本号
 */
function checkPkgVersion() {
  log.info('cli', pkg.version);
}