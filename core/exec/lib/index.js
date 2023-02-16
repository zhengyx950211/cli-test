'use strict';

const path = require('path');
const Package = require('@cli-test/package');
const log = require('@cli-test/log');

const SETTING = {
  init: '@imooc-cli/init',
};

const CACHE_DIR = 'dependencies';

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH;
  const homePath = process.env.CLI_HOME_PATH;
  let storeDir = '';
  let pkg;
  log.verbose(`targetPath: ${targetPath}, homePath: ${homePath}`);

  const cmdObj = arguments[arguments.length - 1];
  const packageVersion = 'latest';

  // 生成缓存路径
  if (!targetPath) {
    targetPath = path.resolve(homePath, CACHE_DIR);
    storeDir = path.resolve(targetPath, 'node_modules');

    log.verbose(`new targetPath: ${targetPath}, storeDir: ${storeDir}`);

    pkg = new Package({
      targetPath,
      storeDir,
      packageName: SETTING[cmdObj.name()],
      packageVersion,
    });

    if (await pkg.exists()) {
      // update package
      await pkg.update();
    } else {
      // install package
      await pkg.install();
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName: SETTING[cmdObj.name()],
      packageVersion,
    });
  }

  const rootFile = pkg.getRootFilePath();
  if (rootFile) {
    // 在当前进程中调用
    require(rootFile).call(null, Array.from(arguments));

    // 在 node 子进程中调用
  }
}

module.exports = exec;
