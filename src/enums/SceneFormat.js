/**
 * Scene format enumeration for supported file types
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Simplified for FLAME avatar usage - only PLY format is supported.
 */
export const SceneFormat = {
    'Ply': 0
};

/**
 * Determine scene format from file path
 * @param {string} path - File path
 * @returns {number|null} Scene format or null if unknown
 */
export const sceneFormatFromPath = (path) => {
    if (path.endsWith('.ply')) return SceneFormat.Ply;
    return null;
};
