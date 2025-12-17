// External dependencies - match 'three' and all three/* subpaths
const external = (id) => id === 'three' || id.startsWith('three/') || id === 'jszip';

export default [
  // ESM build (for modern bundlers and browsers)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.esm.js',
      format: 'esm',
      sourcemap: true
    },
    external
  },
  // CJS build (for Node require() / older consumers)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.cjs.js',
      format: 'cjs',
      sourcemap: true
    },
    external
  }
];
