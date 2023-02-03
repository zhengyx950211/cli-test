#!/usr/bin/env node

const importLocal = require('import-local');

if (importLocal(__filename)) {
  require('npmlog').info("cli", "use local version of cli-test")
} else {
  require('../lib')(process.argv.slice(2))
}