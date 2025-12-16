/**
 * gsplat-flame-avatar - FLAME Module
 * Modified GaussianSplats3D components with FLAME parametric head model support
 */

// FLAME-specific Constants (exported as FlameConstants to avoid conflict)
export { Constants as FlameConstants } from './FlameConstants.js';

// Texture Constants (not duplicated elsewhere)
export { TextureConstants } from './utils.js';

// FLAME support
export { 
    FlameTextureManager,
    buildModelTexture,
    buildBoneMatrixTexture,
    updateBoneMatrixTexture,
    buildBoneWeightTexture,
    getUpdatedBoneMatrices
} from './FlameTextureManager.js';

export { FlameAnimator } from './FlameAnimator.js';
