const
  buble = require('rollup-plugin-buble'),
  nodeResolve = require('rollup-plugin-node-resolve'),
  commonjs = require('rollup-plugin-commonjs'),
  banner = require('../../rollup.vars').banner,
  intro = require('../../rollup.vars').intro,
  replace = require('rollup-plugin-replace');

var debug = !!process.env.DEBUG ? true : false;

module.exports = (config) => {
  config.set({
    autoWatch: true,
    // client: { captureConsole: false },
    browsers: [
      'Chrome',
      // 'Firefox',
      // 'Safari'
    ],
    browserConsoleLogOptions: {
      level: 'error',
      format: '%b %T: %m',
      terminal: false
    },
    colors: true,
    files: [
      '../../src/index.js',
      'spec.js'
    ],
    frameworks: ['mocha', 'expect'],
    logLevel: config.LOG_DEBUG,
    //logLevel: config.LOG_ERROR,
    plugins: [
      'karma-rollup-preprocessor',
      'karma-mocha',
      'karma-mocha-reporter',
      'karma-expect',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-safari-launcher',
      'karma-coverage'
    ],
    preprocessors: {
      '../../src/index.js': ['rollup', 'coverage'],
      'spec.js': ['rollup']
    },
    reporters: ['mocha', 'coverage'],
    rollupPreprocessor: {
      // context: 'this',
      format: 'iife',
      name: 'Esr',
      banner: banner,
      intro: intro,
      plugins: [
        replace({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
        }),
        nodeResolve({
          jsnext: true,
          main: true,
          browser: true
        }),
        commonjs({
          include: 'node_modules/**'
        }),
        buble()
      ],
      sourceMap: false // 'inline'
    },
    singleRun: !debug
  });
};
