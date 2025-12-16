/**
 * gsplat-flame-avatar
 * 
 * A specialized Gaussian Splatting library with FLAME parametric head model support.
 * Built on Three.js for real-time facial animation of Gaussian Splat avatars.
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * Extended with FLAME integration from gaussian-splat-renderer-for-lam
 */

// Enums
export * from './enums/index.js';

// Utils
export * from './utils/index.js';

// Api
export * from './api/index.js';

// Renderer (GaussianSplatRenderer, AnimationManager, state classes)
export * from './renderer/index.js';

// Buffers
export * from './buffers/index.js';

// Core (Viewer, SplatMesh, etc.)
export * from './core/index.js';

// Loaders
export * from './loaders/index.js';

// Materials
export * from './materials/index.js';

// Raycaster
export * from './raycaster/index.js';

// FLAME support
export * from './flame/index.js';
