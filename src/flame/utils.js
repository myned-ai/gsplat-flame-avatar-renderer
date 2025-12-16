/**
 * FLAME Utility Functions
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * Contains encoding functions and helpers for GPU texture data.
 */

/**
 * Encode float as uint32 for GPU texture storage
 * Uses Float32Array/Int32Array view trick to reinterpret float bits as integer
 */
export const uintEncodedFloat = (function() {
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function(f) {
        floatView[0] = f;
        return int32View[0];
    };
})();

/**
 * Convert RGBA values to a single integer
 */
export const rgbaToInteger = function(r, g, b, a) {
    return r + (g << 8) + (b << 16) + (a << 24);
};

/**
 * Convert RGBA array at offset to a single integer
 */
export const rgbaArrayToInteger = function(arr, offset) {
    return arr[offset] + (arr[offset + 1] << 8) + (arr[offset + 2] << 16) + (arr[offset + 3] << 24);
};

/**
 * Constants for texture data layout
 */
export const TextureConstants = {
    CENTER_COLORS_ELEMENTS_PER_TEXEL: 4,
    CENTER_COLORS_ELEMENTS_PER_SPLAT: 4,
    COVARIANCES_ELEMENTS_PER_TEXEL_STORED: 2,
    COVARIANCES_ELEMENTS_PER_TEXEL_ALLOCATED: 4,
    COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_STORED: 2,
    COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_ALLOCATED: 4,
    COVARIANCES_ELEMENTS_PER_SPLAT: 6,
    SCALES_ROTATIONS_ELEMENTS_PER_TEXEL: 4,
    SCENE_INDEXES_ELEMENTS_PER_TEXEL: 1,
    MAX_TEXTURE_TEXELS: 4096 * 4096
};
