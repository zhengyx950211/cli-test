'use strict';

module.exports = core;

// require 支持加载的文件类型：.js/.json/.node
// .js -> module.exports/exports
// .json -> JSON.parse
// .node -> c++ 插件，使用 process.dlopen 解析
// any -> .js 对于其他类型的文件，会使用js解析器解析

// const file = require('../file.txt');
// file();
const path = require('path');
const semver = require('semver');
const colors = require('colors/safe');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;
const commander = require('commander');
const log = require('@cli-test/log');
const init = require('@cli-test/init');
const exec = require('@cli-test/exec');

const constance = require('./const');
const pkg = require('../package.json');

// let args;

const program = new commander.Command();

async function core() {
  try {
    await prepare();

    registerCommand();
  } catch (error) {
    log.error('cli', error.message)
  }
}

async function prepare() {
  checkPkgVersion();
  checkNodeVersion();
  checkRoot();
  checkUserHome();
  // checkInputArgs();
  checkEnv();
  await checkGlobalUpdate();
}

function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('[command] <options>')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '');
  
  // 注册 init 命令
  program
    .command('init [projectName]')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec);

  // 开启 debug 模式
  program.on('option:debug', () => {
    // const options = program.opts();

    // if (options.debug) {
      process.env.LOG_LEVEL = 'verbose';
    // }
  
    log.level = process.env.LOG_LEVEL || 'info';
  })

  // 监听本地调试模式
  program.on('option:targetPath', () => {
    process.env.CLI_TARGET_PATH = program.opts().targetPath;
  })

  // 对未知命令的监听
  program.on('command:*', (obj) => {
    console.log(obj, program.commands)
    const availableCommands = program.commands.map(cmd => cmd.name());

    console.log(colors.red(`未知的命令：${obj[0]}`));
    console.log(colors.green(`可用命令：${availableCommands.join(', ')}`));
  })

  program.parse(process.argv);

  if (program.args && program.args.length < 1) {
    program.outputHelp();
    console.log();
  }
}

/**
 * 检查是否为最新版本号
 */
async function checkGlobalUpdate() {
  // 获取 当前版本号 和 模块名
  const currentVersion = pkg.version;
  const npmName = pkg.name;

  // 比对最新版本号，提示更新
  const { getNpmSemverVersion } = require('@cli-test/get-npm-info');
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName);

  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn('更新提示', colors.yellow(`请更新版本，当前版本：${currentVersion}, 最新版本：${lastVersion}; 可使用命令 npm install -g ${npmName}`));
  }
}

/**
 * 检查环境变量
 * 可以在操作系统中配置一些环境变量，将 用户名、密码等敏感信息保存在本地，而不用继承到代码当中，需要的时候就可以时时读取，同时可以修改许多配置信息
 */
function checkEnv() {
  const dotenv = require('dotenv');

  const dotenvPath = path.resolve(userHome, '.env');

  if (pathExists(dotenv)) {
    // 读取环境变量并添加到 process.env 中
    dotenv.config({ path: dotenvPath });
  }

  createDefaultCliConfig();

  log.verbose('环境变量', process.env.CLI_HOME_PATH)
}

function createDefaultCliConfig() {
  const cliConfig = {};

  if (process.env.CLI_HOME) {
    cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME);
  } else {
    cliConfig['cliHome'] = path.join(userHome, constance.DEFAULT_CLI_HOME);
  }

  process.env.CLI_HOME_PATH = cliConfig['cliHome']
}

/**
 * 检查入参 (使用 commander 监听实现)
 * 是否开启debug模式
 */
// function checkInputArgs() {
//   const minimist = require('minimist');
//   args = minimist(process.argv.slice(2));

//   checkArgs()
// }

// function checkArgs() {
//   if (args.debug) {
//     process.env.LOG_LEVEL = 'verbose';
//   }

//   log.level = process.env.LOG_LEVEL || 'info';
// }

/**
 * 判断用户主目录是否存在
 * 后续 缓存 等需要使用
 */
function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw Error(colors.red('用户主目录不存在'))
  }
}

/**
 * root 账户检查并自动降级
 * 防止 root 启动带来的文件读写权限问题
 * 使用了 process.geteuid 和 process.setuid 等 api，在 windows 上不适用
 */
function checkRoot() {
  // rootCheck v2 采用 es6 module 写法，如想使用 require，需降版本到 v1
  const rootCheck = require('root-check');
  // const { default: rootCheck} = await import('root-check')

  rootCheck()
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