'use strict';

const axios = require('axios');
const urlJoin = require('url-join');
const semver = require('semver');

function getNpmInfo(npmName, registry) {
  if (!npmName) {
    return;
  }

  registry = registry || getDefaultRegistry();
  const npmInfoUrl = urlJoin(registry, npmName);

  return axios
    .get(npmInfoUrl)
    .then((response) => {
      if (response?.status === 200) {
        // return Object.keys(response.data?.versions);
        return response.data?.['dist-tags']?.latest;
      }
    })
    .catch((error) => {
      // Promise.reject(error)
    });
}

async function getNpmSemverVersion(baseVersion, npmName, registry) {
  const versions = await getNpmInfo(npmName, registry);

  // let semverVersions = [];

  // if (versions && versions.length > 0) {
  //   semverVersions = versions
  //     .filter(version => semver.satisfies(version, `^${baseVersion}`))
  //     .sort((a, b) => {
  //       // 直接 return semver.gt(b, a) 不生效，sort 比较的是数字
  //       return semver.gt(b, a) ? 1 : -1;
  //     })
  // }

  // return semverVersions[0];

  return versions;
}

function getDefaultRegistry(isOriginal = false) {
  return isOriginal
    ? 'https://registry.npmjs.org/'
    : 'https://registry.npm.taobao.org';
}

module.exports = {
  getNpmSemverVersion,
  getDefaultRegistry,
  getNpmInfo,
};
