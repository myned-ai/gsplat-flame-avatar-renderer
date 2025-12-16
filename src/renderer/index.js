/**
 * gsplat-flame-avatar - Renderer Module
 * Main exports for the renderer classes
 */

// Constants
export * from './AppConstants.js';

// Animation - includes state classes
export { 
    AnimationManager,
    State,
    Hello,
    Idle,
    Listen,
    Think,
    Speak
} from './AnimationManager.js';

// Main Renderer
export { GaussianSplatRenderer } from './GaussianSplatRenderer.js';

// Default export
export { GaussianSplatRenderer as default } from './GaussianSplatRenderer.js';
