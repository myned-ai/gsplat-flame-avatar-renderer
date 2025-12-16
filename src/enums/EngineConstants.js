/**
 * EngineConstants
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Core constants for Gaussian Splat rendering.
 */

export class Constants {
    static DefaultSplatSortDistanceMapPrecision = 16;
    static MemoryPageSize = 65536;
    static BytesPerFloat = 4;
    static BytesPerInt = 4;
    static MaxScenes = 32;
    static ProgressiveLoadSectionSize = 262144;
    static ProgressiveLoadSectionDelayDuration = 15;
    static SphericalHarmonics8BitCompressionRange = 3;
}

export const DefaultSphericalHarmonics8BitCompressionRange = Constants.SphericalHarmonics8BitCompressionRange;

// SplatMesh constants
export const COVARIANCES_ELEMENTS_PER_SPLAT = 6;
export const CENTER_COLORS_ELEMENTS_PER_SPLAT = 4;

export const COVARIANCES_ELEMENTS_PER_TEXEL_STORED = 4;
export const COVARIANCES_ELEMENTS_PER_TEXEL_ALLOCATED = 4;
export const COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_STORED = 6;
export const COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_ALLOCATED = 8;
export const SCALES_ROTATIONS_ELEMENTS_PER_TEXEL = 4;
export const CENTER_COLORS_ELEMENTS_PER_TEXEL = 4;
export const SCENE_INDEXES_ELEMENTS_PER_TEXEL = 1;

export const SCENE_FADEIN_RATE_FAST = 0.012;
export const SCENE_FADEIN_RATE_GRADUAL = 0.003;

// Viewer constants
export const THREE_CAMERA_FOV = 50;
export const MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT = 0.5;
export const CONSECUTIVE_RENDERED_FRAMES_FOR_FPS_CALCULATION = 60;
export const MIN_SPLAT_COUNT_TO_SHOW_SPLAT_TREE_LOADING_SPINNER = 1500000;
export const FOCUS_MARKER_FADE_IN_SPEED = 0.4;
export const FOCUS_MARKER_FADE_OUT_SPEED = 0.12;

// Internal load types for loaders
export const InternalLoadType = {
    DirectToSplatBuffer: 0,
    DirectToSplatArray: 1,
    DownloadBeforeProcessing: 2
};

// Loader status
export const LoaderStatus = {
    'Downloading': 0,
    'Processing': 1,
    'Done': 2
};
