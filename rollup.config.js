import terser from '@rollup/plugin-terser';

// External dependencies - match 'three' and all three/* subpaths
const external = (id) => id === 'three' || id.startsWith('three/') || id === 'jszip';

// Globals for UMD builds
const globals = {
  three: 'THREE',
  jszip: 'JSZip',
  'three/examples/jsm/loaders/GLTFLoader.js': 'THREE',
  'three/examples/jsm/controls/OrbitControls.js': 'THREE'
};

export default [
  // ESM build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.esm.js',
      format: 'esm',
      sourcemap: true
    },
    external
  },
  // ESM minified
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.esm.min.js',
      format: 'esm',
      sourcemap: true
    },
    external,
    plugins: [terser()]
  },
  // UMD build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.umd.js',
      format: 'umd',
      name: 'GsplatFlameAvatarRenderer',
      sourcemap: true,
      globals
    },
    external
  },
  // UMD minified
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.umd.min.js',
      format: 'umd',
      name: 'GsplatFlameAvatarRenderer',
      sourcemap: true,
      globals
    },
    external,
    plugins: [terser()]
  }
];
