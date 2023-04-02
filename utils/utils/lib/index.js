'use strict';

function isObject(o) {
  return o && Object.prototype.toString(o) === '[object Object]';
}

function spinnerStart(msg, spinnerString = '|/-\\') {
  const Spinner = require('cli-spinner').Spinner;

  const spinner = new Spinner(`${msg} %s`);
  spinner.setSpinnerString(spinnerString);
  spinner.start();

  return spinner;
}

function sleep(time = 1000) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

module.exports = {
  isObject,
  spinnerStart,
  sleep,
};
