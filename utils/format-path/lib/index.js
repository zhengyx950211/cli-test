'use strict';

const path = require('path');

function formatPath(p) {
  if (p && typeof p === 'string') {
    // 分隔符 macOS: /  windows: \
    const sep = path.sep;
    console.log('sep', sep);
    if (sep === '/') {
      return p;
    }

    return p.replace(/\\/g, '/');
  }

  return p;
}

module.exports = formatPath;
