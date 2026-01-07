import terser from '@rollup/plugin-terser';

// External dependencies - match 'three' and all three/* subpaths
const external = (id) => id === 'three' || id.startsWith('three/') || id === 'jszip';

// Terser options for production builds
const terserOptions = {
  compress: {
    drop_console: false, // Keep console.error/warn for critical errors
    drop_debugger: true,
    pure_funcs: ['console.log', 'console.debug'], // Remove console.log/debug only
    passes: 2
  },
  mangle: {
    reserved: ['GaussianSplatRenderer', 'Viewer', 'FlameAnimator'] // Keep main API class names
  },
  format: {
    comments: false
  }
};

export default [
  // ESM build (for modern bundlers - unminified with inline sourcemaps)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.esm.js',
      format: 'esm',
      sourcemap: 'inline'
    },
    external
  },

  // ESM production build (minified with external sourcemaps)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.esm.min.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [terser(terserOptions)],
    external
  },

  // CJS build (for Node require() - unminified with inline sourcemaps)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.cjs.js',
      format: 'cjs',
      sourcemap: 'inline'
    },
    external
  },

  // CJS production build (minified with external sourcemaps)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gsplat-flame-avatar-renderer.cjs.min.js',
      format: 'cjs',
      sourcemap: true
    },
    plugins: [terser(terserOptions)],
    external
  }
];
