'use strict';

const log = require('@cli-test/log');

const Command = require('@cli-test/command');

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || '';
    this.force = !!this.cmd.optionValues?.force;

    log.verbose('projectName: ', this.projectName);
    log.verbose('force: ', this.force);
  }

  exec() {
    console.log('init 的业务逻辑');
  }
}

function init(argv) {
  return new InitCommand(argv);
}

module.exports = init;
module.exports.InitCommand = InitCommand;
