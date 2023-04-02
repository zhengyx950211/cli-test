'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const semver = require('semver');
const userHome = require('user-home');
const log = require('@cli-test/log');
const { spinnerStart, sleep } = require('@cli-test/utils');
const Command = require('@cli-test/command');
const Package = require('@cli-test/package');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

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
      }
    } catch (e) {
      log.error(e.message);
    }
  }

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

    if (!(await templateNpm.exists())) {
      const spinner = spinnerStart('正在下载模板...');
      await sleep();

      try {
        await templateNpm.install();
        log.success('下载模板成功');
      } catch (error) {
        throw error;
      } finally {
        spinner.stop(true);
      }
    } else {
      const spinner = spinnerStart('正在更新模板...');
      await sleep();

      try {
        await templateNpm.update();
        log.success('更新模板成功');
      } catch (error) {
        throw error;
      } finally {
        spinner.stop(true);
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
      let isContinue = false;

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

    // 2. 获取项目的基本信息
    if (type === TYPE_PROJECT) {
      const info = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: '请输入项目名称',
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
        },
        {
          type: 'input',
          name: 'projectVersion',
          message: '请输入项目版本号',
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
          message: '请选择项目模板',
          choices: this.createTemplateChoices(),
        },
      ]);

      projectInfo = {
        type,
        ...info,
      };
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
