const
  rollup = require('rollup'),
  buble = require('rollup-plugin-buble'),
  nodeResolve = require('rollup-plugin-node-resolve'),
  commonjs = require('rollup-plugin-commonjs'),
  banner = require('./rollup.vars').banner,
  banner_bundle = require('./rollup.vars').banner_bundle,
  intro = require('./rollup.vars').intro,
  replace = require('rollup-plugin-replace');

/// iife/amd
rollup.rollup({
  input: 'src/index.js',
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
  ]
}).then(bundle => {
  bundle.write({
    format: 'iife',
    name: 'esr',
    banner: banner,
    intro: intro,
    file: 'dist/esr.js'
  });
  bundle.write({
    format: 'amd',
    banner: banner,
    intro: intro,
    file: 'dist/amd.esr.js'
  });
}).catch(error => {
  console.error(error);
});


/// es/cjs
rollup.rollup({
  input: 'src/index.js',
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
  ]
}).then(bundle => {
  bundle.write({
    format: 'es',
    banner: banner,
    intro: intro,
    file: 'lib/index.js'
  });
  bundle.write({
    format: 'cjs',
    banner: banner,
    intro: intro,
    file: 'index.js'
  });
}).catch(error => {
  console.error(error);
});
