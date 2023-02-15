'use strict';

function isObject(o) {
  return Object.prototype.toString(o) === '[object Object]';
}

module.exports = {
  isObject,
};
