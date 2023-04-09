'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const ejs = require('ejs');
const glob = require('glob');
const semver = require('semver');
const userHome = require('user-home');
const log = require('@cli-test/log');
const { spinnerStart, sleep, execAsync } = require('@cli-test/utils');
const Command = require('@cli-test/command');
const Package = require('@cli-test/package');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMANDS = ['npm', 'cnpm', 'yarn'];

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this.cmd.optionValues?.force;

    log.verbose('projectName: ', this.projectName);
    log.verbose('force: ', this.force);
  }

  async exec() {
    try {
      // 1. 准备阶段
      const projectInfo = await this.prepare();

      if (projectInfo) {
        // 2. 下载模板
        log.verbose('projectInfo: ', projectInfo);
        this.projectInfo = projectInfo;
        await this.downloadTemplate();
        // 3. 安装模板
        await this.installTemplate();
      }
    } catch (e) {
      log.error(e.message);
    }
  }

  async installTemplate() {
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
      }

      const { type } = this.templateInfo;

      if (type === TEMPLATE_TYPE_NORMAL) {
        // 标准安装
        await this.installNormalTemplate();
      } else if (type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装
        await this.installCustomTemplate();
      } else {
        throw new Error('无法识别项目模板类型！');
      }
    } else {
      throw new Error('无法识别项目模板');
    }
  }

  checkCommand(cmd) {
    if (WHITE_COMMANDS.includes(cmd)) {
      return cmd;
    }

    return null;
  }

  async execCommand(command, errMsg) {
    let ret;

    if (command) {
      const cmdArray = command.split(' ');
      const cmd = this.checkCommand(cmdArray[0]);

      if (!cmd) {
        throw new Error(`命令不存在, 命令: ${cmd}`);
      }

      const args = cmdArray.slice(1);

      ret = await execAsync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    }

    if (ret !== 0 && errMsg) {
      throw new Error(errMsg);
    }

    return ret;
  }

  ejsRender(options) {
    const dir = process.cwd();
    const projectInfo = this.projectInfo;

    return new Promise((resolve, reject) => {
      glob('**', {
        cwd: dir,
        ignore: options?.ignore || '',
        nodir: true,
      })
        .then((files) => {
          Promise.all(
            files.map((file) => {
              const filePath = path.join(dir, file);

              return new Promise((resolve1, reject1) => {
                ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
                  if (err) {
                    reject1(err);
                  } else {
                    fse.writeFileSync(filePath, result);
                    resolve1(result);
                  }
                });
              });
            })
          )
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  async installNormalTemplate() {
    log.verbose('cacheFilePath', this.templateNpm?.cacheFilePath);

    const spinner = spinnerStart('正在安装模板...');
    // 拷贝模板至当前目录
    try {
      const templatePath = path.resolve(
        this.templateNpm?.cacheFilePath,
        'template'
      );
      const targetPath = process.cwd();
      fse.ensureDirSync(templatePath);
      fse.ensureDirSync(targetPath);
      fse.copySync(templatePath, targetPath);
    } catch (e) {
      throw e;
    } finally {
      spinner.stop(true);
      log.success('模板安装成功');
    }

    const {
      installCommand,
      startCommand,
      ignore: ignoreConfig,
    } = this.templateInfo;

    const ignore = ['node_modules/**', ...(ignoreConfig || [])];
    await this.ejsRender({ ignore });

    // 依赖安装
    await this.execCommand(installCommand, '安装依赖过程失败！');
    // 启动项目
    await this.execCommand(startCommand, '项目启动失败！');
  }

  async installCustomTemplate() {}

  async downloadTemplate() {
    // 1. 通过项目API获取项目模板信息
    // 1.1 通过 egg.js 搭建一套后端系统
    // 1.2 通过 npm 存储项目模板
    // 1.3 将项目模板信息存储到 mongodb 数据库中
    // 1.4 通过 egg.js 获取 mongodb 中的数据并通过 API 返回
    const { projectTemplate } = this.projectInfo;
    const templateInfo = this.template.find(
      (item) => item.npmName === projectTemplate
    );
    const targetPath = path.resolve(userHome, '.cli-test', 'template');
    const storeDir = path.resolve(
      userHome,
      '.cli-test',
      'template',
      'node_modules'
    );

    const { npmName, version } = templateInfo;

    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version,
    });

    this.templateInfo = templateInfo;

    if (!(await templateNpm.exists())) {
      const spinner = spinnerStart('正在下载模板...');
      await sleep();

      try {
        await templateNpm.install();
      } catch (error) {
        throw error;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('下载模板成功');
          this.templateNpm = templateNpm;
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模板...');
      await sleep();

      try {
        await templateNpm.update();
      } catch (error) {
        throw error;
      } finally {
        spinner.stop(true);
        if (await templateNpm.exists()) {
          log.success('更新模板成功');
          this.templateNpm = templateNpm;
        }
      }
    }
  }

  async prepare() {
    // 0. 判断项目模板是否存在
    const template = await getProjectTemplate();

    if (!template || template.length === 0) {
      throw new Error('项目模板不存在');
    }

    this.template = template;

    // 1. 判断当前目录是否为空
    const localPath = process.cwd(); // 或者 path.resolve('.');

    if (!this.isDirEmpty(localPath)) {
      let isContinue = true;

      if (!this.force) {
        // 询问是否继续创建
        isContinue = (
          await inquirer.prompt({
            type: 'confirm',
            name: 'isContinue',
            default: false,
            message: '当前文件夹不为空，是否继续创建项目',
          })
        ).isContinue;
      }

      if (!isContinue) {
        return;
      }

      // 2. 是否启动强制更新
      if (isContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？',
        });

        if (confirmDelete) {
          // 清空当前目录
          fse.emptyDirSync(localPath);
        }
      }
    }

    return this.getProjectInfo();
  }

  async getProjectInfo() {
    let projectInfo = {};

    // 1. 选择创建项目或者组件
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT,
        },
        {
          name: '组件',
          value: TYPE_COMPONENT,
        },
      ],
    });

    this.template = this.template.filter((template) =>
      template.tag.includes(type)
    );

    const title = type === TYPE_PROJECT ? `项目` : `组件`;

    const prompts = [
      {
        type: 'input',
        name: 'version',
        message: `请输入${title}版本号`,
        default: '1.0.0',
        validate: function (v) {
          const done = this.async();

          setTimeout(function () {
            if (!semver.valid(v)) {
              done('版本号不合法');

              return;
            }

            done(null, true);
          }, 0);
        },
        filter: function (v) {
          // 处理版本号 v1.0.0 -> 1.0.0
          return !!semver.valid(v) ? semver.valid(v) : v;
        },
      },
      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${title}模板`,
        choices: this.createTemplateChoices(),
      },
    ];

    if (this.projectName) {
      projectInfo.name = this.projectName;
    } else {
      prompts.unshift({
        type: 'input',
        name: 'name',
        message: `请输入${title}名称`,
        validate: function (v) {
          const done = this.async();

          setTimeout(function () {
            /**
          1. 首字符必须为英文字符
          2. 尾字符必须为英文或数字，不能为字符
          3. 字符仅允许"-_"
        */
            // \w 为a-zA-Z0-9_
            if (
              !/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])$/.test(
                v
              )
            ) {
              done('项目名称规则不正确');

              return;
            }

            done(null, true);
          }, 0);
        },
      });
    }

    if (type === TYPE_COMPONENT) {
      prompts.push({
        type: 'input',
        name: 'description',
        message: `请输入组件描述信息`,
        validate: function (v) {
          const done = this.async();

          setTimeout(function () {
            if (!v) {
              done('请完善组件描述信息');

              return;
            }

            done(null, true);
          }, 0);
        },
      });
    }

    const info = await inquirer.prompt(prompts);

    projectInfo = {
      ...projectInfo,
      type,
      ...info,
    };

    if (projectInfo.name) {
      // 模板中是className
      projectInfo.className = projectInfo.name;
    }

    return projectInfo;
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath); // 获取当前文件夹下的所有文件

    fileList = fileList.filter(
      (fileName) =>
        !fileName.startsWith('.') && !['node_modules'].includes(fileName)
    );

    return !fileList || fileList.length <= 0;
  }

  createTemplateChoices() {
    return this.template.map((item) => ({
      name: item.name,
      value: item.npmName,
    }));
  }
}

function init(argv) {
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
