'use strict';

const cp = require('child_process');
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
    try {
      // 在当前进程中调用
      // require(rootFile).call(null, Array.from(arguments));

      // 在 node 子进程中调用
      const args = Array.from(arguments);
      const cmd = args[args.length - 1];
      const o = Object.create({});

      o.optionValues = cmd.opts();

      Object.keys(cmd).forEach((key) => {
        if (
          cmd.hasOwnProperty(key) &&
          !key.startsWith('_') &&
          key !== 'parent'
        ) {
          o[key] = cmd[key];
        }
      });

      args[args.length - 1] = o;

      let code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`;
      const child = spawn('node', ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit',
      });

      child.on('error', (e) => {
        log.error(e.message);
        process.exit(1);
      });

      child.on('exit', (e) => {
        log.verbose('命令执行成功', e);
        process.exit(e);
      });
    } catch (error) {
      log.error(error?.message);
    }
  }
}

function spawn(command, args, options) {
  const win32 = process.platform === 'win32';

  const cmd = win32 ? 'cmd' : command;
  // /c 表示静默执行
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args;

  return cp.spawn(cmd, cmdArgs, options || {});
}

module.exports = exec;
