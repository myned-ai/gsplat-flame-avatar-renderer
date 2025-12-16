/**
 * FlameConstants
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * FLAME-specific constants for parametric head model.
 * 
 * Note: General engine constants (MaxScenes, etc.) are in enums/EngineConstants.js
 */

export const Constants = {
    // FLAME model constants
    FlameBonesCount: 5,  // root, neck, jaw, leftEye, rightEye
    DefaultBlendshapeCount: 52,  // ARKit blendshapes
    
    // Texture sizes for FLAME data
    FlameModelTextureSize: { width: 4096, height: 2048 },
    BoneTextureSize: { width: 4, height: 32 },
    BoneWeightTextureSize: { width: 512, height: 512 }
};

export default Constants;
