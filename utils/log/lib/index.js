'use strict';

const log = require('npmlog');

// npmlog 默认的 level 为 info 2000
// 判断 debug 模式
log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';
// 添加 log 前缀
log.heading = 'zyx';
// 前缀样式
// log.headingStyle = { fg: 'black', bg: 'white' }
// 添加自定义命令
log.addLevel('success', 2000, { fg: 'white', bold: true, bg: 'green' });

module.exports = log;
