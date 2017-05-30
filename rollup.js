const
  rollup = require('rollup'),
  buble = require('rollup-plugin-buble'),
  nodeResolve = require('rollup-plugin-node-resolve'),
  commonjs = require('rollup-plugin-commonjs'),
  banner = require('./rollup.vars').banner,
  banner_bundle = require('./rollup.vars').banner_bundle,
  intro = require('./rollup.vars').intro,
  replace = require('rollup-plugin-replace');

let namedExports = {
  'node_modules/mout/array.js': [ 'find', 'forEach' ]
};

// @see https://github.com/rollup/rollup/wiki/JavaScript-API

/// iife/amd
rollup.rollup({
  entry: 'src/index.js',
  plugins: [
    replace({
      'process.env.NODE_ENV': '"production"' // local/development/staging/production
    }),
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true
    }),
    commonjs({
      include: 'node_modules/**',
      namedExports: namedExports
    }),
    buble()
  ]
}).then(bundle => {
  bundle.write({
    format: 'iife',
    moduleName: 'esr',
    banner: banner,
    intro: intro,
    dest: 'dist/esr.js'
  });
  bundle.write({
    format: 'amd',
    banner: banner,
    intro: intro,
    dest: 'dist/amd.esr.js'
  });
}).catch(error => {
  console.error(error);
});


/// es/cjs
rollup.rollup({
  entry: 'src/index.js',
  plugins: [
    replace({
      'process.env.NODE_ENV': '"production"' // local/development/staging/production
    }),
    nodeResolve({
      jsnext: true,
      main: true,
      browser: true
    }),
    commonjs({
      include: 'node_modules/**',
      namedExports: namedExports
    }),
    buble()
  ]
}).then(bundle => {
  bundle.write({
    format: 'es',
    banner: banner,
    intro: intro,
    dest: 'lib/index.js'
  });
  bundle.write({
    format: 'cjs',
    banner: banner,
    intro: intro,
    dest: 'index.js'
  });
}).catch(error => {
  console.error(error);
});
