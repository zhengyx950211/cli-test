'use strict';

class Command {
  constructor(argv) {
    console.log('command constructor', argv);
    this._argv = argv;
  }

  init() {
    throw new Error('init 必须实现');
  }

  exec() {
    throw new Error('exec 必须实现');
  }
}

module.exports = Command;
