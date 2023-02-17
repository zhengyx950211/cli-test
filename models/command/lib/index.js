'use strict';

const semver = require('semver');
const colors = require('colors');
const log = require('@cli-test/log');

const LOWEST_NODE_VERSION = '14.0.0';

class Command {
  constructor(argv) {
    if (!argv) {
      throw new Error('参数不能为空');
    }

    if (!Array.isArray(argv)) {
      throw new Error('参数必须为数组');
    }

    if (argv.length < 1) {
      throw new Error('参数列表不为空');
    }

    this._argv = argv;

    let runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve();

      chain = chain.then(() => this.checkNodeVersion());
      chain = chain.then(() => this.initArgs());
      chain = chain.then(() => this.init());
      chain = chain.then(() => this.exec());

      chain.catch((err) => log.error(err.message));
    });
  }

  checkNodeVersion() {
    // 获取当前版本号
    const currentVersion = process.version;
    const lowestVersion = LOWEST_NODE_VERSION;

    if (!semver.gte(currentVersion, lowestVersion)) {
      throw Error(
        colors.red(`使用 cli-test 的 node 版本号需 >= v${lowestVersion} `)
      );
    }
  }

  initArgs() {
    this.cmd = this._argv[this._argv.length - 1];
    this._argv = this._argv.slice(0, this._argv.length - 1);
  }

  init() {
    throw new Error('init 必须实现');
  }

  exec() {
    throw new Error('exec 必须实现');
  }
}

module.exports = Command;
