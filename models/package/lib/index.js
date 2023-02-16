'use strict';

const path = require('path');
const pkgDir = require('pkg-dir').sync;
const pathExists = require('path-exists').sync;
const npminstall = require('npminstall');
const fse = require('fs-extra');

const formatPath = require('@cli-test/format-path');
const { isObject } = require('@cli-test/utils');
const { getDefaultRegistry, getNpmInfo } = require('@cli-test/get-npm-info');

class Package {
  constructor(options) {
    if (!options) {
      throw new Error('package 的 options 不能为空!');
    }
    if (!isObject(options)) {
      throw new Error('package 的 options 必须为对象!');
    }
    // package 的目标路径
    this.targetPath = options.targetPath;
    // package 缓存路径
    this.storeDir = options.storeDir;
    // package 的 name
    this.packageName = options.packageName;
    // package 的 version
    this.packageVersion = options.packageVersion;
    // 缓存目录前缀
    this.cacheFilePathPrefix = this.packageName.replace('/', '+');
  }

  async prepare() {
    // 缓存目录不存在，创建 npminstall 的时候会创建，这里应该不需要吧
    // if (this.storeDir && !path.exists(this.storeDir)) {
    //   fse.mkdirpSync(this.storeDir);
    // }

    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmInfo(this.packageName);
    }
  }

  get cacheFilePath() {
    // return path.resolve(
    //   this.storeDir,
    //   `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`
    // );

    return path.resolve(
      this.storeDir,
      `.store/${this.cacheFilePathPrefix}@${this.packageVersion}/node_modules/${this.packageName}`
    );
  }

  getSpecificFilePath(version) {
    return path.resolve(
      this.storeDir,
      `.store/${this.cacheFilePathPrefix}@${version}/node_modules/${this.packageName}`
    );
  }

  // 判断当前的 Package 是否存在
  async exists() {
    if (this.storeDir) {
      await this.prepare();

      return pathExists(this.cacheFilePath);
    }

    return pathExists(this.targetPath);
  }

  async install() {
    // await this.prepare();

    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [{ name: this.packageName, version: this.packageVersion }],
    });
  }

  async update() {
    // await this.prepare(); // 是否必要 exists() 时已执行
    // 获取最新版本号
    const latestVersion = await getNpmInfo(this.packageName);
    // 查看最新版本号是否存在
    const latestPath = this.getSpecificFilePath(latestVersion);
    // 安装最新版本号
    if (!pathExists(latestPath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(),
        pkgs: [{ name: this.packageName, version: latestVersion }],
      });

      this.packageVersion = latestVersion;
    }
  }

  // 获取入口文件的路径
  getRootFilePath() {
    function _getFilePath(targetPath) {
      // 1. 获取 package.json 所在的目录，即模块的根目录 -- pkg-dir
      // ** pkg-dir 最新版本已对 windows 做了兼容， 不需要再使用 formatPath 了
      const dir = pkgDir(targetPath);
      // 2. 读取 package.json 中的 main 或 lib 输出 path
      // 3. 路径的兼容 macOS/windows
      if (dir) {
        const pkg = require(path.resolve(dir, 'package.json'));

        if (pkg && pkg.main) {
          return formatPath(path.resolve(dir, pkg.main));
        }
      }

      return null;
    }

    if (this.storeDir) {
      return _getFilePath(this.cacheFilePath);
    }

    return _getFilePath(this.targetPath);
  }
}

module.exports = Package;
