const
  package = require('./package.json');

const
  banner = '/* esr version ' + package.version + ' */',
  banner_bundle = '/* esr version ' + package.version + ', esr version ' + package.devDependencies.riot + ' */',
  intro = 'var VERSION = "' + package.version + '";';

module.exports = {
  banner: banner,
  banner_bundle: banner_bundle,
  intro: intro
};
