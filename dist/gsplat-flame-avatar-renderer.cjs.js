'use strict';

var THREE = require('three');
var GLTFLoader_js = require('three/examples/jsm/loaders/GLTFLoader.js');
var JSZip = require('jszip');
var OrbitControls_js = require('three/examples/jsm/controls/OrbitControls.js');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var THREE__namespace = /*#__PURE__*/_interopNamespaceDefault(THREE);

/**
 * Log level enumeration for controlling verbosity
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 */
const LogLevel = {
    None: 0,
    Error: 1,
    Warning: 2,
    Info: 3,
    Debug: 4
};

/**
 * Render mode enumeration
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 */
const RenderMode = {
    Always: 0,
    OnChange: 1,
    Never: 2
};

/**
 * Scene format enumeration for supported file types
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Simplified for FLAME avatar usage - only PLY format is supported.
 */
const SceneFormat = {
    'Ply': 0
};

/**
 * Determine scene format from file path
 * @param {string} path - File path
 * @returns {number|null} Scene format or null if unknown
 */
const sceneFormatFromPath = (path) => {
    if (path.endsWith('.ply')) return SceneFormat.Ply;
    return null;
};

/**
 * Scene reveal mode enumeration
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 */
const SceneRevealMode = {
    Default: 0,
    Gradual: 1,
    Instant: 2
};

/**
 * Splat render mode enumeration
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 */
const SplatRenderMode = {
    ThreeD: 0,
    TwoD: 1
};

/**
 * EngineConstants
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Core constants for Gaussian Splat rendering.
 */

let Constants$1 = class Constants {
    static DefaultSplatSortDistanceMapPrecision = 16;
    static MemoryPageSize = 65536;
    static BytesPerFloat = 4;
    static BytesPerInt = 4;
    static MaxScenes = 32;
    static ProgressiveLoadSectionSize = 262144;
    static ProgressiveLoadSectionDelayDuration = 15;
    static SphericalHarmonics8BitCompressionRange = 3;
};

const DefaultSphericalHarmonics8BitCompressionRange = Constants$1.SphericalHarmonics8BitCompressionRange;

// SplatMesh constants
const COVARIANCES_ELEMENTS_PER_SPLAT$1 = 6;
const CENTER_COLORS_ELEMENTS_PER_SPLAT$1 = 4;

const COVARIANCES_ELEMENTS_PER_TEXEL_STORED$1 = 4;
const COVARIANCES_ELEMENTS_PER_TEXEL_ALLOCATED$1 = 4;
const COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_STORED$1 = 6;
const COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_ALLOCATED$1 = 8;
const SCALES_ROTATIONS_ELEMENTS_PER_TEXEL$1 = 4;
const CENTER_COLORS_ELEMENTS_PER_TEXEL$1 = 4;
const SCENE_INDEXES_ELEMENTS_PER_TEXEL$1 = 1;

const SCENE_FADEIN_RATE_FAST$1 = 0.012;
const SCENE_FADEIN_RATE_GRADUAL$1 = 0.003;

// Viewer constants
const THREE_CAMERA_FOV = 50;
const MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT = 0.5;
const CONSECUTIVE_RENDERED_FRAMES_FOR_FPS_CALCULATION = 60;
const MIN_SPLAT_COUNT_TO_SHOW_SPLAT_TREE_LOADING_SPINNER = 1500000;
const FOCUS_MARKER_FADE_IN_SPEED = 0.4;
const FOCUS_MARKER_FADE_OUT_SPEED = 0.12;

// Internal load types for loaders
const InternalLoadType = {
    DirectToSplatBuffer: 0,
    DirectToSplatArray: 1,
    DownloadBeforeProcessing: 2
};

// Loader status
const LoaderStatus = {
    'Downloading': 0,
    'Processing': 1,
    'Done': 2
};

/**
 * LoaderUtils
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Loader utilities for decoding text and resolving URLs.
 */

class LoaderUtils {

    /**
     * @deprecated Use TextDecoder instead
     */
    static decodeText(array) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(array);
        }

        // Fallback for environments without TextDecoder
        let s = '';

        for (let i = 0, il = array.length; i < il; i++) {
            // Implicitly assumes little-endian.
            s += String.fromCharCode(array[i]);
        }

        try {
            // merges multi-byte utf-8 characters.
            return decodeURIComponent(escape(s));
        } catch (e) { // see #16358
            return s;
        }
    }

    static extractUrlBase(url) {
        const index = url.lastIndexOf('/');

        if (index === -1) return './';

        return url.slice(0, index + 1);
    }

    static resolveURL(url, path) {
        // Invalid URL
        if (typeof url !== 'string' || url === '') return '';

        // Host Relative URL
        if (/^https?:\/\//i.test(path) && /^\//.test(url)) {
            path = path.replace(/(^https?:\/\/[^/]+).*/i, '$1');
        }

        // Absolute URL http://,https://,//
        if (/^(https?:)?\/\//i.test(url)) return url;

        // Data URI
        if (/^data:.*,.*$/i.test(url)) return url;

        // Blob URL
        if (/^blob:.*$/i.test(url)) return url;

        // Relative URL
        return path + url;
    }
}

/**
 * Core utility functions for Gaussian Splat rendering
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */


/**
 * Custom error for aborted operations
 */
class AbortedPromiseError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'AbortedPromiseError';
    }
}

/**
 * Fetch with progress tracking using standard AbortController
 * Returns a Promise with an attached `abort()` method and `abortController`
 */
const fetchWithProgress = function(path, onProgress, saveChunks = true, headers) {

    const abortController = new AbortController();
    const signal = abortController.signal;
    let aborted = false;

    let onProgressCalledAtComplete = false;
    const localOnProgress = (percent, percentLabel, chunk, fileSize) => {
        if (onProgress && !onProgressCalledAtComplete) {
            onProgress(percent, percentLabel, chunk, fileSize);
            if (percent === 100) {
                onProgressCalledAtComplete = true;
            }
        }
    };

    const promise = new Promise((resolve, reject) => {
        const fetchOptions = { signal };
        if (headers) fetchOptions.headers = headers;
        
        fetch(path, fetchOptions)
        .then(async (data) => {
            // Handle error conditions where data is still returned
            if (!data.ok) {
                const errorText = await data.text();
                reject(new Error(`Fetch failed: ${data.status} ${data.statusText} ${errorText}`));
                return;
            }

            const reader = data.body.getReader();
            let bytesDownloaded = 0;
            let _fileSize = data.headers.get('Content-Length');
            let fileSize = _fileSize ? parseInt(_fileSize) : undefined;

            const chunks = [];

            while (!aborted) {
                try {
                    const { value: chunk, done } = await reader.read();
                    if (done) {
                        localOnProgress(100, '100%', chunk, fileSize);
                        if (saveChunks) {
                            const buffer = new Blob(chunks).arrayBuffer();
                            resolve(buffer);
                        } else {
                            resolve();
                        }
                        break;
                    }
                    bytesDownloaded += chunk.length;
                    let percent;
                    let percentLabel;
                    if (fileSize !== undefined) {
                        percent = bytesDownloaded / fileSize * 100;
                        percentLabel = `${percent.toFixed(2)}%`;
                    }
                    if (saveChunks) {
                        chunks.push(chunk);
                    }
                    localOnProgress(percent, percentLabel, chunk, fileSize);
                } catch (error) {
                    reject(error);
                    return;
                }
            }
        })
        .catch((error) => {
            if (error.name === 'AbortError') {
                reject(new AbortedPromiseError('Fetch aborted'));
            } else {
                reject(new AbortedPromiseError(error.message || error));
            }
        });
    });

    // Attach abort functionality to the promise
    promise.abort = (reason) => {
        aborted = true;
        abortController.abort(reason);
    };
    promise.abortController = abortController;

    return promise;
};

// Clamp value between min and max
const clamp = function(val, min, max) {
    return Math.max(Math.min(val, max), min);
};

// Get current time in seconds
const getCurrentTime = function() {
    return performance.now() / 1000;
};

// Dispose all meshes in a scene graph
const disposeAllMeshes = (object3D) => {
    if (object3D.geometry) {
        object3D.geometry.dispose();
        object3D.geometry = null;
    }
    if (object3D.material) {
        object3D.material.dispose();
        object3D.material = null;
    }
    if (object3D.children) {
        for (let child of object3D.children) {
            disposeAllMeshes(child);
        }
    }
};

// Delayed execution helper
const delayedExecute = (func, fast) => {
    return new Promise((resolve) => {
        window.setTimeout(() => {
            resolve(func());
        }, fast ? 1 : 50);
    });
};

// Get spherical harmonics component count for degree
const getSphericalHarmonicsComponentCountForDegree = (sphericalHarmonicsDegree = 0) => {
    switch (sphericalHarmonicsDegree) {
        case 1:
            return 9;
        case 2:
            return 24;
    }
    return 0;
};

// Create native promise with extracted components
const nativePromiseWithExtractedComponents = () => {
    let resolver;
    let rejecter;
    const promise = new Promise((resolve, reject) => {
        resolver = resolve;
        rejecter = reject;
    });
    return {
        'promise': promise,
        'resolve': resolver,
        'reject': rejecter
    };
};

/**
 * Create a promise with extracted resolve/reject functions and optional abort capability
 * Uses standard Promise with attached abort method
 */
const abortablePromiseWithExtractedComponents = (abortHandler) => {
    let resolver;
    let rejecter;
    const promise = new Promise((resolve, reject) => {
        resolver = resolve;
        rejecter = reject;
    });
    
    // Attach abort method to promise
    promise.abort = abortHandler || (() => {});
    
    return {
        'promise': promise,
        'resolve': resolver,
        'reject': rejecter
    };
};

// Semver class for version handling
class Semver {
    constructor(major, minor, patch) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    toString() {
        return `${this.major}_${this.minor}_${this.patch}`;
    }
}

// iOS detection
function isIOS() {
    const ua = navigator.userAgent;
    return ua.indexOf('iPhone') > 0 || ua.indexOf('iPad') > 0;
}

function getIOSSemever() {
    if (isIOS()) {
        const extract = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
        return new Semver(
            parseInt(extract[1] || 0, 10),
            parseInt(extract[2] || 0, 10),
            parseInt(extract[3] || 0, 10)
        );
    }
    return null;
}

// Half float conversion utilities
const toHalfFloat$1 = THREE.DataUtils.toHalfFloat.bind(THREE.DataUtils);
const fromHalfFloat$1 = THREE.DataUtils.fromHalfFloat.bind(THREE.DataUtils);
const DefaultSphericalHarmonics8BitCompressionHalfRange = DefaultSphericalHarmonics8BitCompressionRange / 2.0;

// Uncompress float based on compression level
const toUncompressedFloat$1 = (f, compressionLevel, isSH = false, range8BitMin, range8BitMax) => {
    if (compressionLevel === 0) {
        return f;
    } else if (compressionLevel === 1 || (compressionLevel === 2 && !isSH)) {
        return THREE.DataUtils.fromHalfFloat(f);
    } else if (compressionLevel === 2) {
        return fromUint8$1(f, range8BitMin, range8BitMax);
    }
};

// Convert to uint8
const toUint8$1 = (v, rangeMin, rangeMax) => {
    v = clamp(v, rangeMin, rangeMax);
    const range = (rangeMax - rangeMin);
    return clamp(Math.floor((v - rangeMin) / range * 255), 0, 255);
};

// Convert from uint8
const fromUint8$1 = (v, rangeMin, rangeMax) => {
    const range = (rangeMax - rangeMin);
    return (v / 255 * range + rangeMin);
};

// Half float to uint8
const fromHalfFloatToUint8$1 = (v, rangeMin, rangeMax) => {
    return toUint8$1(fromHalfFloat$1(v), rangeMin, rangeMax);
};

// Uint8 to half float
const fromUint8ToHalfFloat = (v, rangeMin, rangeMax) => {
    return toHalfFloat$1(fromUint8$1(v, rangeMin, rangeMax));
};

// Read float from DataView based on compression level
const dataViewFloatForCompressionLevel$1 = (dataView, floatIndex, compressionLevel, isSH = false) => {
    if (compressionLevel === 0) {
        return dataView.getFloat32(floatIndex * 4, true);
    } else if (compressionLevel === 1 || (compressionLevel === 2 && !isSH)) {
        return dataView.getUint16(floatIndex * 2, true);
    } else {
        return dataView.getUint8(floatIndex, true);
    }
};

// Convert between compression levels
const convertBetweenCompressionLevels = function() {
    const noop = (v) => v;

    return function(val, fromLevel, toLevel, isSH = false) {
        if (fromLevel === toLevel) return val;
        let outputConversionFunc = noop;

        if (fromLevel === 2 && isSH) {
            if (toLevel === 1) outputConversionFunc = fromUint8ToHalfFloat;
            else if (toLevel === 0) {
                outputConversionFunc = fromUint8$1;
            }
        } else if (fromLevel === 2 || fromLevel === 1) {
            if (toLevel === 0) outputConversionFunc = fromHalfFloat$1;
            else if (toLevel === 2) {
                if (!isSH) outputConversionFunc = noop;
                else outputConversionFunc = fromHalfFloatToUint8$1;
            }
        } else if (fromLevel === 0) {
            if (toLevel === 1) outputConversionFunc = toHalfFloat$1;
            else if (toLevel === 2) {
                if (!isSH) outputConversionFunc = toHalfFloat$1;
                else outputConversionFunc = toUint8$1;
            }
        }

        return outputConversionFunc(val);
    };
}();

// Copy between buffers
const copyBetweenBuffers$1 = (srcBuffer, srcOffset, destBuffer, destOffset, byteCount = 0) => {
    const src = new Uint8Array(srcBuffer, srcOffset);
    const dest = new Uint8Array(destBuffer, destOffset);
    for (let i = 0; i < byteCount; i++) {
        dest[i] = src[i];
    }
};

// Float to half float conversion
const floatToHalf = function() {
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function(val) {
        floatView[0] = val;
        const x = int32View[0];

        let bits = (x >> 16) & 0x8000;
        let m = (x >> 12) & 0x07ff;
        const e = (x >> 23) & 0xff;

        if (e < 103) return bits;

        if (e > 142) {
            bits |= 0x7c00;
            bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
            return bits;
        }

        if (e < 113) {
            m |= 0x0800;
            bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
            return bits;
        }

        bits |= ((e - 112) << 10) | (m >> 1);
        bits += m & 1;
        return bits;
    };
}();

// Encode float as uint
const uintEncodedFloat$1 = function() {
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function(f) {
        floatView[0] = f;
        return int32View[0];
    };
}();

// RGBA to integer
const rgbaToInteger = function(r, g, b, a) {
    return r + (g << 8) + (b << 16) + (a << 24);
};

// RGBA array to integer
const rgbaArrayToInteger = function(arr, offset) {
    return arr[offset] + (arr[offset + 1] << 8) + (arr[offset + 2] << 16) + (arr[offset + 3] << 24);
};

// BASE_COMPONENT_COUNT for UncompressedSplatArray
const BASE_COMPONENT_COUNT$1 = 14;

/**
 * AppConstants
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * Animation state constants and ARKit blendshape mappings.
 */

/**
 * Voice chat state enumeration
 * Controls the rendering and behavior modes of the avatar
 */
const TYVoiceChatState = {
    Idle: 'Idle',           // Idle/waiting state
    Listening: 'Listening', // Listening to user input
    Responding: 'Responding', // Speaking/responding animation
    Thinking: 'Thinking'    // Processing/thinking animation
};

/**
 * ARKit blendshape names (52 expressions)
 * Used for facial expression mapping from ARKit face tracking
 */
const ARKitBlendshapes = [
    'browDownLeft',
    'browDownRight',
    'browInnerUp',
    'browOuterUpLeft',
    'browOuterUpRight',
    'cheekPuff',
    'cheekSquintLeft',
    'cheekSquintRight',
    'eyeBlinkLeft',
    'eyeBlinkRight',
    'eyeLookDownLeft',
    'eyeLookDownRight',
    'eyeLookInLeft',
    'eyeLookInRight',
    'eyeLookOutLeft',
    'eyeLookOutRight',
    'eyeLookUpLeft',
    'eyeLookUpRight',
    'eyeSquintLeft',
    'eyeSquintRight',
    'eyeWideLeft',
    'eyeWideRight',
    'jawForward',
    'jawLeft',
    'jawOpen',
    'jawRight',
    'mouthClose',
    'mouthDimpleLeft',
    'mouthDimpleRight',
    'mouthFrownLeft',
    'mouthFrownRight',
    'mouthFunnel',
    'mouthLeft',
    'mouthLowerDownLeft',
    'mouthLowerDownRight',
    'mouthPressLeft',
    'mouthPressRight',
    'mouthPucker',
    'mouthRight',
    'mouthRollLower',
    'mouthRollUpper',
    'mouthShrugLower',
    'mouthShrugUpper',
    'mouthSmileLeft',
    'mouthSmileRight',
    'mouthStretchLeft',
    'mouthStretchRight',
    'mouthUpperUpLeft',
    'mouthUpperUpRight',
    'noseSneerLeft',
    'noseSneerRight',
    'tongueOut'
];

/**
 * FLAME model bone names
 */
const FlameBoneNames = [
    'root',
    'neck',
    'jaw',
    'leftEye',
    'rightEye'
];

/**
 * Constants derived from the arrays
 */
const ARKIT_BLENDSHAPES_COUNT = ARKitBlendshapes.length;
const FLAME_BONES_COUNT = FlameBoneNames.length;

/**
 * AnimationManager
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * Manages animation state machine with Three.js AnimationMixer.
 */


/**
 * Base State class for animation states
 */
class State {
    constructor(actions, isGroup) {
        this.isPlaying = false;
        this.stage = 0;
        this.actions = actions || [];
        this.blendingTime = 0.5;
        this.isGroup = isGroup || false;
    }

    dispose() {
        this.actions = [];
    }

    update(state) {
        // Override in subclasses
    }
}

/**
 * Hello state - initial greeting animation
 */
class Hello extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Idle &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = THREE.LoopRepeat;
            this.actions[this.stage].clampWhenFinished = false;
            this.actions[this.stage].paused = false;
            this.actions[this.stage].play();
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Idle &&
            state === TYVoiceChatState.Idle &&
            this.isPlaying === true) {
            if (this.actions[this.stage].time >
                this.actions[this.stage].getClip().duration - this.blendingTime) {
                let nextStage = this.stage + 1;
                if (nextStage >= this.actions.length) nextStage = 0;
                this.actions[nextStage].time = 0;
                AnimationManager.SetWeight(this.actions[nextStage], 1.0);
                this.actions[nextStage].loop = THREE.LoopRepeat;
                this.actions[nextStage].play();
                AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[nextStage], this.blendingTime);
                this.stage = nextStage;
            }
        }
    }
}

/**
 * Idle state - resting animation
 */
class Idle extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Idle &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = THREE.LoopRepeat;
            this.actions[this.stage].clampWhenFinished = false;
            this.actions[this.stage].paused = false;
            this.actions[this.stage].play();
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Idle &&
            state !== TYVoiceChatState.Idle &&
            this.isPlaying === true &&
            this.stage === 0) {
            this.actions[this.stage].loop = THREE.LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * Listen state - listening animation
 */
class Listen extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Listening &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            this.actions[this.stage].play();
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = this.isGroup ? THREE.LoopOnce : THREE.LoopRepeat;
            this.actions[this.stage].clampWhenFinished = this.isGroup ? true : false;
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (this.isGroup) {
            if (AnimationManager.CurPlaying === TYVoiceChatState.Listening &&
                state === TYVoiceChatState.Listening &&
                this.isPlaying === true &&
                this.stage === 0) {
                if (this.actions[this.stage].time >
                    this.actions[this.stage].getClip().duration - this.blendingTime) {
                    this.actions[this.stage + 1].time = 0;
                    AnimationManager.SetWeight(this.actions[this.stage + 1], 1.0);
                    this.actions[this.stage + 1].loop = THREE.LoopRepeat;
                    this.actions[this.stage + 1].play();
                    AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[this.stage + 1], this.blendingTime);
                    this.stage = 1;
                }
            }

            if (AnimationManager.CurPlaying === TYVoiceChatState.Listening &&
                state !== TYVoiceChatState.Listening &&
                this.isPlaying === true &&
                (this.stage === 0 || this.stage === 1)) {
                this.actions[2].time = 0;
                this.actions[2].play();
                AnimationManager.SetWeight(this.actions[2], 1.0);
                this.actions[2].loop = THREE.LoopOnce;
                AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[2], this.blendingTime);
                this.stage = 2;
            }
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Listening &&
            state !== TYVoiceChatState.Listening &&
            this.isPlaying === true &&
            this.stage === (this.isGroup ? this.actions.length - 1 : 0)) {
            this.actions[this.stage].loop = THREE.LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * Think state - thinking animation
 */
class Think extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) return;
        
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Thinking &&
            this.isPlaying === false) {
            this.stage = 0;
            this.actions[this.stage].time = 0;
            this.actions[this.stage].play();
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = THREE.LoopOnce;
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        if (this.isGroup) {
            if (AnimationManager.CurPlaying === TYVoiceChatState.Thinking &&
                state === TYVoiceChatState.Thinking &&
                this.isPlaying === true &&
                this.stage === 0) {
                if (this.actions[this.stage].time >
                    this.actions[this.stage].getClip().duration - this.blendingTime) {
                    this.actions[this.stage + 1].time = 0;
                    AnimationManager.SetWeight(this.actions[this.stage + 1], 1.0);
                    this.actions[this.stage + 1].loop = THREE.LoopRepeat;
                    this.actions[this.stage + 1].play();
                    AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[this.stage + 1], this.blendingTime);
                    this.stage = 1;
                }
            }

            if (AnimationManager.CurPlaying === TYVoiceChatState.Thinking &&
                state !== TYVoiceChatState.Thinking &&
                this.isPlaying === true &&
                (this.stage === 0 || this.stage === 1)) {
                this.actions[2].time = 0;
                this.actions[2].play();
                AnimationManager.SetWeight(this.actions[2], 1.0);
                this.actions[2].loop = THREE.LoopOnce;
                AnimationManager.PrepareCrossFade(this.actions[this.stage], this.actions[2], this.blendingTime);
                this.stage = 2;
            }
        }

        if (AnimationManager.CurPlaying === TYVoiceChatState.Thinking &&
            state !== TYVoiceChatState.Thinking &&
            this.isPlaying === true &&
            this.stage === (this.isGroup ? this.actions.length - 1 : 0)) {
            this.actions[this.stage].loop = THREE.LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * Speak state - speaking animation with random movement selection
 */
class Speak extends State {
    constructor(actions, isGroup) {
        super(actions, isGroup);
        console.log('[SPEAK] Initialized with', actions?.length || 0, 'actions, isGroup:', isGroup);
    }

    /**
     * Get a random number in range [min, max]
     */
    getRandomNumber(max, min) {
        const range = max - min;
        return min + Math.round(Math.random() * range);
    }

    update(state) {
        // Safety check: return early if no actions available
        if (!this.actions || this.actions.length === 0) {
            if (!this._warnedNoActions) {
                console.warn('[SPEAK] No actions available!');
                this._warnedNoActions = true;
            }
            return;
        }
        
        // Start speaking - pick a random animation
        if (AnimationManager.CurPlaying === undefined &&
            state === TYVoiceChatState.Responding &&
            this.isPlaying === false) {
            // Randomly select initial animation
            this.stage = Math.ceil(this.getRandomNumber(0, this.actions.length - 1));
            console.log('[SPEAK] Starting animation, stage:', this.stage, 'of', this.actions.length);
            this.actions[this.stage].time = 0;
            this.actions[this.stage].play();
            AnimationManager.SetWeight(this.actions[this.stage], 1.0);
            this.actions[this.stage].loop = THREE.LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            if (AnimationManager.LastAction !== undefined) {
                AnimationManager.PrepareCrossFade(AnimationManager.LastAction, this.actions[this.stage], this.blendingTime);
            }
            this.isPlaying = true;
        }

        // Continue speaking - cycle through random animations
        if (AnimationManager.CurPlaying === TYVoiceChatState.Responding &&
            state === TYVoiceChatState.Responding &&
            this.isPlaying === true) {
            if (this.actions[this.stage].time >=
                this.actions[this.stage].getClip().duration - this.blendingTime) {
                const lastAction = this.actions[this.stage];
                // Pick a different random animation
                this.stage = (this.stage + Math.ceil(this.getRandomNumber(1, this.actions.length - 1))) % this.actions.length;
                console.log('[SPEAK] Cycling to next animation, stage:', this.stage);
                this.actions[this.stage].time = 0;
                this.actions[this.stage].play();
                AnimationManager.SetWeight(this.actions[this.stage], 1.0);
                this.actions[this.stage].loop = THREE.LoopOnce;
                this.actions[this.stage].clampWhenFinished = true;
                AnimationManager.PrepareCrossFade(lastAction, this.actions[this.stage], this.blendingTime);
            }
        }

        // Stop speaking - finish current animation
        if (AnimationManager.CurPlaying === TYVoiceChatState.Responding &&
            state !== TYVoiceChatState.Responding &&
            this.isPlaying === true) {
            this.actions[this.stage].loop = THREE.LoopOnce;
            this.actions[this.stage].clampWhenFinished = true;
            this.isPlaying = false;
            AnimationManager.LastAction = this.actions[this.stage];
        }
    }
}

/**
 * AnimationManager - Main animation controller
 * Manages state machine with crossfade transitions between animation states
 */
class AnimationManager {
    // Static properties
    static IsBlending = false;
    static actions = [];
    static NeedReset = false;
    static NeedFullReset = false;
    static LastAction = undefined;
    static CurPlaying = undefined;

    /**
     * Set animation action weight
     */
    static SetWeight(action, weight) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }

    /**
     * Prepare crossfade between two actions
     */
    static PrepareCrossFade(startAction, endAction, defaultDuration) {
        const duration = defaultDuration;
        AnimationManager.UnPauseAllActions();
        AnimationManager.ExecuteCrossFade(startAction, endAction, duration);
        AnimationManager.IsBlending = true;
        setTimeout(() => {
            AnimationManager.IsBlending = false;
        }, defaultDuration + 0.1);
    }

    /**
     * Pause all animation actions
     */
    static PauseAllActions() {
        AnimationManager.actions.forEach(function(action) {
            action.paused = true;
        });
    }

    /**
     * Unpause all animation actions
     */
    static UnPauseAllActions() {
        AnimationManager.actions.forEach(function(action) {
            action.paused = false;
        });
    }

    /**
     * Execute crossfade between two actions
     */
    static ExecuteCrossFade(startAction, endAction, duration) {
        AnimationManager.SetWeight(endAction, 1);
        endAction.time = 0;
        startAction.crossFadeTo(endAction, duration, true);
    }

    /**
     * Constructor
     * @param {THREE.AnimationMixer} mixer - Three.js animation mixer
     * @param {THREE.AnimationClip[]} animations - Animation clips
     * @param {object} animationcfg - Animation configuration
     */
    constructor(mixer, animations, animationcfg) {
        const helloActions = [];
        const idleActions = [];
        const listenActions = [];
        const speakActions = [];
        const thinkActions = [];

        this.mixer = mixer;

        // Calculate action indices based on config
        const helloIdx = animationcfg?.hello?.size || 0;
        const idleIdx = (animationcfg?.idle?.size || 0) + helloIdx;
        const listenIdx = (animationcfg?.listen?.size || 0) + idleIdx;
        const speakIdx = (animationcfg?.speak?.size || 0) + listenIdx;
        const thinkIdx = (animationcfg?.think?.size || 0) + speakIdx;

        // Distribute animation clips to state action arrays
        if (animations && animations.length > 0) {
            for (let i = 0; i < animations.length; i++) {
                const clip = animations[i];
                const action = mixer.clipAction(clip);

                if (i < helloIdx) {
                    helloActions.push(action);
                } else if (i < idleIdx) {
                    idleActions.push(action);
                    // Duplicate for states that share idle
                    if (listenIdx === idleIdx) {
                        listenActions.push(mixer.clipAction(clip.clone()));
                    }
                    if (speakIdx === listenIdx) {
                        speakActions.push(mixer.clipAction(clip.clone()));
                    }
                    if (thinkIdx === speakIdx) {
                        thinkActions.push(mixer.clipAction(clip.clone()));
                    }
                } else if (i < listenIdx) {
                    listenActions.push(action);
                } else if (i < speakIdx) {
                    speakActions.push(action);
                } else if (i < thinkIdx) {
                    thinkActions.push(action);
                }

                AnimationManager.actions.push(action);
                AnimationManager.SetWeight(action, 0);
            }
        }

        // Create state instances
        this.hello = new Hello(helloActions, animationcfg?.hello?.isGroup || false);
        this.idle = new Idle(idleActions, animationcfg?.idle?.isGroup || false);
        this.listen = new Listen(listenActions, animationcfg?.listen?.isGroup || false);
        this.think = new Think(thinkActions, animationcfg?.think?.isGroup || false);
        this.speak = new Speak(speakActions, animationcfg?.speak?.isGroup || false);
    }

    /**
     * Get currently playing state
     */
    curPlaying() {
        if (this.hello.isPlaying) return TYVoiceChatState.Idle;
        if (this.idle.isPlaying) return TYVoiceChatState.Idle;
        if (this.listen.isPlaying) return TYVoiceChatState.Listening;
        if (this.think.isPlaying) return TYVoiceChatState.Thinking;
        if (this.speak.isPlaying) return TYVoiceChatState.Responding;
        return undefined;
    }

    /**
     * Dispose animation manager
     */
    dispose() {
        this.hello.dispose();
        this.idle.dispose();
        this.listen.dispose();
        this.think.dispose();
        this.speak.dispose();
        AnimationManager.actions = [];
    }

    /**
     * Reset all animation actions
     */
    resetAllActions(ignoreBlending = false) {
        const curPlaying = this.curPlaying();
        
        switch (curPlaying) {
            case TYVoiceChatState.Idle:
                AnimationManager.LastAction = this.hello.actions[this.hello.stage];
                break;
            case TYVoiceChatState.Listening:
                AnimationManager.LastAction = this.listen.actions[this.listen.stage];
                break;
            case TYVoiceChatState.Thinking:
                AnimationManager.LastAction = this.think.actions[this.think.stage];
                break;
            case TYVoiceChatState.Responding:
                AnimationManager.LastAction = this.speak.actions[this.speak.stage];
                break;
            default:
                AnimationManager.LastAction = undefined;
                break;
        }

        if (AnimationManager.LastAction) {
            AnimationManager.LastAction.loop = THREE.LoopOnce;
            AnimationManager.LastAction.clampWhenFinished = true;
            AnimationManager.SetWeight(AnimationManager.LastAction, 1.0);
        }

        if (ignoreBlending) {
            AnimationManager.PauseAllActions();
            AnimationManager.actions.forEach(function(action) {
                action.time = 0;
                AnimationManager.SetWeight(action, 0.0);
            });
            AnimationManager.LastAction = undefined;
        }

        this.hello.isPlaying = false;
        this.idle.isPlaying = false;
        this.listen.isPlaying = false;
        this.think.isPlaying = false;
        this.speak.isPlaying = false;
    }

    /**
     * Update animation state
     * @param {string} state - Target state (TYVoiceChatState)
     */
    update(state) {
        if (AnimationManager.IsBlending) return;

        AnimationManager.CurPlaying = this.curPlaying();

        if (AnimationManager.CurPlaying === undefined) {
            switch (state) {
                case TYVoiceChatState.Idle:
                    this.idle.update(state);
                    break;
                case TYVoiceChatState.Listening:
                    this.listen.update(state);
                    break;
                case TYVoiceChatState.Thinking:
                    this.think.update(state);
                    break;
                case TYVoiceChatState.Responding:
                    this.speak.update(state);
                    break;
                default:
                    this.idle.update(state);
                    break;
            }
        } else {
            switch (AnimationManager.CurPlaying) {
                case TYVoiceChatState.Idle:
                    this.idle.update(state);
                    break;
                case TYVoiceChatState.Listening:
                    this.listen.update(state);
                    break;
                case TYVoiceChatState.Thinking:
                    this.think.update(state);
                    break;
                case TYVoiceChatState.Responding:
                    this.speak.update(state);
                    break;
                default:
                    this.idle.update(state);
                    break;
            }
        }
    }
}

/**
 * SplatScene
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 */


class SplatScene extends THREE.Object3D {

    constructor(splatBuffer, position = new THREE.Vector3(), quaternion = new THREE.Quaternion(),
                scale = new THREE.Vector3(1, 1, 1), minimumAlpha = 1, opacity = 1.0, visible = true) {
        super();
        this.splatBuffer = splatBuffer;
        this.position.copy(position);
        this.quaternion.copy(quaternion);
        this.scale.copy(scale);
        this.transform = new THREE.Matrix4();
        this.minimumAlpha = minimumAlpha;
        this.opacity = opacity;
        this.visible = visible;
    }

    copyTransformData(otherScene) {
        this.position.copy(otherScene.position);
        this.quaternion.copy(otherScene.quaternion);
        this.scale.copy(otherScene.scale);
        this.transform.copy(otherScene.transform);
    }

    updateTransform(dynamicMode) {
        if (dynamicMode) {
            if (this.matrixWorldAutoUpdate) this.updateWorldMatrix(true, false);
            this.transform.copy(this.matrixWorld);
        } else {
            if (this.matrixAutoUpdate) this.updateMatrix();
            this.transform.copy(this.matrix);
        }
    }
}

/**
 * SplatGeometry
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 */


class SplatGeometry {

    /**
     * Build the Three.js geometry that will be used to render the splats. The geometry is instanced and is made up of
     * vertices for a single quad as well as an attribute buffer for the splat indexes.
     * @param {number} maxSplatCount The maximum number of splats that the geometry will need to accomodate
     * @return {THREE.InstancedBufferGeometry}
     */
    static build(maxSplatCount) {

        const baseGeometry = new THREE.BufferGeometry();
        baseGeometry.setIndex([0, 1, 2, 0, 2, 3]);

        // Vertices for the instanced quad
        const positionsArray = new Float32Array(4 * 3);
        const positions = new THREE.BufferAttribute(positionsArray, 3);
        baseGeometry.setAttribute('position', positions);
        positions.setXYZ(0, -1, -1, 0.0);
        positions.setXYZ(1, -1, 1.0, 0.0);
        positions.setXYZ(2, 1.0, 1.0, 0.0);
        positions.setXYZ(3, 1.0, -1, 0.0);
        positions.needsUpdate = true;

        const geometry = new THREE.InstancedBufferGeometry().copy(baseGeometry);

        // Splat index buffer
        const splatIndexArray = new Uint32Array(maxSplatCount);

        const splatIndexes = new THREE.InstancedBufferAttribute(splatIndexArray, 1, false);
        splatIndexes.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('splatIndex', splatIndexes);

        geometry.instanceCount = 0;

        return geometry;
    }
}

/**
 * SplatTree
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 */


// Worker-related functions (simplified stubs - the actual worker is handled differently)
const checkAndCreateWorker = () => {
    // Worker creation is handled by the build system
    return null;
};

const workerProcessCenters = (worker, centers, buffers, maxDepth, maxCentersPerNode) => {
    // Worker message passing
    if (worker) {
        worker.postMessage({
            'process': {
                'centers': centers,
                'maxDepth': maxDepth,
                'maxCentersPerNode': maxCentersPerNode
            }
        }, buffers);
    }
};

// SplatSubTree helper class
class SplatSubTree {
    constructor() {
        this.rootNode = null;
        this.splatMesh = null;
    }

    static convertWorkerSubTree(workerSubTree, splatMesh) {
        const subTree = new SplatSubTree();
        subTree.rootNode = workerSubTree.rootNode;
        subTree.splatMesh = splatMesh;
        return subTree;
    }
}

class SplatTree {

    constructor(maxDepth, maxCentersPerNode) {
        this.maxDepth = maxDepth;
        this.maxCentersPerNode = maxCentersPerNode;
        this.subTrees = [];
        this.splatMesh = null;
    }


    dispose() {
        this.diposeSplatTreeWorker();
        this.disposed = true;
    }

    diposeSplatTreeWorker() {
        if (this.splatTreeWorker) this.splatTreeWorker.terminate();
        this.splatTreeWorker = null;
    };

    /**
     * Construct this instance of SplatTree from an instance of SplatMesh.
     *
     * @param {SplatMesh} splatMesh The instance of SplatMesh from which to construct this splat tree.
     * @param {function} filterFunc Optional function to filter out unwanted splats.
     * @param {function} onIndexesUpload Function to be called when the upload of splat centers to the splat tree
     *                                   builder worker starts and finishes.
     * @param {function} onSplatTreeConstruction Function to be called when the conversion of the local splat tree from
     *                                           the format produced by the splat tree builder worker starts and ends.
     * @return {undefined}
     */
    processSplatMesh = (splatMesh, filterFunc = () => true, onIndexesUpload, onSplatTreeConstruction) => {
        if (!this.splatTreeWorker) this.splatTreeWorker = checkAndCreateWorker();

        this.splatMesh = splatMesh;
        this.subTrees = [];
        const center = new THREE.Vector3();

        const addCentersForScene = (splatOffset, splatCount) => {
            const sceneCenters = new Float32Array(splatCount * 4);
            let addedCount = 0;
            for (let i = 0; i < splatCount; i++) {
                const globalSplatIndex = i + splatOffset;
                if (filterFunc(globalSplatIndex)) {
                    splatMesh.getSplatCenter(globalSplatIndex, center);
                    const addBase = addedCount * 4;
                    sceneCenters[addBase] = center.x;
                    sceneCenters[addBase + 1] = center.y;
                    sceneCenters[addBase + 2] = center.z;
                    sceneCenters[addBase + 3] = globalSplatIndex;
                    addedCount++;
                }
            }
            return sceneCenters;
        };

        return new Promise((resolve) => {

            const checkForEarlyExit = () => {
                if (this.disposed) {
                    this.diposeSplatTreeWorker();
                    resolve();
                    return true;
                }
                return false;
            };

            if (onIndexesUpload) onIndexesUpload(false);

            delayedExecute(() => {

                if (checkForEarlyExit()) return;

                const allCenters = [];
                if (splatMesh.dynamicMode) {
                    let splatOffset = 0;
                    for (let s = 0; s < splatMesh.scenes.length; s++) {
                        const scene = splatMesh.getScene(s);
                        const splatCount = scene.splatBuffer.getSplatCount();
                        const sceneCenters = addCentersForScene(splatOffset, splatCount);
                        allCenters.push(sceneCenters);
                        splatOffset += splatCount;
                    }
                } else {
                    const sceneCenters = addCentersForScene(0, splatMesh.getSplatCount());
                    allCenters.push(sceneCenters);
                }

                this.splatTreeWorker.onmessage = (e) => {

                    if (checkForEarlyExit()) return;

                    if (e.data.subTrees) {

                        if (onSplatTreeConstruction) onSplatTreeConstruction(false);

                        delayedExecute(() => {

                            if (checkForEarlyExit()) return;

                            for (let workerSubTree of e.data.subTrees) {
                                const convertedSubTree = SplatSubTree.convertWorkerSubTree(workerSubTree, splatMesh);
                                this.subTrees.push(convertedSubTree);
                            }
                            this.diposeSplatTreeWorker();

                            if (onSplatTreeConstruction) onSplatTreeConstruction(true);

                            delayedExecute(() => {
                                resolve();
                            });

                        });
                    }
                };

                delayedExecute(() => {
                    if (checkForEarlyExit()) return;
                    if (onIndexesUpload) onIndexesUpload(true);
                    const transferBuffers = allCenters.map((array) => array.buffer);
                    workerProcessCenters(this.splatTreeWorker, allCenters, transferBuffers, this.maxDepth, this.maxCentersPerNode);
                });

            });

        });

    };

    countLeaves() {

        let leafCount = 0;
        this.visitLeaves(() => {
            leafCount++;
        });

        return leafCount;
    }

    visitLeaves(visitFunc) {

        const visitLeavesFromNode = (node, visitFunc) => {
            if (node.children.length === 0) visitFunc(node);
            for (let child of node.children) {
                visitLeavesFromNode(child, visitFunc);
            }
        };

        for (let subTree of this.subTrees) {
            visitLeavesFromNode(subTree.rootNode, visitFunc);
        }
    }

}

/**
 * SplatMaterial
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * HEAVILY MODIFIED for FLAME avatar support:
 * - Added FLAME bone/pose uniforms and textures
 * - Added expression blendshape support
 * - Extended vertex shader with GPU skinning
 * - Additional ~500 lines of FLAME-specific shader code
 */


class SplatMaterial {

    static buildVertexShaderBase(dynamicMode = false, enableOptionalEffects = false, maxSphericalHarmonicsDegree = 0, customVars = '', useFlame = true) {
        let vertexShaderSource = ``;
        if (useFlame == true) {
            vertexShaderSource += `#define USE_FLAME`;
        } else {
            vertexShaderSource += `#define USE_SKINNING`;
        }
        vertexShaderSource += `
        precision highp float;
        #include <common>

        attribute uint splatIndex;
        uniform highp usampler2D flameModelTexture;
        uniform highp usampler2D boneTexture;
        uniform highp usampler2D boneWeightTexture;


        uniform highp usampler2D centersColorsTexture;
        uniform highp sampler2D sphericalHarmonicsTexture;
        uniform highp sampler2D sphericalHarmonicsTextureR;
        uniform highp sampler2D sphericalHarmonicsTextureG;
        uniform highp sampler2D sphericalHarmonicsTextureB;

        uniform highp usampler2D sceneIndexesTexture;
        uniform vec2 sceneIndexesTextureSize;
        uniform int sceneCount;
        uniform int gaussianSplatCount;
        uniform int bsCount;
        uniform float headBoneIndex;
        #ifdef USE_SKINNING
            attribute vec4 skinIndex;
            attribute vec4 skinWeight;
        #endif
    `;

    if (enableOptionalEffects) {
        vertexShaderSource += `
            uniform float sceneOpacity[${Constants$1.MaxScenes}];
            uniform int sceneVisibility[${Constants$1.MaxScenes}];
        `;
    }

    if (dynamicMode) {
        vertexShaderSource += `
            uniform highp mat4 transforms[${Constants$1.MaxScenes}];
        `;
    }

    vertexShaderSource += `
        ${customVars}
        uniform vec2 focal;
        uniform float orthoZoom;
        uniform int orthographicMode;
        uniform int pointCloudModeEnabled;
        uniform float inverseFocalAdjustment;
        uniform vec2 viewport;
        uniform vec2 basisViewport;
        uniform vec2 centersColorsTextureSize;
        uniform vec2 flameModelTextureSize;
        uniform vec2 boneWeightTextureSize;
        uniform vec2 boneTextureSize;

        uniform int sphericalHarmonicsDegree;
        uniform vec2 sphericalHarmonicsTextureSize;
        uniform int sphericalHarmonics8BitMode;
        uniform int sphericalHarmonicsMultiTextureMode;
        uniform float visibleRegionRadius;
        uniform float visibleRegionFadeStartRadius;
        uniform float firstRenderTime;
        uniform float currentTime;
        uniform int fadeInComplete;
        uniform vec3 sceneCenter;
        uniform float splatScale;
        uniform float sphericalHarmonics8BitCompressionRangeMin[${Constants$1.MaxScenes}];
        uniform float sphericalHarmonics8BitCompressionRangeMax[${Constants$1.MaxScenes}];

        varying vec4 vColor;
        varying vec2 vUv;
        varying vec2 vPosition;
        varying vec2 vSplatIndex;
        #ifdef USE_SKINNING
            uniform mat4 bindMatrix;
            uniform mat4 bindMatrixInverse;
            uniform highp sampler2D boneTexture0;
            mat4 getBoneMatrix0( const in float i ) {
                int size = textureSize( boneTexture0, 0 ).x;
                int j = int( i ) * 4;
                int x = j % size;
                int y = j / size;
                vec4 v1 = texelFetch( boneTexture0, ivec2( x, y ), 0 );
                vec4 v2 = texelFetch( boneTexture0, ivec2( x + 1, y ), 0 );
                vec4 v3 = texelFetch( boneTexture0, ivec2( x + 2, y ), 0 );
                vec4 v4 = texelFetch( boneTexture0, ivec2( x + 3, y ), 0 );
                return mat4( v1, v2, v3, v4 );
            }
        #endif

        mat3 quaternionToRotationMatrix(float x, float y, float z, float w) {
            float s = 1.0 / sqrt(w * w + x * x + y * y + z * z);
        
            return mat3(
                1. - 2. * (y * y + z * z),
                2. * (x * y + w * z),
                2. * (x * z - w * y),
                2. * (x * y - w * z),
                1. - 2. * (x * x + z * z),
                2. * (y * z + w * x),
                2. * (x * z + w * y),
                2. * (y * z - w * x),
                1. - 2. * (x * x + y * y)
            );
        }

        const float sqrt8 = sqrt(8.0);
        const float minAlpha = 1.0 / 255.0;

        const vec4 encodeNorm4 = vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0);
        const uvec4 mask4 = uvec4(uint(0x000000FF), uint(0x0000FF00), uint(0x00FF0000), uint(0xFF000000));
        const uvec4 shift4 = uvec4(0, 8, 16, 24);
        int internal = 1;//show a gaussian splatting point every internal points.
        vec4 uintToRGBAVec (uint u) {
           uvec4 urgba = mask4 & u;
           urgba = urgba >> shift4;
           vec4 rgba = vec4(urgba) * encodeNorm4;
           return rgba;
        }
        float getRealIndex(int sIndex, int reducedFactor) {
            int remainder = sIndex % reducedFactor;

            if(remainder == int(0)) {
                return float(sIndex);
            }
            else
            {
                return float(sIndex - remainder);
            }
        }

        vec2 getDataUV(in int stride, in int offset, in vec2 dimensions) {
            vec2 samplerUV = vec2(0.0, 0.0);
            float d = float(uint(getRealIndex(int(splatIndex), internal)) * uint(stride) + uint(offset)) / dimensions.x;
            samplerUV.y = float(floor(d)) / dimensions.y;
            samplerUV.x = fract(d);
            return samplerUV;
        }

        vec2 getFlameDataUV(in int stride, in int offset, in vec2 dimensions) {
            vec2 samplerUV = vec2(0.0, 0.0);
            float d = float(uint(int(splatIndex) / internal) * uint(stride) + uint(offset) + uint(gaussianSplatCount * bsCount)) / dimensions.x;
            samplerUV.y = float(floor(d)) / dimensions.y;
            samplerUV.x = fract(d);
            return samplerUV;
        }

        vec2 getBoneWeightUV(in int stride, in int offset, in vec2 dimensions) {
            vec2 samplerUV = vec2(0.0, 0.0);
            float d = float(uint(int(splatIndex) / internal) * uint(stride) + uint(offset)) / dimensions.x;
            samplerUV.y = float(floor(d)) / dimensions.y;
            samplerUV.x = fract(d);
            return samplerUV;
        }

        vec2 getBSFlameDataUV(in int bsInedex, in int stride, in int offset, in vec2 dimensions) {
            vec2 samplerUV = vec2(0.0, 0.0);
            float d = float(uint(int(splatIndex) / internal) * uint(stride) + uint(offset) + uint(gaussianSplatCount * bsInedex)) / dimensions.x;
            samplerUV.y = float(floor(d)) / dimensions.y;
            samplerUV.x = fract(d);
            return samplerUV;
        }

        vec2 getDataUVF(in uint sIndex, in float stride, in uint offset, in vec2 dimensions) {
            vec2 samplerUV = vec2(0.0, 0.0);
            float d = float(uint(float(getRealIndex(int(sIndex), internal)) * stride) + offset) / dimensions.x;
            samplerUV.y = float(floor(d)) / dimensions.y;
            samplerUV.x = fract(d);
            return samplerUV;
        }

        const float SH_C1 = 0.4886025119029199f;
        const float[5] SH_C2 = float[](1.0925484, -1.0925484, 0.3153916, -1.0925484, 0.5462742);

        mat4 getBoneMatrix( float i ) {
            float y = i;
            float x = 0.0;

            vec2 samplerUV = vec2(0.0, 0.0);
            float d = float(i * 4.0) / boneTextureSize.x;//4
            samplerUV.y = float(floor(d)) / boneTextureSize.y;//5
            samplerUV.x = fract(d);

            vec4 v1 = uintBitsToFloat(texture( boneTexture, samplerUV ));
            vec4 v2 = uintBitsToFloat(texture( boneTexture, vec2(samplerUV.x + 1.0 / boneTextureSize.x, samplerUV.y)));
            vec4 v3 = uintBitsToFloat(texture( boneTexture, vec2(samplerUV.x + 2.0 / boneTextureSize.x, samplerUV.y) ));
            vec4 v4 = uintBitsToFloat(texture( boneTexture, vec2(samplerUV.x + 3.0 / boneTextureSize.x, samplerUV.y)));

            return mat4( v1, v2, v3, v4 );
        }

        void main () {

            uint oddOffset = splatIndex & uint(0x00000001);
            uint doubleOddOffset = oddOffset * uint(2);
            bool isEven = oddOffset == uint(0);
            uint nearestEvenIndex = splatIndex - oddOffset;
            float fOddOffset = float(oddOffset);

            uvec4 sampledCenterColor = texture(centersColorsTexture, getDataUV(1, 0, centersColorsTextureSize));
            // vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenterColor.gba));

            uvec3 sampledCenter = texture(centersColorsTexture, getDataUV(1, 0, centersColorsTextureSize)).gba;
            vec3 splatCenter = uintBitsToFloat(uvec3(sampledCenter));

            vec2 flameTextureUV = getBSFlameDataUV(bsCount, 1, 0, flameModelTextureSize);
            uvec3 sampledflamePos = texture(flameModelTexture, flameTextureUV).rgb;
            // splatCenter += uintBitsToFloat(uvec3(sampledflamePos.rgb));

            for(int i = 0; i < bsCount; ++i) {
                vec2 flameBSTextureUV = getBSFlameDataUV(i, 1, 0, flameModelTextureSize);
                uvec3 sampledBSPos = texture(flameModelTexture, flameBSTextureUV).rgb;

                vec2 samplerUV = vec2(0.0, 0.0);
                float d = float(i / 4 + 5 * 4) / boneTextureSize.x;//4
                samplerUV.y = float(floor(d)) / boneTextureSize.y;//32
                samplerUV.x = fract(d);

                vec4 bsWeight = uintBitsToFloat(texture(boneTexture, samplerUV));
                float weight = bsWeight.r;
                if(i % 4 == 1) {
                    weight = bsWeight.g;
                }
                if(i % 4 == 2) {
                    weight = bsWeight.b;
                }
                if(i % 4 == 3) {
                    weight = bsWeight.a;
                }

                splatCenter = splatCenter + weight * uintBitsToFloat(sampledBSPos);
            }


            #ifdef USE_SKINNING
                mat4 boneMatX = getBoneMatrix0( skinIndex.x );
                mat4 boneMatY = getBoneMatrix0( skinIndex.y );
                mat4 boneMatZ = getBoneMatrix0( skinIndex.z );
                mat4 boneMatW = getBoneMatrix0( skinIndex.w );
            #endif
            #ifdef USE_SKINNING
                mat4 skinMatrix = mat4( 0.0 );
                skinMatrix += skinWeight.x * boneMatX;
                skinMatrix += skinWeight.y * boneMatY;
                skinMatrix += skinWeight.z * boneMatZ;
                skinMatrix += skinWeight.w * boneMatW;
                // skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
            #endif
            vec3 transformed = vec3(splatCenter.xyz);
            #ifdef USE_SKINNING
                // vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
                vec4 skinVertex = vec4( transformed, 1.0 );

                vec4 skinned = vec4( 0.0 );
                // There is an offset between the Gaussian point and the mesh vertex,
                // which will cause defects in the skeletal animation driving the Gaussian point. 
                //In order to circumvent this problem, only the head bone(index is 110 currently) is used to drive

                if (headBoneIndex >= 0.0)
                {
                    mat4 boneMat = getBoneMatrix0( headBoneIndex );
                    skinned += boneMat * skinVertex * 1.0;
                }

                // skinned += boneMatX * skinVertex * skinWeight.x;
                // skinned += boneMatY * skinVertex * skinWeight.y;
                // skinned += boneMatZ * skinVertex * skinWeight.z;
                // skinned += boneMatW * skinVertex * skinWeight.w;

                // transformed = ( bindMatrixInverse * skinned ).xyz;
                transformed = skinned.xyz;

            #endif
            splatCenter = transformed.xyz;

            #ifdef USE_FLAME
                mat4 boneMatX = getBoneMatrix( 0.0 );
                mat4 boneMatY = getBoneMatrix( 1.0 );
                mat4 boneMatZ = getBoneMatrix( 2.0 );
                mat4 boneMatW = getBoneMatrix( 3.0 );   
                mat4 boneMat0 = getBoneMatrix( 4.0 );   
                
                vec2 boneWeightUV0 = getBoneWeightUV(2, 0, boneWeightTextureSize);
                vec2 boneWeightUV1 = getBoneWeightUV(2, 1, boneWeightTextureSize);

                uvec4 sampledBoneMatrixValue = texture(boneWeightTexture, boneWeightUV0);
                uvec4 sampledBoneMatrixValue0 = texture(boneWeightTexture, boneWeightUV1);

                vec4 boneMatrixValue = uintBitsToFloat(sampledBoneMatrixValue);
                vec4 boneMatrixValue0 = uintBitsToFloat(sampledBoneMatrixValue0);

                vec4 skinVertex = vec4( splatCenter, 1.0 );
                vec4 skinned = vec4( 0.0 );
                float minWeight = min(boneMatrixValue.x,min(boneMatrixValue.y, min(boneMatrixValue.z, min(boneMatrixValue.w, boneMatrixValue0.x))));
                
                if(boneMatrixValue.x > 0.0 && boneMatrixValue.x > minWeight)
                    skinned += boneMatX * skinVertex * boneMatrixValue.x;
                
                if(boneMatrixValue.y > 0.0 && boneMatrixValue.y > minWeight)
                    skinned += boneMatY * skinVertex * boneMatrixValue.y;
                
                if(boneMatrixValue.z > 0.0 && boneMatrixValue.z > minWeight)
                    skinned += boneMatZ * skinVertex * boneMatrixValue.z;
                
                if(boneMatrixValue.w > 0.0 && boneMatrixValue.w > minWeight)
                    skinned += boneMatW * skinVertex * boneMatrixValue.w;
                
                if(boneMatrixValue0.x > 0.0 && boneMatrixValue0.x > minWeight)
                    skinned += boneMat0 * skinVertex * boneMatrixValue0.x;
                
                splatCenter = skinned.xyz;
            #endif

            uint sceneIndex = uint(0);
            if (sceneCount > 1) {
                sceneIndex = texture(sceneIndexesTexture, getDataUV(1, 0, sceneIndexesTextureSize)).r;
            }
            `;

        if (enableOptionalEffects) {
            vertexShaderSource += `
                float splatOpacityFromScene = sceneOpacity[sceneIndex];
                int sceneVisible = sceneVisibility[sceneIndex];
                if (splatOpacityFromScene <= 0.01 || sceneVisible == 0) {
                    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                    return;
                }
            `;
        }

        if (dynamicMode) {
            vertexShaderSource += `
                mat4 transform = transforms[sceneIndex];
                mat4 transformModelViewMatrix = viewMatrix * transform;
                #ifdef USE_SKINNING
                    transformModelViewMatrix = transformModelViewMatrix * skinMatrix;
                #endif
            `;
        } else {
            vertexShaderSource += `mat4 transformModelViewMatrix = modelViewMatrix;`;
        }

        vertexShaderSource += `
            float sh8BitCompressionRangeMinForScene = sphericalHarmonics8BitCompressionRangeMin[sceneIndex];
            float sh8BitCompressionRangeMaxForScene = sphericalHarmonics8BitCompressionRangeMax[sceneIndex];
            float sh8BitCompressionRangeForScene = sh8BitCompressionRangeMaxForScene - sh8BitCompressionRangeMinForScene;
            float sh8BitCompressionHalfRangeForScene = sh8BitCompressionRangeForScene / 2.0;
            vec3 vec8BitSHShift = vec3(sh8BitCompressionRangeMinForScene);

            vec4 viewCenter = transformModelViewMatrix * vec4(splatCenter, 1.0);

            vec4 clipCenter = projectionMatrix * viewCenter;

            float clip = 1.2 * clipCenter.w;
            if (clipCenter.z < -clip || clipCenter.x < -clip || clipCenter.x > clip || clipCenter.y < -clip || clipCenter.y > clip) {
                gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
                return;
            }

            vec3 ndcCenter = clipCenter.xyz / clipCenter.w;

            vPosition = position.xy;
            vSplatIndex = vec2(splatIndex, splatIndex);

            vColor = uintToRGBAVec(sampledCenterColor.r);
        `;

        // Proceed to sampling and rendering 1st degree spherical harmonics
        if (maxSphericalHarmonicsDegree >= 1) {

            vertexShaderSource += `   
            if (sphericalHarmonicsDegree >= 1) {
            `;

            if (dynamicMode) {
                vertexShaderSource += `
                    vec3 worldViewDir = normalize(splatCenter - vec3(inverse(transform) * vec4(cameraPosition, 1.0)));
                `;
            } else {
                vertexShaderSource += `
                    vec3 worldViewDir = normalize(splatCenter - cameraPosition);
                `;
            }

            vertexShaderSource += `
                vec3 sh1;
                vec3 sh2;
                vec3 sh3;
            `;

            if (maxSphericalHarmonicsDegree >= 2) {
                vertexShaderSource += `
                    vec3 sh4;
                    vec3 sh5;
                    vec3 sh6;
                    vec3 sh7;
                    vec3 sh8;
                `;
            }

            // Determining how to sample spherical harmonics textures to get the coefficients for calculations for a given degree
            // depends on how many total degrees (maxSphericalHarmonicsDegree) are present in the textures. This is because that
            // number affects how they are packed in the textures, and therefore the offset & stride required to access them.

            // Sample spherical harmonics textures with 1 degree worth of data for 1st degree calculations, and store in sh1, sh2, and sh3
            if (maxSphericalHarmonicsDegree === 1) {
                vertexShaderSource += `
                    if (sphericalHarmonicsMultiTextureMode == 0) {
                        vec2 shUV = getDataUVF(nearestEvenIndex, 2.5, doubleOddOffset, sphericalHarmonicsTextureSize);
                        vec4 sampledSH0123 = texture(sphericalHarmonicsTexture, shUV);
                        shUV = getDataUVF(nearestEvenIndex, 2.5, doubleOddOffset + uint(1), sphericalHarmonicsTextureSize);
                        vec4 sampledSH4567 = texture(sphericalHarmonicsTexture, shUV);
                        shUV = getDataUVF(nearestEvenIndex, 2.5, doubleOddOffset + uint(2), sphericalHarmonicsTextureSize);
                        vec4 sampledSH891011 = texture(sphericalHarmonicsTexture, shUV);
                        sh1 = vec3(sampledSH0123.rgb) * (1.0 - fOddOffset) + vec3(sampledSH0123.ba, sampledSH4567.r) * fOddOffset;
                        sh2 = vec3(sampledSH0123.a, sampledSH4567.rg) * (1.0 - fOddOffset) + vec3(sampledSH4567.gba) * fOddOffset;
                        sh3 = vec3(sampledSH4567.ba, sampledSH891011.r) * (1.0 - fOddOffset) + vec3(sampledSH891011.rgb) * fOddOffset;
                    } else {
                        vec2 sampledSH01R = texture(sphericalHarmonicsTextureR, getDataUV(2, 0, sphericalHarmonicsTextureSize)).rg;
                        vec2 sampledSH23R = texture(sphericalHarmonicsTextureR, getDataUV(2, 1, sphericalHarmonicsTextureSize)).rg;
                        vec2 sampledSH01G = texture(sphericalHarmonicsTextureG, getDataUV(2, 0, sphericalHarmonicsTextureSize)).rg;
                        vec2 sampledSH23G = texture(sphericalHarmonicsTextureG, getDataUV(2, 1, sphericalHarmonicsTextureSize)).rg;
                        vec2 sampledSH01B = texture(sphericalHarmonicsTextureB, getDataUV(2, 0, sphericalHarmonicsTextureSize)).rg;
                        vec2 sampledSH23B = texture(sphericalHarmonicsTextureB, getDataUV(2, 1, sphericalHarmonicsTextureSize)).rg;
                        sh1 = vec3(sampledSH01R.rg, sampledSH23R.r);
                        sh2 = vec3(sampledSH01G.rg, sampledSH23G.r);
                        sh3 = vec3(sampledSH01B.rg, sampledSH23B.r);
                    }
                `;
            // Sample spherical harmonics textures with 2 degrees worth of data for 1st degree calculations, and store in sh1, sh2, and sh3
            } else if (maxSphericalHarmonicsDegree === 2) {
                vertexShaderSource += `
                    vec4 sampledSH0123;
                    vec4 sampledSH4567;
                    vec4 sampledSH891011;

                    vec4 sampledSH0123R;
                    vec4 sampledSH0123G;
                    vec4 sampledSH0123B;

                    if (sphericalHarmonicsMultiTextureMode == 0) {
                        sampledSH0123 = texture(sphericalHarmonicsTexture, getDataUV(6, 0, sphericalHarmonicsTextureSize));
                        sampledSH4567 = texture(sphericalHarmonicsTexture, getDataUV(6, 1, sphericalHarmonicsTextureSize));
                        sampledSH891011 = texture(sphericalHarmonicsTexture, getDataUV(6, 2, sphericalHarmonicsTextureSize));
                        sh1 = sampledSH0123.rgb;
                        sh2 = vec3(sampledSH0123.a, sampledSH4567.rg);
                        sh3 = vec3(sampledSH4567.ba, sampledSH891011.r);
                    } else {
                        sampledSH0123R = texture(sphericalHarmonicsTextureR, getDataUV(2, 0, sphericalHarmonicsTextureSize));
                        sampledSH0123G = texture(sphericalHarmonicsTextureG, getDataUV(2, 0, sphericalHarmonicsTextureSize));
                        sampledSH0123B = texture(sphericalHarmonicsTextureB, getDataUV(2, 0, sphericalHarmonicsTextureSize));
                        sh1 = vec3(sampledSH0123R.rgb);
                        sh2 = vec3(sampledSH0123G.rgb);
                        sh3 = vec3(sampledSH0123B.rgb);
                    }
                `;
            }

            // Perform 1st degree spherical harmonics calculations
            vertexShaderSource += `
                    if (sphericalHarmonics8BitMode == 1) {
                        sh1 = sh1 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                        sh2 = sh2 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                        sh3 = sh3 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                    }
                    float x = worldViewDir.x;
                    float y = worldViewDir.y;
                    float z = worldViewDir.z;
                    vColor.rgb += SH_C1 * (-sh1 * y + sh2 * z - sh3 * x);
            `;

            // Proceed to sampling and rendering 2nd degree spherical harmonics
            if (maxSphericalHarmonicsDegree >= 2) {

                vertexShaderSource += `
                    if (sphericalHarmonicsDegree >= 2) {
                        float xx = x * x;
                        float yy = y * y;
                        float zz = z * z;
                        float xy = x * y;
                        float yz = y * z;
                        float xz = x * z;
                `;

                // Sample spherical harmonics textures with 2 degrees worth of data for 2nd degree calculations,
                // and store in sh4, sh5, sh6, sh7, and sh8
                if (maxSphericalHarmonicsDegree === 2) {
                    vertexShaderSource += `
                        if (sphericalHarmonicsMultiTextureMode == 0) {
                            vec4 sampledSH12131415 = texture(sphericalHarmonicsTexture, getDataUV(6, 3, sphericalHarmonicsTextureSize));
                            vec4 sampledSH16171819 = texture(sphericalHarmonicsTexture, getDataUV(6, 4, sphericalHarmonicsTextureSize));
                            vec4 sampledSH20212223 = texture(sphericalHarmonicsTexture, getDataUV(6, 5, sphericalHarmonicsTextureSize));
                            sh4 = sampledSH891011.gba;
                            sh5 = sampledSH12131415.rgb;
                            sh6 = vec3(sampledSH12131415.a, sampledSH16171819.rg);
                            sh7 = vec3(sampledSH16171819.ba, sampledSH20212223.r);
                            sh8 = sampledSH20212223.gba;
                        } else {
                            vec4 sampledSH4567R = texture(sphericalHarmonicsTextureR, getDataUV(2, 1, sphericalHarmonicsTextureSize));
                            vec4 sampledSH4567G = texture(sphericalHarmonicsTextureG, getDataUV(2, 1, sphericalHarmonicsTextureSize));
                            vec4 sampledSH4567B = texture(sphericalHarmonicsTextureB, getDataUV(2, 1, sphericalHarmonicsTextureSize));
                            sh4 = vec3(sampledSH0123R.a, sampledSH4567R.rg);
                            sh5 = vec3(sampledSH4567R.ba, sampledSH0123G.a);
                            sh6 = vec3(sampledSH4567G.rgb);
                            sh7 = vec3(sampledSH4567G.a, sampledSH0123B.a, sampledSH4567B.r);
                            sh8 = vec3(sampledSH4567B.gba);
                        }
                    `;
                }

                // Perform 2nd degree spherical harmonics calculations
                vertexShaderSource += `
                        if (sphericalHarmonics8BitMode == 1) {
                            sh4 = sh4 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                            sh5 = sh5 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                            sh6 = sh6 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                            sh7 = sh7 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                            sh8 = sh8 * sh8BitCompressionRangeForScene + vec8BitSHShift;
                        }

                        vColor.rgb +=
                            (SH_C2[0] * xy) * sh4 +
                            (SH_C2[1] * yz) * sh5 +
                            (SH_C2[2] * (2.0 * zz - xx - yy)) * sh6 +
                            (SH_C2[3] * xz) * sh7 +
                            (SH_C2[4] * (xx - yy)) * sh8;
                    }
                `;
            }

            vertexShaderSource += `

                vColor.rgb = clamp(vColor.rgb, vec3(0.), vec3(1.));

            }

            `;
        }

        return vertexShaderSource;
    }

    static getVertexShaderFadeIn() {
        return `
            if (fadeInComplete == 0) {
                float opacityAdjust = 1.0;
                float centerDist = length(splatCenter - sceneCenter);
                float renderTime = max(currentTime - firstRenderTime, 0.0);

                float fadeDistance = 0.75;
                float distanceLoadFadeInFactor = step(visibleRegionFadeStartRadius, centerDist);
                distanceLoadFadeInFactor = (1.0 - distanceLoadFadeInFactor) +
                                        (1.0 - clamp((centerDist - visibleRegionFadeStartRadius) / fadeDistance, 0.0, 1.0)) *
                                        distanceLoadFadeInFactor;
                opacityAdjust *= distanceLoadFadeInFactor;
                vColor.a *= opacityAdjust;
            }
        `;
    }

    static getUniforms(dynamicMode = false, enableOptionalEffects = false, maxSphericalHarmonicsDegree = 0,
                       splatScale = 1.0, pointCloudModeEnabled = false) {

        const uniforms = {
            'sceneCenter': {
                'type': 'v3',
                'value': new THREE.Vector3()
            },
            'fadeInComplete': {
                'type': 'i',
                'value': 0
            },
            'orthographicMode': {
                'type': 'i',
                'value': 0
            },
            'visibleRegionFadeStartRadius': {
                'type': 'f',
                'value': 0.0
            },
            'visibleRegionRadius': {
                'type': 'f',
                'value': 0.0
            },
            'bindMatrix': {
                'type': 'm4',
                'value': new THREE.Matrix4()
            },
            'bindMatrixInverse': {
                'type': 'm4',
                'value': new THREE.Matrix4()
            },
            'currentTime': {
                'type': 'f',
                'value': 0.0
            },
            'firstRenderTime': {
                'type': 'f',
                'value': 0.0
            },
            'centersColorsTexture': {
                'type': 't',
                'value': null
            },
            'flameModelTexture': {
                'type': 't',
                'value': null
            },
            'boneTexture': {
                'type': 't',
                'value': null
            },
            'boneTexture0': {
                'type': 't',
                'value': null
            },
            'boneWeightTexture': {
                'type': 't',
                'value': null
            },
            'sphericalHarmonicsTexture': {
                'type': 't',
                'value': null
            },
            'sphericalHarmonicsTextureR': {
                'type': 't',
                'value': null
            },
            'sphericalHarmonicsTextureG': {
                'type': 't',
                'value': null
            },
            'sphericalHarmonicsTextureB': {
                'type': 't',
                'value': null
            },
            'sphericalHarmonics8BitCompressionRangeMin': {
                'type': 'f',
                'value': []
            },
            'sphericalHarmonics8BitCompressionRangeMax': {
                'type': 'f',
                'value': []
            },
            'focal': {
                'type': 'v2',
                'value': new THREE.Vector2()
            },
            'orthoZoom': {
                'type': 'f',
                'value': 1.0
            },
            'inverseFocalAdjustment': {
                'type': 'f',
                'value': 1.0
            },
            'viewport': {
                'type': 'v2',
                'value': new THREE.Vector2()
            },
            'basisViewport': {
                'type': 'v2',
                'value': new THREE.Vector2()
            },
            'debugColor': {
                'type': 'v3',
                'value': new THREE.Color()
            },
            'centersColorsTextureSize': {
                'type': 'v2',
                'value': new THREE.Vector2(1024, 1024)
            },
            'flameModelTextureSize': {
                'type': 'v2',
                'value': new THREE.Vector2(4096, 2048)
            },
            'boneTextureSize': {
                'type': 'v2',
                'value': new THREE.Vector2(4, 32)
            },
            'boneWeightTextureSize': {
                'type': 'v2',
                'value': new THREE.Vector2(512, 512)
            },
            
            'sphericalHarmonicsDegree': {
                'type': 'i',
                'value': maxSphericalHarmonicsDegree
            },
            'sphericalHarmonicsTextureSize': {
                'type': 'v2',
                'value': new THREE.Vector2(1024, 1024)
            },
            'sphericalHarmonics8BitMode': {
                'type': 'i',
                'value': 0
            },
            'sphericalHarmonicsMultiTextureMode': {
                'type': 'i',
                'value': 0
            },
            'splatScale': {
                'type': 'f',
                'value': splatScale
            },
            'pointCloudModeEnabled': {
                'type': 'i',
                'value': pointCloudModeEnabled ? 1 : 0
            },
            'sceneIndexesTexture': {
                'type': 't',
                'value': null
            },
            'sceneIndexesTextureSize': {
                'type': 'v2',
                'value': new THREE.Vector2(1024, 1024)
            },
            'sceneCount': {
                'type': 'i',
                'value': 1
            },
            'gaussianSplatCount': {
                'type': 'i',
                'value': 1
            },
            'bsCount': {
                'type': 'i',
                'value': 1
            },
            'headBoneIndex': {
                'type': 'f',
                'value': -1
            }
        };
        for (let i = 0; i < Constants$1.MaxScenes; i++) {
            uniforms.sphericalHarmonics8BitCompressionRangeMin.value.push(-Constants$1.SphericalHarmonics8BitCompressionRange / 2.0);
            uniforms.sphericalHarmonics8BitCompressionRangeMax.value.push(Constants$1.SphericalHarmonics8BitCompressionRange / 2.0);
        }

        if (enableOptionalEffects) {
            const sceneOpacity = [];
            for (let i = 0; i < Constants$1.MaxScenes; i++) {
                sceneOpacity.push(1.0);
            }
            uniforms['sceneOpacity'] ={
                'type': 'f',
                'value': sceneOpacity
            };

            const sceneVisibility = [];
            for (let i = 0; i < Constants$1.MaxScenes; i++) {
                sceneVisibility.push(1);
            }
            uniforms['sceneVisibility'] ={
                'type': 'i',
                'value': sceneVisibility
            };
        }

        if (dynamicMode) {
            const transformMatrices = [];
            for (let i = 0; i < Constants$1.MaxScenes; i++) {
                transformMatrices.push(new THREE.Matrix4());
            }
            uniforms['transforms'] = {
                'type': 'mat4',
                'value': transformMatrices
            };
        }

        return uniforms;
    }

}

/**
 * SplatMaterial3D
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Modified for FLAME avatar support:
 * - Extended vertex shader for FLAME integration
 */


class SplatMaterial3D {

    /**
     * Build the Three.js material that is used to render the splats.
     * @param {number} dynamicMode If true, it means the scene geometry represented by this splat mesh is not stationary or
     *                             that the splat count might change
     * @param {boolean} enableOptionalEffects When true, allows for usage of extra properties and attributes in the shader for effects
     *                                        such as opacity adjustment. Default is false for performance reasons.
     * @param {boolean} antialiased If true, calculate compensation factor to deal with gaussians being rendered at a significantly
     *                              different resolution than that of their training
     * @param {number} maxScreenSpaceSplatSize The maximum clip space splat size
     * @param {number} splatScale Value by which all splats are scaled in screen-space (default is 1.0)
     * @param {number} pointCloudModeEnabled Render all splats as screen-space circles
     * @param {number} maxSphericalHarmonicsDegree Degree of spherical harmonics to utilize in rendering splats
     * @return {THREE.ShaderMaterial}
     */
    static build(dynamicMode = false, enableOptionalEffects = false, antialiased = false, maxScreenSpaceSplatSize = 2048,
                 splatScale = 1.0, pointCloudModeEnabled = false, maxSphericalHarmonicsDegree = 0, kernel2DSize = 0.3, useFlame = true) {

        const customVertexVars = `
            uniform vec2 covariancesTextureSize;
            uniform highp sampler2D covariancesTexture;
            uniform highp usampler2D covariancesTextureHalfFloat;
            uniform int covariancesAreHalfFloat;

            void fromCovarianceHalfFloatV4(uvec4 val, out vec4 first, out vec4 second) {
                vec2 r = unpackHalf2x16(val.r);
                vec2 g = unpackHalf2x16(val.g);
                vec2 b = unpackHalf2x16(val.b);

                first = vec4(r.x, r.y, g.x, g.y);
                second = vec4(b.x, b.y, 0.0, 0.0);
            }
        `;

        let vertexShaderSource = SplatMaterial.buildVertexShaderBase(dynamicMode, enableOptionalEffects,
                                                                     maxSphericalHarmonicsDegree, customVertexVars, useFlame);
        vertexShaderSource += SplatMaterial3D.buildVertexShaderProjection(antialiased, enableOptionalEffects,
                                                                          maxScreenSpaceSplatSize, kernel2DSize);
        const fragmentShaderSource = SplatMaterial3D.buildFragmentShader();

        const uniforms = SplatMaterial.getUniforms(dynamicMode, enableOptionalEffects,
                                                   maxSphericalHarmonicsDegree, splatScale, pointCloudModeEnabled);

        uniforms['covariancesTextureSize'] = {
            'type': 'v2',
            'value': new THREE.Vector2(1024, 1024)
        };
        uniforms['covariancesTexture'] = {
            'type': 't',
            'value': null
        };
        uniforms['covariancesTextureHalfFloat'] = {
            'type': 't',
            'value': null
        };
        uniforms['covariancesAreHalfFloat'] = {
            'type': 'i',
            'value': 0
        };

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShaderSource,
            fragmentShader: fragmentShaderSource,
            transparent: true,
            alphaTest: 1.0,
            blending: THREE.NormalBlending,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        return material;
    }

    static buildVertexShaderProjection(antialiased, enableOptionalEffects, maxScreenSpaceSplatSize, kernel2DSize) {
        let vertexShaderSource = `

            vec4 sampledCovarianceA;
            vec4 sampledCovarianceB;
            vec3 cov3D_M11_M12_M13;
            vec3 cov3D_M22_M23_M33;
            if (covariancesAreHalfFloat == 0) {
                sampledCovarianceA = texture(covariancesTexture, getDataUVF(nearestEvenIndex, 1.5, oddOffset,
                                                                            covariancesTextureSize));
                sampledCovarianceB = texture(covariancesTexture, getDataUVF(nearestEvenIndex, 1.5, oddOffset + uint(1),
                                                                            covariancesTextureSize));

                cov3D_M11_M12_M13 = vec3(sampledCovarianceA.rgb) * (1.0 - fOddOffset) +
                                    vec3(sampledCovarianceA.ba, sampledCovarianceB.r) * fOddOffset;
                cov3D_M22_M23_M33 = vec3(sampledCovarianceA.a, sampledCovarianceB.rg) * (1.0 - fOddOffset) +
                                    vec3(sampledCovarianceB.gba) * fOddOffset;
            } else {
                uvec4 sampledCovarianceU = texture(covariancesTextureHalfFloat, getDataUV(1, 0, covariancesTextureSize));
                fromCovarianceHalfFloatV4(sampledCovarianceU, sampledCovarianceA, sampledCovarianceB);
                cov3D_M11_M12_M13 = sampledCovarianceA.rgb;
                cov3D_M22_M23_M33 = vec3(sampledCovarianceA.a, sampledCovarianceB.rg);
            }
        
            // Construct the 3D covariance matrix
            mat3 Vrk = mat3(
                cov3D_M11_M12_M13.x, cov3D_M11_M12_M13.y, cov3D_M11_M12_M13.z,
                cov3D_M11_M12_M13.y, cov3D_M22_M23_M33.x, cov3D_M22_M23_M33.y,
                cov3D_M11_M12_M13.z, cov3D_M22_M23_M33.y, cov3D_M22_M23_M33.z
            );

            mat3 J;
            if (orthographicMode == 1) {
                // Since the projection is linear, we don't need an approximation
                J = transpose(mat3(orthoZoom, 0.0, 0.0,
                                0.0, orthoZoom, 0.0,
                                0.0, 0.0, 0.0));
            } else {
                // Construct the Jacobian of the affine approximation of the projection matrix. It will be used to transform the
                // 3D covariance matrix instead of using the actual projection matrix because that transformation would
                // require a non-linear component (perspective division) which would yield a non-gaussian result.
                float s = 1.0 / (viewCenter.z * viewCenter.z);
                J = mat3(
                    focal.x / viewCenter.z, 0., -(focal.x * viewCenter.x) * s,
                    0., focal.y / viewCenter.z, -(focal.y * viewCenter.y) * s,
                    0., 0., 0.
                );
            }

            // Concatenate the projection approximation with the model-view transformation
            mat3 W = transpose(mat3(transformModelViewMatrix));
            mat3 T = W * J;

            // Transform the 3D covariance matrix (Vrk) to compute the 2D covariance matrix
            mat3 cov2Dm = transpose(T) * Vrk * T;
            `;

        if (antialiased) {
            vertexShaderSource += `
                float detOrig = cov2Dm[0][0] * cov2Dm[1][1] - cov2Dm[0][1] * cov2Dm[0][1];
                cov2Dm[0][0] += ${kernel2DSize};
                cov2Dm[1][1] += ${kernel2DSize};
                float detBlur = cov2Dm[0][0] * cov2Dm[1][1] - cov2Dm[0][1] * cov2Dm[0][1];
                vColor.a *= sqrt(max(detOrig / detBlur, 0.0));
                if (vColor.a < minAlpha) return;
            `;
        } else {
            vertexShaderSource += `
                cov2Dm[0][0] += ${kernel2DSize};
                cov2Dm[1][1] += ${kernel2DSize};
            `;
        }

        vertexShaderSource += `

            // We are interested in the upper-left 2x2 portion of the projected 3D covariance matrix because
            // we only care about the X and Y values. We want the X-diagonal, cov2Dm[0][0],
            // the Y-diagonal, cov2Dm[1][1], and the correlation between the two cov2Dm[0][1]. We don't
            // need cov2Dm[1][0] because it is a symetric matrix.
            vec3 cov2Dv = vec3(cov2Dm[0][0], cov2Dm[0][1], cov2Dm[1][1]);

            // We now need to solve for the eigen-values and eigen vectors of the 2D covariance matrix
            // so that we can determine the 2D basis for the splat. This is done using the method described
            // here: https://people.math.harvard.edu/~knill/teaching/math21b2004/exhibits/2dmatrices/index.html
            // After calculating the eigen-values and eigen-vectors, we calculate the basis for rendering the splat
            // by normalizing the eigen-vectors and then multiplying them by (sqrt(8) * sqrt(eigen-value)), which is
            // equal to scaling them by sqrt(8) standard deviations.
            //
            // This is a different approach than in the original work at INRIA. In that work they compute the
            // max extents of the projected splat in screen space to form a screen-space aligned bounding rectangle
            // which forms the geometry that is actually rasterized. The dimensions of that bounding box are 3.0
            // times the square root of the maximum eigen-value, or 3 standard deviations. They then use the inverse
            // 2D covariance matrix (called 'conic') in the CUDA rendering thread to determine fragment opacity by
            // calculating the full gaussian: exp(-0.5 * (X - mean) * conic * (X - mean)) * splat opacity
            float a = cov2Dv.x;
            float d = cov2Dv.z;
            float b = cov2Dv.y;
            float D = a * d - b * b;
            float trace = a + d;
            float traceOver2 = 0.5 * trace;
            float term2 = sqrt(max(0.1f, traceOver2 * traceOver2 - D));
            float eigenValue1 = traceOver2 + term2;
            float eigenValue2 = traceOver2 - term2;

            if (pointCloudModeEnabled == 1) {
                eigenValue1 = eigenValue2 = 0.2;
            }

            if (eigenValue2 <= 0.0) return;

            vec2 eigenVector1 = normalize(vec2(b, eigenValue1 - a));
            // since the eigen vectors are orthogonal, we derive the second one from the first
            vec2 eigenVector2 = vec2(eigenVector1.y, -eigenVector1.x);

            // We use sqrt(8) standard deviations instead of 3 to eliminate more of the splat with a very low opacity.
            vec2 basisVector1 = eigenVector1 * splatScale * min(sqrt8 * sqrt(eigenValue1), ${parseInt(maxScreenSpaceSplatSize)}.0);
            vec2 basisVector2 = eigenVector2 * splatScale * min(sqrt8 * sqrt(eigenValue2), ${parseInt(maxScreenSpaceSplatSize)}.0);
            `;

        if (enableOptionalEffects) {
            vertexShaderSource += `
                vColor.a *= splatOpacityFromScene;
            `;
        }

        vertexShaderSource += `
            vec2 ndcOffset = vec2(vPosition.x * basisVector1 + vPosition.y * basisVector2) *
                             basisViewport * 2.0 * inverseFocalAdjustment;

            vec4 quadPos = vec4(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);
            gl_Position = quadPos;

            // Scale the position data we send to the fragment shader
            vPosition *= sqrt8;
        `;

        vertexShaderSource += SplatMaterial.getVertexShaderFadeIn();
        vertexShaderSource += `}`;

        return vertexShaderSource;
    }

    static buildFragmentShader() {
        let fragmentShaderSource = `
            precision highp float;
            #include <common>
 
            uniform vec3 debugColor;

            varying vec4 vColor;
            varying vec2 vUv;
            varying vec2 vPosition;
            varying vec2 vSplatIndex;

        `;

        fragmentShaderSource += `
            void main () {
                // Compute the positional squared distance from the center of the splat to the current fragment.
                float A = dot(vPosition, vPosition);
                // Since the positional data in vPosition has been scaled by sqrt(8), the squared result will be
                // scaled by a factor of 8. If the squared result is larger than 8, it means it is outside the ellipse
                // defined by the rectangle formed by vPosition. It also means it's farther
                // away than sqrt(8) standard deviations from the mean.

                // if(vSplatIndex.x > 20000.0) discard;
                // if (A > 8.0) discard;
                vec3 color = vColor.rgb;

                // Since the rendered splat is scaled by sqrt(8), the inverse covariance matrix that is part of
                // the gaussian formula becomes the identity matrix. We're then left with (X - mean) * (X - mean),
                // and since 'mean' is zero, we have X * X, which is the same as A:
                float opacity = exp( -0.5*A) * vColor.a;
                if(opacity < 1.0 / 255.0)
                    discard;

                // uint a = uint(255);
                // vec3 c = vec3(vSplatIndex.x / 256.0 / 256.0, float(uint(vSplatIndex.x / 256.0 )% a) / 256.0, float(uint(vSplatIndex.x)% a) / 256.0);
                // gl_FragColor = vec4(c, 1.0);
                gl_FragColor = vec4(color, opacity);


            }
        `;

        return fragmentShaderSource;
    }

}

/**
 * SplatMaterial2D
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Modified for FLAME avatar support:
 * - Extended vertex shader for FLAME integration
 */


class SplatMaterial2D {

    /**
     * Build the Three.js material that is used to render the splats.
     * @param {number} dynamicMode If true, it means the scene geometry represented by this splat mesh is not stationary or
     *                             that the splat count might change
     * @param {boolean} enableOptionalEffects When true, allows for usage of extra properties and attributes in the shader for effects
     *                                        such as opacity adjustment. Default is false for performance reasons.
     * @param {number} splatScale Value by which all splats are scaled in screen-space (default is 1.0)
     * @param {number} pointCloudModeEnabled Render all splats as screen-space circles
     * @param {number} maxSphericalHarmonicsDegree Degree of spherical harmonics to utilize in rendering splats
     * @return {THREE.ShaderMaterial}
     */
    static build(dynamicMode = false, enableOptionalEffects = false, splatScale = 1.0,
                 pointCloudModeEnabled = false, maxSphericalHarmonicsDegree = 0) {

        const customVertexVars = `
            uniform vec2 scaleRotationsTextureSize;
            uniform highp sampler2D scaleRotationsTexture;
            varying mat3 vT;
            varying vec2 vQuadCenter;
            varying vec2 vFragCoord;
        `;

        let vertexShaderSource = SplatMaterial.buildVertexShaderBase(dynamicMode, enableOptionalEffects,
                                                                     maxSphericalHarmonicsDegree, customVertexVars);
        vertexShaderSource += SplatMaterial2D.buildVertexShaderProjection();
        const fragmentShaderSource = SplatMaterial2D.buildFragmentShader();

        const uniforms = SplatMaterial.getUniforms(dynamicMode, enableOptionalEffects,
                                                   maxSphericalHarmonicsDegree, splatScale, pointCloudModeEnabled);

        uniforms['scaleRotationsTexture'] = {
            'type': 't',
            'value': null
        };
        uniforms['scaleRotationsTextureSize'] = {
            'type': 'v2',
            'value': new THREE.Vector2(1024, 1024)
        };

        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShaderSource,
            fragmentShader: fragmentShaderSource,
            transparent: true,
            alphaTest: 1.0,
            blending: THREE.NormalBlending,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        return material;
    }

    static buildVertexShaderProjection() {

        // Original CUDA code for calculating splat-to-screen transformation, for reference
        /*
            glm::mat3 R = quat_to_rotmat(rot);
            glm::mat3 S = scale_to_mat(scale, mod);
            glm::mat3 L = R * S;

            // center of Gaussians in the camera coordinate
            glm::mat3x4 splat2world = glm::mat3x4(
                glm::vec4(L[0], 0.0),
                glm::vec4(L[1], 0.0),
                glm::vec4(p_orig.x, p_orig.y, p_orig.z, 1)
            );

            glm::mat4 world2ndc = glm::mat4(
                projmatrix[0], projmatrix[4], projmatrix[8], projmatrix[12],
                projmatrix[1], projmatrix[5], projmatrix[9], projmatrix[13],
                projmatrix[2], projmatrix[6], projmatrix[10], projmatrix[14],
                projmatrix[3], projmatrix[7], projmatrix[11], projmatrix[15]
            );

            glm::mat3x4 ndc2pix = glm::mat3x4(
                glm::vec4(float(W) / 2.0, 0.0, 0.0, float(W-1) / 2.0),
                glm::vec4(0.0, float(H) / 2.0, 0.0, float(H-1) / 2.0),
                glm::vec4(0.0, 0.0, 0.0, 1.0)
            );

            T = glm::transpose(splat2world) * world2ndc * ndc2pix;
            normal = transformVec4x3({L[2].x, L[2].y, L[2].z}, viewmatrix);
        */

        // Compute a 2D-to-2D mapping matrix from a tangent plane into a image plane
        // given a 2D gaussian parameters. T = WH (from the paper: https://arxiv.org/pdf/2403.17888)
        let vertexShaderSource = `

            vec4 scaleRotationA = texture(scaleRotationsTexture, getDataUVF(nearestEvenIndex, 1.5,
                                                                            oddOffset, scaleRotationsTextureSize));
            vec4 scaleRotationB = texture(scaleRotationsTexture, getDataUVF(nearestEvenIndex, 1.5,
                                                                            oddOffset + uint(1), scaleRotationsTextureSize));

            vec3 scaleRotation123 = vec3(scaleRotationA.rgb) * (1.0 - fOddOffset) +
                                    vec3(scaleRotationA.ba, scaleRotationB.r) * fOddOffset;
            vec3 scaleRotation456 = vec3(scaleRotationA.a, scaleRotationB.rg) * (1.0 - fOddOffset) +
                                    vec3(scaleRotationB.gba) * fOddOffset;

            float missingW = sqrt(1.0 - scaleRotation456.x * scaleRotation456.x - scaleRotation456.y *
                                    scaleRotation456.y - scaleRotation456.z * scaleRotation456.z);
            mat3 R = quaternionToRotationMatrix(scaleRotation456.r, scaleRotation456.g, scaleRotation456.b, missingW);
            mat3 S = mat3(scaleRotation123.r, 0.0, 0.0,
                            0.0, scaleRotation123.g, 0.0,
                            0.0, 0.0, scaleRotation123.b);
            
            mat3 L = R * S;

            mat3x4 splat2World = mat3x4(vec4(L[0], 0.0),
                                        vec4(L[1], 0.0),
                                        vec4(splatCenter.x, splatCenter.y, splatCenter.z, 1.0));

            mat4 world2ndc = transpose(projectionMatrix * transformModelViewMatrix);

            mat3x4 ndc2pix = mat3x4(vec4(viewport.x / 2.0, 0.0, 0.0, (viewport.x - 1.0) / 2.0),
                                    vec4(0.0, viewport.y / 2.0, 0.0, (viewport.y - 1.0) / 2.0),
                                    vec4(0.0, 0.0, 0.0, 1.0));

            mat3 T = transpose(splat2World) * world2ndc * ndc2pix;
            vec3 normal = vec3(viewMatrix * vec4(L[0][2], L[1][2], L[2][2], 0.0));
        `;

        // Original CUDA code for projection to 2D, for reference
        /*
            float3 T0 = {T[0][0], T[0][1], T[0][2]};
            float3 T1 = {T[1][0], T[1][1], T[1][2]};
            float3 T3 = {T[2][0], T[2][1], T[2][2]};

            // Compute AABB
            float3 temp_point = {1.0f, 1.0f, -1.0f};
            float distance = sumf3(T3 * T3 * temp_point);
            float3 f = (1 / distance) * temp_point;
            if (distance == 0.0) return false;

            point_image = {
                sumf3(f * T0 * T3),
                sumf3(f * T1 * T3)
            };

            float2 temp = {
                sumf3(f * T0 * T0),
                sumf3(f * T1 * T1)
            };
            float2 half_extend = point_image * point_image - temp;
            extent = sqrtf2(maxf2(1e-4, half_extend));
            return true;
        */

        // Computing the bounding box of the 2D Gaussian and its center
        // The center of the bounding box is used to create a low pass filter.
        // This code is based off the reference implementation and creates an AABB aligned
        // with the screen for the quad to be rendered.
        const referenceQuadGeneration = `
            vec3 T0 = vec3(T[0][0], T[0][1], T[0][2]);
            vec3 T1 = vec3(T[1][0], T[1][1], T[1][2]);
            vec3 T3 = vec3(T[2][0], T[2][1], T[2][2]);

            vec3 tempPoint = vec3(1.0, 1.0, -1.0);
            float distance = (T3.x * T3.x * tempPoint.x) + (T3.y * T3.y * tempPoint.y) + (T3.z * T3.z * tempPoint.z);
            vec3 f = (1.0 / distance) * tempPoint;
            if (abs(distance) < 0.00001) return;

            float pointImageX = (T0.x * T3.x * f.x) + (T0.y * T3.y * f.y) + (T0.z * T3.z * f.z);
            float pointImageY = (T1.x * T3.x * f.x) + (T1.y * T3.y * f.y) + (T1.z * T3.z * f.z);
            vec2 pointImage = vec2(pointImageX, pointImageY);

            float tempX = (T0.x * T0.x * f.x) + (T0.y * T0.y * f.y) + (T0.z * T0.z * f.z);
            float tempY = (T1.x * T1.x * f.x) + (T1.y * T1.y * f.y) + (T1.z * T1.z * f.z);
            vec2 temp = vec2(tempX, tempY);

            vec2 halfExtend = pointImage * pointImage - temp;
            vec2 extent = sqrt(max(vec2(0.0001), halfExtend));
            float radius = max(extent.x, extent.y);

            vec2 ndcOffset = ((position.xy * radius * 3.0) * basisViewport * 2.0);

            vec4 quadPos = vec4(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);
            gl_Position = quadPos;

            vT = T;
            vQuadCenter = pointImage;
            vFragCoord = (quadPos.xy * 0.5 + 0.5) * viewport;
        `;
        {
            // Create a quad that is aligned with the eigen vectors of the projected gaussian for rendering.
            // This is a different approach than the reference implementation, similar to how the rendering of
            // 3D gaussians in this viewer differs from the reference implementation. If the quad is too small
            // (smaller than a pixel), then revert to the reference implementation.
            vertexShaderSource += `

                mat4 splat2World4 = mat4(vec4(L[0], 0.0),
                                        vec4(L[1], 0.0),
                                        vec4(L[2], 0.0),
                                        vec4(splatCenter.x, splatCenter.y, splatCenter.z, 1.0));

                mat4 Tt = transpose(transpose(splat2World4) * world2ndc);

                vec4 tempPoint1 = Tt * vec4(1.0, 0.0, 0.0, 1.0);
                tempPoint1 /= tempPoint1.w;

                vec4 tempPoint2 = Tt * vec4(0.0, 1.0, 0.0, 1.0);
                tempPoint2 /= tempPoint2.w;

                vec4 center = Tt * vec4(0.0, 0.0, 0.0, 1.0);
                center /= center.w;

                vec2 basisVector1 = tempPoint1.xy - center.xy;
                vec2 basisVector2 = tempPoint2.xy - center.xy;

                vec2 basisVector1Screen = basisVector1 * 0.5 * viewport;
                vec2 basisVector2Screen = basisVector2 * 0.5 * viewport;

                const float minPix = 1.;
                if (length(basisVector1Screen) < minPix || length(basisVector2Screen) < minPix) {
                    ${referenceQuadGeneration}
                } else {
                    vec2 ndcOffset = vec2(position.x * basisVector1 + position.y * basisVector2) * 3.0 * inverseFocalAdjustment;
                    vec4 quadPos = vec4(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);
                    gl_Position = quadPos;

                    vT = T;
                    vQuadCenter = center.xy;
                    vFragCoord = (quadPos.xy * 0.5 + 0.5) * viewport;
                }
            `;
        }

        vertexShaderSource += SplatMaterial.getVertexShaderFadeIn();
        vertexShaderSource += `}`;

        return vertexShaderSource;
    }

    static buildFragmentShader() {

        // Original CUDA code for splat intersection, for reference
        /*
            const float2 xy = collected_xy[j];
            const float3 Tu = collected_Tu[j];
            const float3 Tv = collected_Tv[j];
            const float3 Tw = collected_Tw[j];
            float3 k = pix.x * Tw - Tu;
            float3 l = pix.y * Tw - Tv;
            float3 p = cross(k, l);
            if (p.z == 0.0) continue;
            float2 s = {p.x / p.z, p.y / p.z};
            float rho3d = (s.x * s.x + s.y * s.y);
            float2 d = {xy.x - pixf.x, xy.y - pixf.y};
            float rho2d = FilterInvSquare * (d.x * d.x + d.y * d.y);

            // compute intersection and depth
            float rho = min(rho3d, rho2d);
            float depth = (rho3d <= rho2d) ? (s.x * Tw.x + s.y * Tw.y) + Tw.z : Tw.z;
            if (depth < near_n) continue;
            float4 nor_o = collected_normal_opacity[j];
            float normal[3] = {nor_o.x, nor_o.y, nor_o.z};
            float opa = nor_o.w;

            float power = -0.5f * rho;
            if (power > 0.0f)
                continue;

            // Eq. (2) from 3D Gaussian splatting paper.
            // Obtain alpha by multiplying with Gaussian opacity
            // and its exponential falloff from mean.
            // Avoid numerical instabilities (see paper appendix).
            float alpha = min(0.99f, opa * exp(power));
            if (alpha < 1.0f / 255.0f)
                continue;
            float test_T = T * (1 - alpha);
            if (test_T < 0.0001f)
            {
                done = true;
                continue;
            }

            float w = alpha * T;
        */
        let fragmentShaderSource = `
            precision highp float;
            #include <common>

            uniform vec3 debugColor;

            varying vec4 vColor;
            varying vec2 vUv;
            varying vec2 vPosition;
            varying mat3 vT;
            varying vec2 vQuadCenter;
            varying vec2 vFragCoord;

            void main () {

                const float FilterInvSquare = 2.0;
                const float near_n = 0.2;
                const float T = 1.0;

                vec2 xy = vQuadCenter;
                vec3 Tu = vT[0];
                vec3 Tv = vT[1];
                vec3 Tw = vT[2];
                vec3 k = vFragCoord.x * Tw - Tu;
                vec3 l = vFragCoord.y * Tw - Tv;
                vec3 p = cross(k, l);
                if (p.z == 0.0) discard;
                vec2 s = vec2(p.x / p.z, p.y / p.z);
                float rho3d = (s.x * s.x + s.y * s.y); 
                vec2 d = vec2(xy.x - vFragCoord.x, xy.y - vFragCoord.y);
                float rho2d = FilterInvSquare * (d.x * d.x + d.y * d.y); 

                // compute intersection and depth
                float rho = min(rho3d, rho2d);
                float depth = (rho3d <= rho2d) ? (s.x * Tw.x + s.y * Tw.y) + Tw.z : Tw.z; 
                if (depth < near_n) discard;
                //  vec4 nor_o = collected_normal_opacity[j];
                //  float normal[3] = {nor_o.x, nor_o.y, nor_o.z};
                float opa = vColor.a;

                float power = -0.5f * rho;
                if (power > 0.0f) discard;

                // Eq. (2) from 3D Gaussian splatting paper.
                // Obtain alpha by multiplying with Gaussian opacity
                // and its exponential falloff from mean.
                // Avoid numerical instabilities (see paper appendix). 
                float alpha = min(0.99f, opa * exp(power));
                if (alpha < 1.0f / 255.0f) discard;
                float test_T = T * (1.0 - alpha);
                if (test_T < 0.0001)discard;

                float w = alpha * T;
                gl_FragColor = vec4(vColor.rgb, w);
            }
        `;

        return fragmentShaderSource;
    }
}

/**
 * SplatMesh
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * HEAVILY MODIFIED for FLAME avatar support:
 * - Added FLAME bone texture handling
 * - Added expression blendshape support
 * - Extended with skinning data management
 * - Additional ~800 lines of FLAME-specific code
 */


// Dummy geometry and material for initial Mesh construction
const dummyGeometry = new THREE.BufferGeometry();
const dummyMaterial = new THREE.MeshBasicMaterial();

/**
 * WebGL Extensions helper (from Three.js internals)
 */
function WebGLExtensions$1(gl) {
    const extensions = {};

    function getExtension(name) {
        if (extensions[name] !== undefined) {
            return extensions[name];
        }

        let extension;
        switch (name) {
            case 'WEBGL_depth_texture':
                extension = gl.getExtension('WEBGL_depth_texture') || gl.getExtension('MOZ_WEBGL_depth_texture') ||
                            gl.getExtension('WEBKIT_WEBGL_depth_texture');
                break;
            case 'EXT_texture_filter_anisotropic':
                extension = gl.getExtension('EXT_texture_filter_anisotropic') ||
                            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
                            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
                break;
            case 'WEBGL_compressed_texture_s3tc':
                extension = gl.getExtension('WEBGL_compressed_texture_s3tc') ||
                            gl.getExtension('MOZ_WEBGL_compressed_texture_s3tc') ||
                            gl.getExtension('WEBKIT_WEBGL_compressed_texture_s3tc');
                break;
            case 'WEBGL_compressed_texture_pvrtc':
                extension = gl.getExtension('WEBGL_compressed_texture_pvrtc') ||
                            gl.getExtension('WEBKIT_WEBGL_compressed_texture_pvrtc');
                break;
            default:
                extension = gl.getExtension(name);
        }

        extensions[name] = extension;
        return extension;
    }

    return {
        has: function(name) {
            return getExtension(name) !== null;
        },
        init: function(capabilities) {
            if (capabilities.isWebGL2) {
                getExtension('EXT_color_buffer_float');
                getExtension('WEBGL_clip_cull_distance');
            } else {
                getExtension('WEBGL_depth_texture');
                getExtension('OES_texture_float');
                getExtension('OES_texture_half_float');
                getExtension('OES_texture_half_float_linear');
                getExtension('OES_standard_derivatives');
                getExtension('OES_element_index_uint');
                getExtension('OES_vertex_array_object');
                getExtension('ANGLE_instanced_arrays');
            }
            getExtension('OES_texture_float_linear');
            getExtension('EXT_color_buffer_half_float');
            getExtension('WEBGL_multisampled_render_to_texture');
        },
        get: function(name) {
            const extension = getExtension(name);
            if (extension === null) {
                console.warn('THREE.WebGLRenderer: ' + name + ' extension not supported.');
            }
            return extension;
        }
    };
}

/**
 * WebGL Capabilities helper (from Three.js internals)
 */
function WebGLCapabilities$1(gl, extensions, parameters) {
    let maxAnisotropy;

    function getMaxAnisotropy() {
        if (maxAnisotropy !== undefined) return maxAnisotropy;
        if (extensions.has('EXT_texture_filter_anisotropic') === true) {
            const extension = extensions.get('EXT_texture_filter_anisotropic');
            maxAnisotropy = gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        } else {
            maxAnisotropy = 0;
        }
        return maxAnisotropy;
    }

    function getMaxPrecision(precision) {
        if (precision === 'highp') {
            if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT).precision > 0 &&
                gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0) {
                return 'highp';
            }
            precision = 'mediump';
        }
        if (precision === 'mediump') {
            if (gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT).precision > 0 &&
                gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision > 0) {
                return 'mediump';
            }
        }
        return 'lowp';
    }

    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl.constructor.name === 'WebGL2RenderingContext';

    let precision = parameters.precision !== undefined ? parameters.precision : 'highp';
    const maxPrecision = getMaxPrecision(precision);

    if (maxPrecision !== precision) {
        console.warn('THREE.WebGLRenderer:', precision, 'not supported, using', maxPrecision, 'instead.');
        precision = maxPrecision;
    }

    const drawBuffers = isWebGL2 || extensions.has('WEBGL_draw_buffers');
    const logarithmicDepthBuffer = parameters.logarithmicDepthBuffer === true;

    const maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    const maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxCubemapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);

    const maxAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    const maxVaryings = gl.getParameter(gl.MAX_VARYING_VECTORS);
    const maxFragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);

    const vertexTextures = maxVertexTextures > 0;
    const floatFragmentTextures = isWebGL2 || extensions.has('OES_texture_float');
    const floatVertexTextures = vertexTextures && floatFragmentTextures;

    const maxSamples = isWebGL2 ? gl.getParameter(gl.MAX_SAMPLES) : 0;

    return {
        isWebGL2: isWebGL2,
        drawBuffers: drawBuffers,
        getMaxAnisotropy: getMaxAnisotropy,
        getMaxPrecision: getMaxPrecision,
        precision: precision,
        logarithmicDepthBuffer: logarithmicDepthBuffer,
        maxTextures: maxTextures,
        maxVertexTextures: maxVertexTextures,
        maxTextureSize: maxTextureSize,
        maxCubemapSize: maxCubemapSize,
        maxAttributes: maxAttributes,
        maxVertexUniforms: maxVertexUniforms,
        maxVaryings: maxVaryings,
        maxFragmentUniforms: maxFragmentUniforms,
        vertexTextures: vertexTextures,
        floatFragmentTextures: floatFragmentTextures,
        floatVertexTextures: floatVertexTextures,
        maxSamples: maxSamples
    };
}

/**
 * WebGL Utils helper (from Three.js internals)
 */
function WebGLUtils$1(gl, extensions, capabilities) {
    const isWebGL2 = capabilities.isWebGL2;

    function convert(p, colorSpace) {
        let extension;

        if (p === THREE.UnsignedByteType) return gl.UNSIGNED_BYTE;
        if (p === 1017) return gl.UNSIGNED_SHORT_4_4_4_4;
        if (p === 1018) return gl.UNSIGNED_SHORT_5_5_5_1;
        if (p === 1010) return gl.BYTE;
        if (p === 1011) return gl.SHORT;
        if (p === 1012) return gl.UNSIGNED_SHORT;
        if (p === 1013) return gl.INT;
        if (p === 1014) return gl.UNSIGNED_INT;
        if (p === THREE.FloatType) return gl.FLOAT;

        if (p === THREE.HalfFloatType) {
            if (isWebGL2) return gl.HALF_FLOAT;
            extension = extensions.get('OES_texture_half_float');
            if (extension !== null) {
                return extension.HALF_FLOAT_OES;
            } else {
                return null;
            }
        }

        if (p === 1021) return gl.ALPHA;
        if (p === 1022) return gl.RGB;
        if (p === THREE.RGBAFormat) return gl.RGBA;
        if (p === 1024) return gl.LUMINANCE;
        if (p === 1025) return gl.LUMINANCE_ALPHA;
        if (p === 1026) return gl.DEPTH_COMPONENT;
        if (p === 1027) return gl.DEPTH_STENCIL;

        // WebGL2 formats
        if (p === THREE.RedFormat) return gl.RED;
        if (p === THREE.RedIntegerFormat) return gl.RED_INTEGER;
        if (p === THREE.RGFormat) return gl.RG;
        if (p === THREE.RGIntegerFormat) return gl.RG_INTEGER;
        if (p === THREE.RGBIntegerFormat) return gl.RGB_INTEGER;
        if (p === THREE.RGBAIntegerFormat) return gl.RGBA_INTEGER;

        // S3TC
        if (p === 33776 || p === 33777 || p === 33778 || p === 33779) {
            extension = extensions.get('WEBGL_compressed_texture_s3tc');
            if (extension !== null) {
                if (p === 33776) return extension.COMPRESSED_RGB_S3TC_DXT1_EXT;
                if (p === 33777) return extension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
                if (p === 33778) return extension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                if (p === 33779) return extension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
            } else {
                return null;
            }
        }

        // PVRTC
        if (p === 35840 || p === 35841 || p === 35842 || p === 35843) {
            extension = extensions.get('WEBGL_compressed_texture_pvrtc');
            if (extension !== null) {
                if (p === 35840) return extension.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
                if (p === 35841) return extension.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
                if (p === 35842) return extension.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
                if (p === 35843) return extension.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
            } else {
                return null;
            }
        }

        // ETC
        if (p === 36196) {
            extension = extensions.get('WEBGL_compressed_texture_etc1');
            if (extension !== null) {
                return extension.COMPRESSED_RGB_ETC1_WEBGL;
            } else {
                return null;
            }
        }

        // ASTC
        if (p >= 37808 && p <= 37814 || p >= 37840 && p <= 37846) {
            extension = extensions.get('WEBGL_compressed_texture_astc');
            if (extension !== null) {
                return p;
            } else {
                return null;
            }
        }

        // BPTC
        if (p === 36492 || p === 36494 || p === 36495) {
            extension = extensions.get('EXT_texture_compression_bptc');
            if (extension !== null) {
                return p;
            } else {
                return null;
            }
        }

        if (p === 34042) return gl.UNSIGNED_INT_24_8;

        // Internal formats for float/half-float textures
        if (isWebGL2) {
            if (p === 6407) return gl.RGB;
            if (p === 6408) return gl.RGBA;
        }

        return (gl[p] !== undefined) ? gl[p] : null;
    }

    return {
        convert: convert
    };
}

// Constants for texture element counts
const COVARIANCES_ELEMENTS_PER_SPLAT = 6;
const CENTER_COLORS_ELEMENTS_PER_SPLAT = 4;

const COVARIANCES_ELEMENTS_PER_TEXEL_STORED = 4;
const COVARIANCES_ELEMENTS_PER_TEXEL_ALLOCATED = 4;
const COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_STORED = 6;
const COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_ALLOCATED = 8;
const SCALES_ROTATIONS_ELEMENTS_PER_TEXEL = 4;
const CENTER_COLORS_ELEMENTS_PER_TEXEL = 4;
const SCENE_INDEXES_ELEMENTS_PER_TEXEL = 1;

const SCENE_FADEIN_RATE_FAST = 0.012;
const SCENE_FADEIN_RATE_GRADUAL = 0.003;

const VISIBLE_REGION_EXPANSION_DELTA = 1;

const MAX_TEXTURE_TEXELS = 16777216;

class SplatMesh extends THREE.Mesh {

    constructor(splatRenderMode = SplatRenderMode.ThreeD, dynamicMode = false, enableOptionalEffects = false,
                halfPrecisionCovariancesOnGPU = false, devicePixelRatio = 1, enableDistancesComputationOnGPU = true,
                integerBasedDistancesComputation = false, antialiased = false, maxScreenSpaceSplatSize = 1024, logLevel = LogLevel.None,
                sphericalHarmonicsDegree = 0, sceneFadeInRateMultiplier = 1.0, kernel2DSize = 0.3) {
        super(dummyGeometry, dummyMaterial);

        // Reference to a Three.js renderer
        this.renderer = undefined;

        // Determine how the splats are rendered
        this.splatRenderMode = splatRenderMode;

        // When 'dynamicMode' is true, scenes are assumed to be non-static. Dynamic scenes are handled differently
        // and certain optimizations cannot be made for them. Additionally, by default, all splat data retrieved from
        // this splat mesh will not have their scene transform applied to them if the splat mesh is dynamic. That
        // can be overriden via parameters to the individual functions that are used to retrieve splat data.
        this.dynamicMode = dynamicMode;

        // When true, allows for usage of extra properties and attributes during rendering for effects such as opacity adjustment.
        // Default is false for performance reasons. These properties are separate from transform properties (scale, rotation, position)
        // that are enabled by the 'dynamicScene' parameter.
        this.enableOptionalEffects = enableOptionalEffects;

        // Use 16-bit floating point values when storing splat covariance data in textures, instead of 32-bit
        this.halfPrecisionCovariancesOnGPU = halfPrecisionCovariancesOnGPU;

        // Ratio of the resolution in physical pixels to the resolution in CSS pixels for the current display device
        this.devicePixelRatio = devicePixelRatio;

        // Use a transform feedback to calculate splat distances from the camera
        this.enableDistancesComputationOnGPU = enableDistancesComputationOnGPU;

        // Use a faster integer-based approach for calculating splat distances from the camera
        this.integerBasedDistancesComputation = integerBasedDistancesComputation;

        // When true, will perform additional steps during rendering to address artifacts caused by the rendering of gaussians at a
        // substantially different resolution than that at which they were rendered during training. This will only work correctly
        // for models that were trained using a process that utilizes this compensation calculation. For more details:
        // https://github.com/nerfstudio-project/gsplat/pull/117
        // https://github.com/graphdeco-inria/gaussian-splatting/issues/294#issuecomment-1772688093
        this.antialiased = antialiased;

        // The size of the 2D kernel used for splat rendering
        // This will adjust the 2D kernel size after the projection
        this.kernel2DSize = kernel2DSize;

        // Specify the maximum clip space splat size, can help deal with large splats that get too unwieldy
        this.maxScreenSpaceSplatSize = maxScreenSpaceSplatSize;

        // The verbosity of console logging
        this.logLevel = logLevel;

        // Degree 0 means no spherical harmonics
        this.sphericalHarmonicsDegree = sphericalHarmonicsDegree;
        this.minSphericalHarmonicsDegree = 0;

        this.sceneFadeInRateMultiplier = sceneFadeInRateMultiplier;

        // The individual splat scenes stored in this splat mesh, each containing their own transform
        this.scenes = [];

        // Special octree tailored to SplatMesh instances
        this.splatTree = null;
        this.baseSplatTree = null;

        // Cache textures and the intermediate data used to populate them
        this.splatDataTextures = {};
        this.flameModel = null;
        this.expressionBSNum = 0;
        this.bsWeight = [];

        this.bonesMatrix = null;
        this.bonesNum = null;
        this.bonesWeight = null;
        this.gaussianSplatCount = null;
        this.useFlameModel = true;

        this.morphTargetDictionary = null;
        this.distancesTransformFeedback = {
            'id': null,
            'vertexShader': null,
            'fragmentShader': null,
            'program': null,
            'centersBuffer': null,
            'sceneIndexesBuffer': null,
            'outDistancesBuffer': null,
            'centersLoc': -1,
            'modelViewProjLoc': -1,
            'sceneIndexesLoc': -1,
            'transformsLocs': []
        };

        this.globalSplatIndexToLocalSplatIndexMap = [];
        this.globalSplatIndexToSceneIndexMap = [];

        this.lastBuildSplatCount = 0;
        this.lastBuildScenes = [];
        this.lastBuildMaxSplatCount = 0;
        this.lastBuildSceneCount = 0;
        this.firstRenderTime = -1;
        this.finalBuild = false;

        this.webGLUtils = null;

        this.boundingBox = new THREE.Box3();
        this.calculatedSceneCenter = new THREE.Vector3();
        this.maxSplatDistanceFromSceneCenter = 0;
        this.visibleRegionBufferRadius = 0;
        this.visibleRegionRadius = 0;
        this.visibleRegionFadeStartRadius = 0;
        this.visibleRegionChanging = false;

        this.splatScale = 1.0;
        this.pointCloudModeEnabled = false;

        this.disposed = false;
        this.lastRenderer = null;
        this.visible = false;
    }

    /**
     * Build a container for each scene managed by this splat mesh based on an instance of SplatBuffer, along with optional
     * transform data (position, scale, rotation) passed to the splat mesh during the build process.
     * @param {Array<THREE.Matrix4>} splatBuffers SplatBuffer instances containing splats for each scene
     * @param {Array<object>} sceneOptions Array of options objects: {
     *
     *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
     *
     *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
     *
     *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
     * }
     * @return {Array<THREE.Matrix4>}
     */
    static buildScenes(parentObject, splatBuffers, sceneOptions) {
        const scenes = [];
        scenes.length = splatBuffers.length;
        for (let i = 0; i < splatBuffers.length; i++) {
            const splatBuffer = splatBuffers[i];
            const options = sceneOptions[i] || {};
            let positionArray = options['position'] || [0, 0, 0];
            let rotationArray = options['rotation'] || [0, 0, 0, 1];
            let scaleArray = options['scale'] || [1, 1, 1];
            const position = new THREE.Vector3().fromArray(positionArray);
            const rotation = new THREE.Quaternion().fromArray(rotationArray);
            const scale = new THREE.Vector3().fromArray(scaleArray);
            const scene = SplatMesh.createScene(splatBuffer, position, rotation, scale,
                                                options.splatAlphaRemovalThreshold || 1, options.opacity, options.visible);
            parentObject.add(scene);
            scenes[i] = scene;
        }
        return scenes;
    }



    static createScene(splatBuffer, position, rotation, scale, minimumAlpha, opacity = 1.0, visible = true) {
        return new SplatScene(splatBuffer, position, rotation, scale, minimumAlpha, opacity, visible);
    }

    /**
     * Build data structures that map global splat indexes (based on a unified index across all splat buffers) to
     * local data within a single scene.
     * @param {Array<SplatBuffer>} splatBuffers Instances of SplatBuffer off which to build the maps
     * @return {object}
     */
    static buildSplatIndexMaps(splatBuffers) {
        const localSplatIndexMap = [];
        const sceneIndexMap = [];
        let totalSplatCount = 0;
        for (let s = 0; s < splatBuffers.length; s++) {
            const splatBuffer = splatBuffers[s];
            const maxSplatCount = splatBuffer.getMaxSplatCount();
            for (let i = 0; i < maxSplatCount; i++) {
                localSplatIndexMap[totalSplatCount] = i;
                sceneIndexMap[totalSplatCount] = s;
                totalSplatCount++;
            }
        }
        return {
            localSplatIndexMap,
            sceneIndexMap
        };
    }

    /**
     * Build an instance of SplatTree (a specialized octree) for the given splat mesh.
     * @param {Array<number>} minAlphas Array of minimum splat slphas for each scene
     * @param {function} onSplatTreeIndexesUpload Function to be called when the upload of splat centers to the splat tree
     *                                            builder worker starts and finishes.
     * @param {function} onSplatTreeConstruction Function to be called when the conversion of the local splat tree from
     *                                           the format produced by the splat tree builder worker starts and ends.
     * @return {SplatTree}
     */
     buildSplatTree = (minAlphas = [], onSplatTreeIndexesUpload, onSplatTreeConstruction) => {
        return new Promise((resolve) => {
            this.disposeSplatTree();
            // TODO: expose SplatTree constructor parameters (maximumDepth and maxCentersPerNode) so that they can
            // be configured on a per-scene basis
            this.baseSplatTree = new SplatTree(8, 1000);
            const buildStartTime = performance.now();
            const splatColor = new THREE.Vector4();
            this.baseSplatTree.processSplatMesh(this, (splatIndex) => {
                this.getSplatColor(splatIndex, splatColor);
                const sceneIndex = this.getSceneIndexForSplat(splatIndex);
                const minAlpha = minAlphas[sceneIndex] || 1;
                return splatColor.w >= minAlpha;
            }, onSplatTreeIndexesUpload, onSplatTreeConstruction)
            .then(() => {
                const buildTime = performance.now() - buildStartTime;
                if (this.logLevel >= LogLevel.Info) console.log('SplatTree build: ' + buildTime + ' ms');
                if (this.disposed) {
                    resolve();
                } else {

                    this.splatTree = this.baseSplatTree;
                    this.baseSplatTree = null;

                    let leavesWithVertices = 0;
                    let avgSplatCount = 0;
                    let nodeCount = 0;

                    this.splatTree.visitLeaves((node) => {
                        const nodeSplatCount = node.data.indexes.length;
                        if (nodeSplatCount > 0) {
                            avgSplatCount += nodeSplatCount;
                            nodeCount++;
                            leavesWithVertices++;
                        }
                    });
                    if (this.logLevel >= LogLevel.Info) {
                        console.log(`SplatTree leaves: ${this.splatTree.countLeaves()}`);
                        console.log(`SplatTree leaves with splats:${leavesWithVertices}`);
                        avgSplatCount = avgSplatCount / nodeCount;
                        console.log(`Avg splat count per node: ${avgSplatCount}`);
                        console.log(`Total splat count: ${this.getSplatCount()}`);
                    }
                    resolve();
                }
            });
        });
    };

    /**
     * Construct this instance of SplatMesh.
     * @param {Array<SplatBuffer>} splatBuffers The base splat data, instances of SplatBuffer
     * @param {Array<object>} sceneOptions Dynamic options for each scene {
     *
     *         splatAlphaRemovalThreshold: Ignore any splats with an alpha less than the specified
     *                                     value (valid range: 0 - 255), defaults to 1
     *
     *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
     *
     *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
     *
     *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
     *
     * }
     * @param {boolean} keepSceneTransforms For a scene that already exists and is being overwritten, this flag
     *                                      says to keep the transform from the existing scene.
     * @param {boolean} finalBuild Will the splat mesh be in its final state after this build?
     * @param {function} onSplatTreeIndexesUpload Function to be called when the upload of splat centers to the splat tree
     *                                            builder worker starts and finishes.
     * @param {function} onSplatTreeConstruction Function to be called when the conversion of the local splat tree from
     *                                           the format produced by the splat tree builder worker starts and ends.
     * @return {object} Object containing info about the splats that are updated
     */
    build(splatBuffers, sceneOptions, keepSceneTransforms = true, finalBuild = false,
          onSplatTreeIndexesUpload, onSplatTreeConstruction, preserveVisibleRegion = true) {

        this.sceneOptions = sceneOptions;
        this.finalBuild = finalBuild;

        const maxSplatCount = SplatMesh.getTotalMaxSplatCountForSplatBuffers(splatBuffers);

        const newScenes = SplatMesh.buildScenes(this, splatBuffers, sceneOptions);
        if (keepSceneTransforms) {
            for (let i = 0; i < this.scenes.length && i < newScenes.length; i++) {
                const newScene = newScenes[i];
                const existingScene = this.getScene(i);
                newScene.copyTransformData(existingScene);
            }
        }
        this.scenes = newScenes;

        let minSphericalHarmonicsDegree = 3;
        for (let splatBuffer of splatBuffers) {
            const splatBufferSphericalHarmonicsDegree = splatBuffer.getMinSphericalHarmonicsDegree();
            if (splatBufferSphericalHarmonicsDegree < minSphericalHarmonicsDegree) {
                minSphericalHarmonicsDegree = splatBufferSphericalHarmonicsDegree;
            }
        }
        this.minSphericalHarmonicsDegree = Math.min(minSphericalHarmonicsDegree, this.sphericalHarmonicsDegree);

        let splatBuffersChanged = false;
        if (splatBuffers.length !== this.lastBuildScenes.length) {
            splatBuffersChanged = true;
        } else {
            for (let i = 0; i < splatBuffers.length; i++) {
                const splatBuffer = splatBuffers[i];
                if (splatBuffer !== this.lastBuildScenes[i].splatBuffer) {
                    splatBuffersChanged = true;
                    break;
                }
            }
        }

        let isUpdateBuild = true;
        if (this.scenes.length !== 1 ||
            this.lastBuildSceneCount !== this.scenes.length ||
            this.lastBuildMaxSplatCount !== maxSplatCount ||
            splatBuffersChanged) {
                isUpdateBuild = false;
       }

       if (!isUpdateBuild) {
            this.boundingBox = new THREE.Box3();
            if (!preserveVisibleRegion) {
                this.maxSplatDistanceFromSceneCenter = 0;
                this.visibleRegionBufferRadius = 0;
                this.visibleRegionRadius = 0;
                this.visibleRegionFadeStartRadius = 0;
                this.firstRenderTime = -1;
            }
            this.lastBuildScenes = [];
            this.lastBuildSplatCount = 0;
            this.lastBuildMaxSplatCount = 0;
            this.disposeMeshData();
            this.geometry = SplatGeometry.build(maxSplatCount);
            if (this.splatRenderMode === SplatRenderMode.ThreeD) {
                this.material = SplatMaterial3D.build(this.dynamicMode, this.enableOptionalEffects, this.antialiased,
                                                      this.maxScreenSpaceSplatSize, this.splatScale, this.pointCloudModeEnabled,
                                                      this.minSphericalHarmonicsDegree, this.kernel2DSize, this.useFlameModel);
            } else {
                this.material = SplatMaterial2D.build(this.dynamicMode, this.enableOptionalEffects,
                                                      this.splatScale, this.pointCloudModeEnabled, this.minSphericalHarmonicsDegree);
            }

            const indexMaps = SplatMesh.buildSplatIndexMaps(splatBuffers);
            this.globalSplatIndexToLocalSplatIndexMap = indexMaps.localSplatIndexMap;
            this.globalSplatIndexToSceneIndexMap = indexMaps.sceneIndexMap;
        }

        const splatBufferSplatCount = this.getSplatCount(true);
        if (this.enableDistancesComputationOnGPU) this.setupDistancesComputationTransformFeedback();
        const dataUpdateResults = this.refreshGPUDataFromSplatBuffers(isUpdateBuild);

        for (let i = 0; i < this.scenes.length; i++) {
            this.lastBuildScenes[i] = this.scenes[i];
        }
        this.lastBuildSplatCount = splatBufferSplatCount;
        this.lastBuildMaxSplatCount = this.getMaxSplatCount();
        this.lastBuildSceneCount = this.scenes.length;

        // if (finalBuild && this.scenes.length > 0) {
        //     this.buildSplatTree(sceneOptions.map(options => options.splatAlphaRemovalThreshold || 1),
        //                         onSplatTreeIndexesUpload, onSplatTreeConstruction)
        //     .then(() => {
        //         if (this.onSplatTreeReadyCallback) this.onSplatTreeReadyCallback(this.splatTree);
        //         this.onSplatTreeReadyCallback = null;
        //     });
        // }

        this.visible = (this.scenes.length > 0);

        return dataUpdateResults;
    }

    freeIntermediateSplatData() {

        const deleteTextureData = (texture) => {
            delete texture.source.data;
            delete texture.image;
            texture.onUpdate = null;
        };

        delete this.splatDataTextures.baseData.covariances;
        delete this.splatDataTextures.baseData.centers;
        delete this.splatDataTextures.baseData.colors;
        delete this.splatDataTextures.baseData.sphericalHarmonics;

        delete this.splatDataTextures.centerColors.data;
        delete this.splatDataTextures.covariances.data;
        if (this.splatDataTextures.sphericalHarmonics) {
            delete this.splatDataTextures.sphericalHarmonics.data;
        }
        if (this.splatDataTextures.sceneIndexes) {
            delete this.splatDataTextures.sceneIndexes.data;
        }

        this.splatDataTextures.centerColors.texture.needsUpdate = true;
        this.splatDataTextures.centerColors.texture.onUpdate = () => {
            deleteTextureData(this.splatDataTextures.centerColors.texture);
        };

        this.splatDataTextures.flameModelPosTexture.texture.needsUpdate = true;
        this.splatDataTextures.flameModelPosTexture.texture.onUpdate = () => {
            deleteTextureData(this.splatDataTextures.flameModelPosTexture.texture);
        };

        this.splatDataTextures.covariances.texture.needsUpdate = true;
        this.splatDataTextures.covariances.texture.onUpdate = () => {
            deleteTextureData(this.splatDataTextures.covariances.texture);
        };

        if (this.splatDataTextures.sphericalHarmonics) {
            if (this.splatDataTextures.sphericalHarmonics.texture) {
                this.splatDataTextures.sphericalHarmonics.texture.needsUpdate = true;
                this.splatDataTextures.sphericalHarmonics.texture.onUpdate = () => {
                    deleteTextureData(this.splatDataTextures.sphericalHarmonics.texture);
                };
            } else {
                this.splatDataTextures.sphericalHarmonics.textures.forEach((texture) => {
                    texture.needsUpdate = true;
                    texture.onUpdate = () => {
                        deleteTextureData(texture);
                    };
                });
            }
        }
        if (this.splatDataTextures.sceneIndexes) {
            this.splatDataTextures.sceneIndexes.texture.needsUpdate = true;
            this.splatDataTextures.sceneIndexes.texture.onUpdate = () => {
                deleteTextureData(this.splatDataTextures.sceneIndexes.texture);
            };
        }
    }
    /**
     * Dispose all resources held by the splat mesh
     */
    dispose() {
        this.disposeMeshData();
        this.disposeTextures();
        this.disposeSplatTree();
        if (this.enableDistancesComputationOnGPU) {
            if (this.computeDistancesOnGPUSyncTimeout) {
                clearTimeout(this.computeDistancesOnGPUSyncTimeout);
                this.computeDistancesOnGPUSyncTimeout = null;
            }
            this.disposeDistancesComputationGPUResources();
        }
        this.scenes = [];
        this.distancesTransformFeedback = {
            'id': null,
            'vertexShader': null,
            'fragmentShader': null,
            'program': null,
            'centersBuffer': null,
            'sceneIndexesBuffer': null,
            'outDistancesBuffer': null,
            'centersLoc': -1,
            'modelViewProjLoc': -1,
            'sceneIndexesLoc': -1,
            'transformsLocs': []
        };
        this.renderer = null;

        this.globalSplatIndexToLocalSplatIndexMap = [];
        this.globalSplatIndexToSceneIndexMap = [];

        this.lastBuildSplatCount = 0;
        this.lastBuildScenes = [];
        this.lastBuildMaxSplatCount = 0;
        this.lastBuildSceneCount = 0;
        this.firstRenderTime = -1;
        this.finalBuild = false;

        this.webGLUtils = null;

        this.boundingBox = new THREE.Box3();
        this.calculatedSceneCenter = new THREE.Vector3();
        this.maxSplatDistanceFromSceneCenter = 0;
        this.visibleRegionBufferRadius = 0;
        this.visibleRegionRadius = 0;
        this.visibleRegionFadeStartRadius = 0;
        this.visibleRegionChanging = false;

        this.splatScale = 1.0;
        this.pointCloudModeEnabled = false;

        this.disposed = true;
        this.lastRenderer = null;
        this.visible = false;
    }

    /**
     * Dispose of only the Three.js mesh resources (geometry, material, and texture)
     */
    disposeMeshData() {
        if (this.geometry && this.geometry !== dummyGeometry) {
            this.geometry.dispose();
            this.geometry = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
    }

    disposeTextures() {
        for (let textureKey in this.splatDataTextures) {
            if (Object.hasOwn(this.splatDataTextures, textureKey)) {
                const textureContainer = this.splatDataTextures[textureKey];
                if (textureContainer.texture) {
                    textureContainer.texture.dispose();
                    textureContainer.texture = null;
                }
            }
        }
        this.splatDataTextures = null;
    }

    disposeSplatTree() {
        if (this.splatTree) {
            this.splatTree.dispose();
            this.splatTree = null;
        }
        if (this.baseSplatTree) {
            this.baseSplatTree.dispose();
            this.baseSplatTree = null;
        }
    }

    getSplatTree() {
        return this.splatTree;
    }

    onSplatTreeReady(callback) {
        this.onSplatTreeReadyCallback = callback;
    }

    /**
     * Get copies of data that are necessary for splat distance computation: splat center positions and splat
     * scene indexes (necessary for applying dynamic scene transformations during distance computation)
     * @param {*} start The index at which to start copying data
     * @param {*} end  The index at which to stop copying data
     * @return {object}
     */
    getDataForDistancesComputation(start, end) {
        const centers = this.integerBasedDistancesComputation ?
                        this.getIntegerCenters(start, end, true) :
                        this.getFloatCenters(start, end, true);
        const sceneIndexes = this.getSceneIndexes(start, end);
        return {
            centers,
            sceneIndexes
        };
    }

    /**
     * Refresh data textures and GPU buffers with splat data from the splat buffers belonging to this mesh.
     * @param {boolean} sinceLastBuildOnly Specify whether or not to only update for splats that have been added since the last build.
     * @return {object}
     */
    refreshGPUDataFromSplatBuffers(sinceLastBuildOnly) {
        const splatCount = this.getSplatCount(true);
        this.refreshDataTexturesFromSplatBuffers(sinceLastBuildOnly);
        const updateStart = sinceLastBuildOnly ? this.lastBuildSplatCount : 0;
        const { centers, sceneIndexes } = this.getDataForDistancesComputation(updateStart, splatCount - 1);
        if (this.enableDistancesComputationOnGPU) {
            this.refreshGPUBuffersForDistancesComputation(centers, sceneIndexes, sinceLastBuildOnly);
        }
        return {
            'from': updateStart,
            'to': splatCount - 1,
            'count': splatCount - updateStart,
            'centers': centers,
            'sceneIndexes': sceneIndexes
        };
    }

    /**
     * Update the GPU buffers that are used for computing splat distances on the GPU.
     * @param {Array<number>} centers Splat center positions
     * @param {Array<number>} sceneIndexes Indexes of the scene to which each splat belongs
     * @param {boolean} sinceLastBuildOnly Specify whether or not to only update for splats that have been added since the last build.
     */
    refreshGPUBuffersForDistancesComputation(centers, sceneIndexes, sinceLastBuildOnly = false) {
        const offset = sinceLastBuildOnly ? this.lastBuildSplatCount : 0;
        this.updateGPUCentersBufferForDistancesComputation(sinceLastBuildOnly, centers, offset);
        this.updateGPUTransformIndexesBufferForDistancesComputation(sinceLastBuildOnly, sceneIndexes, offset);
    }

    /**
     * Refresh data textures with data from the splat buffers for this mesh.
     * @param {boolean} sinceLastBuildOnly Specify whether or not to only update for splats that have been added since the last build.
     */
    refreshDataTexturesFromSplatBuffers(sinceLastBuildOnly) {
        const splatCount = this.getSplatCount(true);
        const fromSplat = this.lastBuildSplatCount;
        const toSplat = splatCount - 1;

        if (!sinceLastBuildOnly) {
            this.setupDataTextures();
            this.updateBaseDataFromSplatBuffers();
        } else {
            this.updateBaseDataFromSplatBuffers(fromSplat, toSplat);
        }

        this.updateDataTexturesFromBaseData(fromSplat, toSplat);
        this.updateVisibleRegion(sinceLastBuildOnly);
    }

    setupDataTextures() {
        const maxSplatCount = this.getMaxSplatCount();
        const splatCount = this.getSplatCount(true);

        this.disposeTextures();

        const computeDataTextureSize = (elementsPerTexel, elementsPerSplat) => {
            const texSize = new THREE.Vector2(4096, 1024);
            while (texSize.x * texSize.y * elementsPerTexel < maxSplatCount * elementsPerSplat) texSize.y *= 2;
            return texSize;
        };

        const getCovariancesElementsPertexelStored = (compressionLevel) => {
            return compressionLevel >= 1 ? COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_STORED : COVARIANCES_ELEMENTS_PER_TEXEL_STORED;
        };

        const getCovariancesInitialTextureSpecs = (compressionLevel) => {
            const elementsPerTexelStored = getCovariancesElementsPertexelStored(compressionLevel);
            const texSize = computeDataTextureSize(elementsPerTexelStored, 6);
            return {elementsPerTexelStored, texSize};
        };

        let covarianceCompressionLevel = this.getTargetCovarianceCompressionLevel();
        const scaleRotationCompressionLevel = 0;
        const shCompressionLevel = this.getTargetSphericalHarmonicsCompressionLevel();

        let covariances;
        let scales;
        let rotations;
        if (this.splatRenderMode === SplatRenderMode.ThreeD) {
            const initialCovTexSpecs = getCovariancesInitialTextureSpecs(covarianceCompressionLevel);
            if (initialCovTexSpecs.texSize.x * initialCovTexSpecs.texSize.y > MAX_TEXTURE_TEXELS && covarianceCompressionLevel === 0) {
                covarianceCompressionLevel = 1;
            }
            covariances = new Float32Array(maxSplatCount * COVARIANCES_ELEMENTS_PER_SPLAT);
        } else {
            scales = new Float32Array(maxSplatCount * 3);
            rotations = new Float32Array(maxSplatCount * 4);
        }

        const centers = new Float32Array(maxSplatCount * 3);
        const colors = new Uint8Array(maxSplatCount * 4);

        let SphericalHarmonicsArrayType = Float32Array;
        if (shCompressionLevel === 1) SphericalHarmonicsArrayType = Uint16Array;
        else if (shCompressionLevel === 2) SphericalHarmonicsArrayType = Uint8Array;
        const shComponentCount = getSphericalHarmonicsComponentCountForDegree(this.minSphericalHarmonicsDegree);
        const shData = this.minSphericalHarmonicsDegree ? new SphericalHarmonicsArrayType(maxSplatCount * shComponentCount) : undefined;

        // set up centers/colors data texture
        const centersColsTexSize = computeDataTextureSize(CENTER_COLORS_ELEMENTS_PER_TEXEL, 4);
        const paddedCentersCols = new Uint32Array(centersColsTexSize.x * centersColsTexSize.y * CENTER_COLORS_ELEMENTS_PER_TEXEL);
        SplatMesh.updateCenterColorsPaddedData(0, splatCount - 1, centers, colors, paddedCentersCols);

        const centersColsTex = new THREE.DataTexture(paddedCentersCols, centersColsTexSize.x, centersColsTexSize.y,
                                                     THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
        centersColsTex.internalFormat = 'RGBA32UI';
        centersColsTex.needsUpdate = true;
        this.material.uniforms.centersColorsTexture.value = centersColsTex;
        this.material.uniforms.centersColorsTextureSize.value.copy(centersColsTexSize);
        this.material.uniformsNeedUpdate = true;

        this.splatDataTextures = {
            'baseData': {
                'covariances': covariances,
                'scales': scales,
                'rotations': rotations,
                'centers': centers,
                'colors': colors,
                'sphericalHarmonics': shData
            },
            'centerColors': {
                'data': paddedCentersCols,
                'texture': centersColsTex,
                'size': centersColsTexSize
            }
        };

        if (this.splatRenderMode === SplatRenderMode.ThreeD) {
            // set up covariances data texture

            const covTexSpecs = getCovariancesInitialTextureSpecs(covarianceCompressionLevel);
            const covariancesElementsPerTexelStored = covTexSpecs.elementsPerTexelStored;
            const covTexSize = covTexSpecs.texSize;

            let CovariancesDataType = covarianceCompressionLevel >= 1 ? Uint32Array : Float32Array;
            const covariancesElementsPerTexelAllocated = covarianceCompressionLevel >= 1 ?
                                                         COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_ALLOCATED :
                                                         COVARIANCES_ELEMENTS_PER_TEXEL_ALLOCATED;
            const covariancesTextureData = new CovariancesDataType(covTexSize.x * covTexSize.y * covariancesElementsPerTexelAllocated);

            if (covarianceCompressionLevel === 0) {
                covariancesTextureData.set(covariances);
            } else {
                SplatMesh.updatePaddedCompressedCovariancesTextureData(covariances, covariancesTextureData, 0, 0, covariances.length);
            }

            let covTex;
            if (covarianceCompressionLevel >= 1) {
                covTex = new THREE.DataTexture(covariancesTextureData, covTexSize.x, covTexSize.y,
                                               THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
                covTex.internalFormat = 'RGBA32UI';
                this.material.uniforms.covariancesTextureHalfFloat.value = covTex;
            } else {
                covTex = new THREE.DataTexture(covariancesTextureData, covTexSize.x, covTexSize.y, THREE.RGBAFormat, THREE.FloatType);
                this.material.uniforms.covariancesTexture.value = covTex;

                // For some reason a usampler2D needs to have a valid texture attached or WebGL complains
                const dummyTex = new THREE.DataTexture(new Uint32Array(32), 2, 2, THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
                dummyTex.internalFormat = 'RGBA32UI';
                this.material.uniforms.covariancesTextureHalfFloat.value = dummyTex;
                dummyTex.needsUpdate = true;
            }
            covTex.needsUpdate = true;

            this.material.uniforms.covariancesAreHalfFloat.value = (covarianceCompressionLevel >= 1) ? 1 : 0;
            this.material.uniforms.covariancesTextureSize.value.copy(covTexSize);

            this.splatDataTextures['covariances'] = {
                'data': covariancesTextureData,
                'texture': covTex,
                'size': covTexSize,
                'compressionLevel': covarianceCompressionLevel,
                'elementsPerTexelStored': covariancesElementsPerTexelStored,
                'elementsPerTexelAllocated': covariancesElementsPerTexelAllocated
            };
        } else {
            // set up scale & rotations data texture
            const elementsPerSplat = 6;
            const scaleRotationsTexSize = computeDataTextureSize(SCALES_ROTATIONS_ELEMENTS_PER_TEXEL, elementsPerSplat);
            let ScaleRotationsDataType = Float32Array;
            let scaleRotationsTextureType = THREE.FloatType;
            const paddedScaleRotations = new ScaleRotationsDataType(scaleRotationsTexSize.x * scaleRotationsTexSize.y *
                                                                    SCALES_ROTATIONS_ELEMENTS_PER_TEXEL);

            SplatMesh.updateScaleRotationsPaddedData(0, splatCount - 1, scales, rotations, paddedScaleRotations);

            const scaleRotationsTex = new THREE.DataTexture(paddedScaleRotations, scaleRotationsTexSize.x, scaleRotationsTexSize.y,
                                                            THREE.RGBAFormat, scaleRotationsTextureType);
            scaleRotationsTex.needsUpdate = true;
            this.material.uniforms.scaleRotationsTexture.value = scaleRotationsTex;
            this.material.uniforms.scaleRotationsTextureSize.value.copy(scaleRotationsTexSize);

            this.splatDataTextures['scaleRotations'] = {
                'data': paddedScaleRotations,
                'texture': scaleRotationsTex,
                'size': scaleRotationsTexSize,
                'compressionLevel': scaleRotationCompressionLevel
            };
        }

        if (shData) {
            const shTextureType = shCompressionLevel === 2 ? THREE.UnsignedByteType : THREE.HalfFloatType;

            let paddedSHComponentCount = shComponentCount;
            if (paddedSHComponentCount % 2 !== 0) paddedSHComponentCount++;
            const shElementsPerTexel = this.minSphericalHarmonicsDegree === 2 ? 4 : 2;
            const texelFormat = shElementsPerTexel === 4 ? THREE.RGBAFormat : THREE.RGFormat;
            let shTexSize = computeDataTextureSize(shElementsPerTexel, paddedSHComponentCount);

            // Use one texture for all spherical harmonics data
            if (shTexSize.x * shTexSize.y <= MAX_TEXTURE_TEXELS) {
                const paddedSHArraySize = shTexSize.x * shTexSize.y * shElementsPerTexel;
                const paddedSHArray = new SphericalHarmonicsArrayType(paddedSHArraySize);
                for (let c = 0; c < splatCount; c++) {
                    const srcBase = shComponentCount * c;
                    const destBase = paddedSHComponentCount * c;
                    for (let i = 0; i < shComponentCount; i++) {
                        paddedSHArray[destBase + i] = shData[srcBase + i];
                    }
                }

                const shTexture = new THREE.DataTexture(paddedSHArray, shTexSize.x, shTexSize.y, texelFormat, shTextureType);
                shTexture.needsUpdate = true;
                this.material.uniforms.sphericalHarmonicsTexture.value = shTexture;
                this.splatDataTextures['sphericalHarmonics'] = {
                    'componentCount': shComponentCount,
                    'paddedComponentCount': paddedSHComponentCount,
                    'data': paddedSHArray,
                    'textureCount': 1,
                    'texture': shTexture,
                    'size': shTexSize,
                    'compressionLevel': shCompressionLevel,
                    'elementsPerTexel': shElementsPerTexel
                };
            // Use three textures for spherical harmonics data, one per color channel
            } else {
                const shComponentCountPerChannel = shComponentCount / 3;
                paddedSHComponentCount = shComponentCountPerChannel;
                if (paddedSHComponentCount % 2 !== 0) paddedSHComponentCount++;
                shTexSize = computeDataTextureSize(shElementsPerTexel, paddedSHComponentCount);

                const paddedSHArraySize = shTexSize.x * shTexSize.y * shElementsPerTexel;
                const textureUniforms = [this.material.uniforms.sphericalHarmonicsTextureR,
                                         this.material.uniforms.sphericalHarmonicsTextureG,
                                         this.material.uniforms.sphericalHarmonicsTextureB];
                const paddedSHArrays = [];
                const shTextures = [];
                for (let t = 0; t < 3; t++) {
                    const paddedSHArray = new SphericalHarmonicsArrayType(paddedSHArraySize);
                    paddedSHArrays.push(paddedSHArray);
                    for (let c = 0; c < splatCount; c++) {
                        const srcBase = shComponentCount * c;
                        const destBase = paddedSHComponentCount * c;
                        if (shComponentCountPerChannel >= 3) {
                            for (let i = 0; i < 3; i++) paddedSHArray[destBase + i] = shData[srcBase + t * 3 + i];
                            if (shComponentCountPerChannel >= 8) {
                                for (let i = 0; i < 5; i++) paddedSHArray[destBase + 3 + i] = shData[srcBase + 9 + t * 5 + i];
                            }
                        }
                    }

                    const shTexture = new THREE.DataTexture(paddedSHArray, shTexSize.x, shTexSize.y, texelFormat, shTextureType);
                    shTextures.push(shTexture);
                    shTexture.needsUpdate = true;
                    textureUniforms[t].value = shTexture;
                }

                this.material.uniforms.sphericalHarmonicsMultiTextureMode.value = 1;
                this.splatDataTextures['sphericalHarmonics'] = {
                    'componentCount': shComponentCount,
                    'componentCountPerChannel': shComponentCountPerChannel,
                    'paddedComponentCount': paddedSHComponentCount,
                    'data': paddedSHArrays,
                    'textureCount': 3,
                    'textures': shTextures,
                    'size': shTexSize,
                    'compressionLevel': shCompressionLevel,
                    'elementsPerTexel': shElementsPerTexel
                };
            }

            this.material.uniforms.sphericalHarmonicsTextureSize.value.copy(shTexSize);
            this.material.uniforms.sphericalHarmonics8BitMode.value = shCompressionLevel === 2 ? 1 : 0;
            for (let s = 0; s < this.scenes.length; s++) {
                const splatBuffer = this.scenes[s].splatBuffer;
                this.material.uniforms.sphericalHarmonics8BitCompressionRangeMin.value[s] =
                    splatBuffer.minSphericalHarmonicsCoeff;
                this.material.uniforms.sphericalHarmonics8BitCompressionRangeMax.value[s] =
                    splatBuffer.maxSphericalHarmonicsCoeff;
            }
            this.material.uniformsNeedUpdate = true;
        }

        const sceneIndexesTexSize = computeDataTextureSize(SCENE_INDEXES_ELEMENTS_PER_TEXEL, 4);
        const paddedTransformIndexes = new Uint32Array(sceneIndexesTexSize.x *
                                                       sceneIndexesTexSize.y * SCENE_INDEXES_ELEMENTS_PER_TEXEL);
        for (let c = 0; c < splatCount; c++) paddedTransformIndexes[c] = this.globalSplatIndexToSceneIndexMap[c];
        const sceneIndexesTexture = new THREE.DataTexture(paddedTransformIndexes, sceneIndexesTexSize.x, sceneIndexesTexSize.y,
                                                          THREE.RedIntegerFormat, THREE.UnsignedIntType);
        sceneIndexesTexture.internalFormat = 'R32UI';
        sceneIndexesTexture.needsUpdate = true;
        this.material.uniforms.sceneIndexesTexture.value = sceneIndexesTexture;
        this.material.uniforms.sceneIndexesTextureSize.value.copy(sceneIndexesTexSize);
        this.material.uniformsNeedUpdate = true;
        this.splatDataTextures['sceneIndexes'] = {
            'data': paddedTransformIndexes,
            'texture': sceneIndexesTexture,
            'size': sceneIndexesTexSize
        };
        this.material.uniforms.sceneCount.value = this.scenes.length;

        this.expressionBSNum = this.flameModel.geometry.morphAttributes.position.length;
        this.material.uniforms.bsCount.value = this.expressionBSNum;

        this.flameModel.skeleton.bones.forEach((bone, index) => {
            if (bone.name == 'head')
                this.material.uniforms.headBoneIndex.value = index;
          });

        this.buildModelTexture(this.flameModel);
        this.buildBoneMatrixTexture();
        if(this.useFlameModel) {
            this.buildBoneWeightTexture(this.flameModel);
        }
    }

    buildBoneMatrixTexture() {
        if (!this.bsWeight)
            return
        //this.bonesNum + this.expressionBSNum / 4 = 30, so 32
        const boneTextureSize = new THREE.Vector2(4, 32);
        let boneMatrixTextureData = new Float32Array(this.bonesMatrix);
        let boneMatrixTextureDataInt = new Uint32Array(boneTextureSize.x * boneTextureSize.y * 4);
        this.morphTargetDictionary = this.flameModel.morphTargetDictionary;

        if(this.useFlameModel) {
            for (let c = 0; c < this.bonesNum * 16; c++) {
                boneMatrixTextureDataInt[c] = uintEncodedFloat$1(boneMatrixTextureData[c]);
            }
            if (this.flameModel && this.flameModel.skeleton) {
                this.material.uniforms.boneTexture0.value = this.flameModel.skeleton.boneTexture;
                this.material.uniforms.bindMatrix.value = this.flameModel.bindMatrix;
                this.material.uniforms.bindMatrixInverse.value = this.flameModel.bindMatrixInverse;
            }
        }
        for (const key in this.bsWeight) {
            if (Object.hasOwn(this.bsWeight, key)) {
                const value = this.bsWeight[key];
                const idx = this.morphTargetDictionary[key];
                boneMatrixTextureDataInt[idx + this.bonesNum * 16] = uintEncodedFloat$1(value);
            }
        }

        // for (let c = 0; c < this.bsWeight.length; c++) {
        //     this.morphTargetDictionary
        //     boneMatrixTextureDataInt[c + this.bonesNum * 16] = uintEncodedFloat(this.bsWeight[c]);
        // }

        const boneMatrixTex = new THREE.DataTexture(boneMatrixTextureDataInt, boneTextureSize.x, boneTextureSize.y,
                                                     THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
        boneMatrixTex.internalFormat = 'RGBA32UI';
        boneMatrixTex.needsUpdate = true;
        this.material.uniforms.boneTexture.value = boneMatrixTex;
        this.material.uniforms.boneTextureSize.value.copy(boneTextureSize);

        this.material.uniformsNeedUpdate = true;

        this.splatDataTextures['boneMatrix'] = {
            'data': boneMatrixTextureDataInt,
            'texture': boneMatrixTex,
            'size': boneTextureSize,
        };
        this.splatDataTextures.baseData['boneMatrix'] = boneMatrixTextureDataInt;
    }

    updateBoneMatrixTexture(updateFlameBoneMatrix = false) {
        if (!this.bsWeight || !this.morphTargetDictionary)
            return

        if(updateFlameBoneMatrix == true) {
            let boneMatrixTextureData = new Float32Array(this.bonesMatrix);
            for (let c = 0; c < this.bonesNum * 16; c++) {
                this.splatDataTextures.baseData['boneMatrix'][c] = uintEncodedFloat$1(boneMatrixTextureData[c]);
            }
        }

        for (const key in this.bsWeight) {
            if (Object.hasOwn(this.bsWeight, key)) {
                const value = this.bsWeight[key];
                const idx = this.morphTargetDictionary[key];
                this.splatDataTextures.baseData['boneMatrix'][idx + this.bonesNum * 16] = uintEncodedFloat$1(value);
            }
        }

        // for (let c = 0; c < this.bsWeight.length; c++) {
        //     this.splatDataTextures.baseData['boneMatrix'][c + this.bonesNum * 16] = uintEncodedFloat(this.bsWeight[c]);
        // }
        this.splatDataTextures['boneMatrix']['texture'].data = this.splatDataTextures.baseData['boneMatrix'];
        
        this.splatDataTextures['boneMatrix']['texture'].needsUpdate = true;
        this.material.uniforms.boneTexture.value = this.splatDataTextures['boneMatrix']['texture'];

        if (this.flameModel.skeleton) {
            this.material.uniforms.boneTexture0.value = this.flameModel.skeleton.boneTexture;
            this.material.uniforms.bindMatrix.value = this.flameModel.bindMatrix;
            this.material.uniforms.bindMatrixInverse.value = this.flameModel.bindMatrixInverse;
        }
        
        this.material.uniformsNeedUpdate = true;
    }

    buildBoneWeightTexture(flameModel) {
        let shapedMesh = flameModel.geometry.attributes.position.array;

        let pointNum = shapedMesh.length / 3;
        const boneWeightTextureSize = new THREE.Vector2(512, 512);
        let boneWeightTextureData = new Float32Array(boneWeightTextureSize.x * boneWeightTextureSize.y * 4);
        let boneWeightTextureDataInt = new Uint32Array(boneWeightTextureSize.x * boneWeightTextureSize.y * 4);
        for (let i = 0; i < pointNum; i++) {
            boneWeightTextureData[i * 8 + 0] = this.bonesWeight[i][0];
            boneWeightTextureData[i * 8 + 1] = this.bonesWeight[i][1];
            boneWeightTextureData[i * 8 + 2] = this.bonesWeight[i][2];
            boneWeightTextureData[i * 8 + 3] = this.bonesWeight[i][3];
            boneWeightTextureData[i * 8 + 4] = this.bonesWeight[i][4];

            boneWeightTextureDataInt[i * 8 + 0] = uintEncodedFloat$1(this.bonesWeight[i][0]);
            boneWeightTextureDataInt[i * 8 + 1] = uintEncodedFloat$1(this.bonesWeight[i][1]);
            boneWeightTextureDataInt[i * 8 + 2] = uintEncodedFloat$1(this.bonesWeight[i][2]);
            boneWeightTextureDataInt[i * 8 + 3] = uintEncodedFloat$1(this.bonesWeight[i][3]);
            boneWeightTextureDataInt[i * 8 + 4] = uintEncodedFloat$1(this.bonesWeight[i][4]);

        }
        const boneWeightTex = new THREE.DataTexture(boneWeightTextureDataInt, boneWeightTextureSize.x, boneWeightTextureSize.y,
                                                     THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
        
        boneWeightTex.internalFormat = 'RGBA32UI';
        boneWeightTex.needsUpdate = true;
        this.material.uniforms.boneWeightTexture.value = boneWeightTex;
        this.material.uniforms.boneWeightTextureSize.value.copy(boneWeightTextureSize);
        this.material.uniformsNeedUpdate = true;

        this.splatDataTextures['boneWeight'] = {
            'data': boneWeightTextureDataInt,
            'texture': boneWeightTex,
            'size': boneWeightTextureSize,
        };
        this.splatDataTextures.baseData['boneWeight'] = boneWeightTextureDataInt;
    }


    buildModelTexture(flameModel) {
        const flameModelTexSize = new THREE.Vector2(4096, 2048);

        var shapedMesh = flameModel.geometry.attributes.position.array;
        var shapedMeshArray = [];//Array.from(shapedMesh);
        let pointNum = shapedMesh.length / 3;

        let bsLength = flameModel.geometry.morphAttributes.position.length;

        const morphTargetNames = Object.keys(flameModel.morphTargetDictionary);
        // if (this.useFlameModel == false) {
        //     morphTargetNames.sort(); 
        // }
        morphTargetNames.forEach((name, newIndex) => {
            const originalIndex = flameModel.morphTargetDictionary[name];
            var bsMesh = flameModel.geometry.morphAttributes.position[originalIndex];
            shapedMeshArray = shapedMeshArray.concat(Array.from(bsMesh.array));
            
          });
        shapedMeshArray = shapedMeshArray.concat(Array.from(shapedMesh));

        let flameModelData = new Float32Array(flameModelTexSize.x * flameModelTexSize.y * 4);
        let flameModelDataInt = new Uint32Array(flameModelTexSize.x * flameModelTexSize.y * 4);
        for (let c = 0; c < pointNum * (bsLength + 1); c++) {
            flameModelData[c * 4 + 0] = shapedMeshArray[c * 3 + 0];
            flameModelData[c * 4 + 1] = shapedMeshArray[c * 3 + 1];
            flameModelData[c * 4 + 2] = shapedMeshArray[c * 3 + 2];

            flameModelDataInt[c * 4 + 0] = uintEncodedFloat$1(flameModelData[c * 4 + 0]);
            flameModelDataInt[c * 4 + 1] = uintEncodedFloat$1(flameModelData[c * 4 + 1]);
            flameModelDataInt[c * 4 + 2] = uintEncodedFloat$1(flameModelData[c * 4 + 2]);
        }

        const flameModelTex = new THREE.DataTexture(flameModelDataInt, flameModelTexSize.x, flameModelTexSize.y,
                                                     THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
        flameModelTex.internalFormat = 'RGBA32UI';
        flameModelTex.needsUpdate = true;
        this.material.uniforms.flameModelTexture.value = flameModelTex;
        this.material.uniforms.flameModelTextureSize.value.copy(flameModelTexSize);
        this.material.uniformsNeedUpdate = true;
        this.material.uniforms.gaussianSplatCount.value = this.gaussianSplatCount;

        this.splatDataTextures['flameModel'] = {
            'data': flameModelDataInt,
            'texture': flameModelTex,
            'size': flameModelTexSize,
        };
        this.splatDataTextures.baseData['flameModelPos'] = flameModelData;
    }

    updateTetureAfterBSAndSkeleton(fromSplat, toSplat, useFlameModel = true) {
        const sceneTransform = new THREE.Matrix4();

        this.getSceneTransform(0, sceneTransform);
        this.getScene(0).splatBuffer.fillSplatCenterArray(this.morphedMesh, this.splatDataTextures.baseData.centers, sceneTransform, fromSplat, toSplat, 0);

        // Update center & color data texture
        const centerColorsTextureDescriptor = this.splatDataTextures['centerColors'];
        const paddedCenterColors = centerColorsTextureDescriptor.data;
        const centerColorsTexture = centerColorsTextureDescriptor.texture;
        SplatMesh.updateCenterColorsPaddedData(fromSplat, toSplat, this.splatDataTextures.baseData.centers,
                                                this.splatDataTextures.baseData.colors, paddedCenterColors);
        const centerColorsTextureProps = this.renderer ? this.renderer.properties.get(centerColorsTexture) : null;
        if (!centerColorsTextureProps || !centerColorsTextureProps.__webglTexture) {
            centerColorsTexture.needsUpdate = true;
        } else {
            this.updateDataTexture(paddedCenterColors, centerColorsTextureDescriptor.texture, centerColorsTextureDescriptor.size,
                                    centerColorsTextureProps, CENTER_COLORS_ELEMENTS_PER_TEXEL, CENTER_COLORS_ELEMENTS_PER_SPLAT, 4,
                                    fromSplat, toSplat);
        }

        this.updateBoneMatrixTexture(useFlameModel);
    }

    updateBaseDataFromSplatBuffers(fromSplat, toSplat) {
        const covarancesTextureDesc = this.splatDataTextures['covariances'];
        const covarianceCompressionLevel = covarancesTextureDesc ? covarancesTextureDesc.compressionLevel : undefined;
        const scaleRotationsTextureDesc = this.splatDataTextures['scaleRotations'];
        const scaleRotationCompressionLevel = scaleRotationsTextureDesc ? scaleRotationsTextureDesc.compressionLevel : undefined;
        const shITextureDesc = this.splatDataTextures['sphericalHarmonics'];
        const shCompressionLevel = shITextureDesc ? shITextureDesc.compressionLevel : 0;

        this.fillSplatDataArrays(this.splatDataTextures.baseData.covariances, this.splatDataTextures.baseData.scales,
                                 this.splatDataTextures.baseData.rotations, this.splatDataTextures.baseData.centers,
                                 this.splatDataTextures.baseData.colors, this.splatDataTextures.baseData.sphericalHarmonics, 
                                 this.splatDataTextures.baseData.flameModelPos,
                                 undefined,
                                 covarianceCompressionLevel, scaleRotationCompressionLevel, shCompressionLevel,
                                 fromSplat, toSplat, fromSplat);
    }

    updateDataTexturesFromBaseData(fromSplat, toSplat) {
        const covarancesTextureDesc = this.splatDataTextures['covariances'];
        const covarianceCompressionLevel = covarancesTextureDesc ? covarancesTextureDesc.compressionLevel : undefined;
        const scaleRotationsTextureDesc = this.splatDataTextures['scaleRotations'];
        const scaleRotationCompressionLevel = scaleRotationsTextureDesc ? scaleRotationsTextureDesc.compressionLevel : undefined;
        const shTextureDesc = this.splatDataTextures['sphericalHarmonics'];
        const shCompressionLevel = shTextureDesc ? shTextureDesc.compressionLevel : 0;

        // Update flame data texture
        const flameModelTextureDescriptor = this.splatDataTextures['flameModel'];
        const flameModelPos = flameModelTextureDescriptor.data;
        const flameModelPosTexture = flameModelTextureDescriptor.texture;

        const flameModelPosTextureProps = this.renderer ? this.renderer.properties.get(flameModelPosTexture) : null;
        if (!flameModelPosTextureProps || !flameModelPosTextureProps.__webglTexture) {
            flameModelPosTexture.needsUpdate = true;
        } else {
            this.updateDataTexture(flameModelPos, flameModelTextureDescriptor.texture, flameModelTextureDescriptor.size,
                flameModelPosTextureProps, CENTER_COLORS_ELEMENTS_PER_TEXEL, CENTER_COLORS_ELEMENTS_PER_SPLAT, 3,
                                   fromSplat, toSplat);
        }

        // Update center & color data texture
        const centerColorsTextureDescriptor = this.splatDataTextures['centerColors'];
        const paddedCenterColors = centerColorsTextureDescriptor.data;
        const centerColorsTexture = centerColorsTextureDescriptor.texture;
        SplatMesh.updateCenterColorsPaddedData(fromSplat, toSplat, this.splatDataTextures.baseData.centers,
                                               this.splatDataTextures.baseData.colors, paddedCenterColors);
        const centerColorsTextureProps = this.renderer ? this.renderer.properties.get(centerColorsTexture) : null;
        if (!centerColorsTextureProps || !centerColorsTextureProps.__webglTexture) {
            centerColorsTexture.needsUpdate = true;
        } else {
            this.updateDataTexture(paddedCenterColors, centerColorsTextureDescriptor.texture, centerColorsTextureDescriptor.size,
                                   centerColorsTextureProps, CENTER_COLORS_ELEMENTS_PER_TEXEL, CENTER_COLORS_ELEMENTS_PER_SPLAT, 4,
                                   fromSplat, toSplat);
        }

        // update covariance data texture
        if (covarancesTextureDesc) {
            const covariancesTexture = covarancesTextureDesc.texture;
            const covarancesStartElement = fromSplat * COVARIANCES_ELEMENTS_PER_SPLAT;
            const covariancesEndElement = toSplat * COVARIANCES_ELEMENTS_PER_SPLAT;

            if (covarianceCompressionLevel === 0) {
                for (let i = covarancesStartElement; i <= covariancesEndElement; i++) {
                    const covariance = this.splatDataTextures.baseData.covariances[i];
                    covarancesTextureDesc.data[i] = covariance;
                }
            } else {
                SplatMesh.updatePaddedCompressedCovariancesTextureData(this.splatDataTextures.baseData.covariances,
                                                                       covarancesTextureDesc.data,
                                                                       fromSplat * covarancesTextureDesc.elementsPerTexelAllocated,
                                                                       covarancesStartElement, covariancesEndElement);
            }

            const covariancesTextureProps = this.renderer ? this.renderer.properties.get(covariancesTexture) : null;
            if (!covariancesTextureProps || !covariancesTextureProps.__webglTexture) {
                covariancesTexture.needsUpdate = true;
            } else {
                if (covarianceCompressionLevel === 0) {
                    this.updateDataTexture(covarancesTextureDesc.data, covarancesTextureDesc.texture, covarancesTextureDesc.size,
                                           covariancesTextureProps, covarancesTextureDesc.elementsPerTexelStored,
                                           COVARIANCES_ELEMENTS_PER_SPLAT, 4, fromSplat, toSplat);
                } else {
                    this.updateDataTexture(covarancesTextureDesc.data, covarancesTextureDesc.texture, covarancesTextureDesc.size,
                                           covariancesTextureProps, covarancesTextureDesc.elementsPerTexelAllocated,
                                           covarancesTextureDesc.elementsPerTexelAllocated, 2, fromSplat, toSplat);
                }
            }
        }

        // update scale and rotation data texture
        if (scaleRotationsTextureDesc) {
            const paddedScaleRotations = scaleRotationsTextureDesc.data;
            const scaleRotationsTexture = scaleRotationsTextureDesc.texture;
            const elementsPerSplat = 6;
            const bytesPerElement = scaleRotationCompressionLevel === 0 ? 4 : 2;

            SplatMesh.updateScaleRotationsPaddedData(fromSplat, toSplat, this.splatDataTextures.baseData.scales,
                                                     this.splatDataTextures.baseData.rotations, paddedScaleRotations);
            const scaleRotationsTextureProps = this.renderer ? this.renderer.properties.get(scaleRotationsTexture) : null;
            if (!scaleRotationsTextureProps || !scaleRotationsTextureProps.__webglTexture) {
                scaleRotationsTexture.needsUpdate = true;
            } else {
                this.updateDataTexture(paddedScaleRotations, scaleRotationsTextureDesc.texture, scaleRotationsTextureDesc.size,
                                       scaleRotationsTextureProps, SCALES_ROTATIONS_ELEMENTS_PER_TEXEL, elementsPerSplat, bytesPerElement,
                                       fromSplat, toSplat);
            }
        }

        // update spherical harmonics data texture
        const shData = this.splatDataTextures.baseData.sphericalHarmonics;
        if (shData) {
            let shBytesPerElement = 4;
            if (shCompressionLevel === 1) shBytesPerElement = 2;
            else if (shCompressionLevel === 2) shBytesPerElement = 1;

            const updateTexture = (shTexture, shTextureSize, elementsPerTexel, paddedSHArray, paddedSHComponentCount) => {
                const shTextureProps = this.renderer ? this.renderer.properties.get(shTexture) : null;
                if (!shTextureProps || !shTextureProps.__webglTexture) {
                    shTexture.needsUpdate = true;
                } else {
                    this.updateDataTexture(paddedSHArray, shTexture, shTextureSize, shTextureProps, elementsPerTexel,
                                           paddedSHComponentCount, shBytesPerElement, fromSplat, toSplat);
                }
            };

            const shComponentCount = shTextureDesc.componentCount;
            const paddedSHComponentCount = shTextureDesc.paddedComponentCount;

            // Update for the case of a single texture for all spherical harmonics data
            if (shTextureDesc.textureCount === 1) {
                const paddedSHArray = shTextureDesc.data;
                for (let c = fromSplat; c <= toSplat; c++) {
                    const srcBase = shComponentCount * c;
                    const destBase = paddedSHComponentCount * c;
                    for (let i = 0; i < shComponentCount; i++) {
                        paddedSHArray[destBase + i] = shData[srcBase + i];
                    }
                }
                updateTexture(shTextureDesc.texture, shTextureDesc.size,
                              shTextureDesc.elementsPerTexel, paddedSHArray, paddedSHComponentCount);
            // Update for the case of spherical harmonics data split among three textures, one for each color channel
            } else {
                const shComponentCountPerChannel = shTextureDesc.componentCountPerChannel;
                for (let t = 0; t < 3; t++) {
                    const paddedSHArray = shTextureDesc.data[t];
                    for (let c = fromSplat; c <= toSplat; c++) {
                        const srcBase = shComponentCount * c;
                        const destBase = paddedSHComponentCount * c;
                        if (shComponentCountPerChannel >= 3) {
                            for (let i = 0; i < 3; i++) paddedSHArray[destBase + i] = shData[srcBase + t * 3 + i];
                            if (shComponentCountPerChannel >= 8) {
                                for (let i = 0; i < 5; i++) paddedSHArray[destBase + 3 + i] = shData[srcBase + 9 + t * 5 + i];
                            }
                        }
                    }
                    updateTexture(shTextureDesc.textures[t], shTextureDesc.size,
                                  shTextureDesc.elementsPerTexel, paddedSHArray, paddedSHComponentCount);
                }
            }
        }

        // update scene index & transform data
        const sceneIndexesTexDesc = this.splatDataTextures['sceneIndexes'];
        const paddedSceneIndexes = sceneIndexesTexDesc.data;
        for (let c = this.lastBuildSplatCount; c <= toSplat; c++) {
            paddedSceneIndexes[c] = this.globalSplatIndexToSceneIndexMap[c];
        }
        const sceneIndexesTexture = sceneIndexesTexDesc.texture;
        const sceneIndexesTextureProps = this.renderer ? this.renderer.properties.get(sceneIndexesTexture) : null;
        if (!sceneIndexesTextureProps || !sceneIndexesTextureProps.__webglTexture) {
            sceneIndexesTexture.needsUpdate = true;
        } else {
            this.updateDataTexture(paddedSceneIndexes, sceneIndexesTexDesc.texture, sceneIndexesTexDesc.size,
                                   sceneIndexesTextureProps, 1, 1, 1, this.lastBuildSplatCount, toSplat);
        }
    }

    getTargetCovarianceCompressionLevel() {
        return this.halfPrecisionCovariancesOnGPU ? 1 : 0;
    }

    getTargetSphericalHarmonicsCompressionLevel() {
        return Math.max(1, this.getMaximumSplatBufferCompressionLevel());
    }

    getMaximumSplatBufferCompressionLevel() {
        let maxCompressionLevel;
        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.getScene(i);
            const splatBuffer = scene.splatBuffer;
            if (i === 0 || splatBuffer.compressionLevel > maxCompressionLevel) {
                maxCompressionLevel = splatBuffer.compressionLevel;
            }
        }
        return maxCompressionLevel;
    }

    getMinimumSplatBufferCompressionLevel() {
        let minCompressionLevel;
        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.getScene(i);
            const splatBuffer = scene.splatBuffer;
            if (i === 0 || splatBuffer.compressionLevel < minCompressionLevel) {
                minCompressionLevel = splatBuffer.compressionLevel;
            }
        }
        return minCompressionLevel;
    }

    static computeTextureUpdateRegion(startSplat, endSplat, textureWidth, elementsPerTexel, elementsPerSplat) {
        const texelsPerSplat = elementsPerSplat / elementsPerTexel;

        const startSplatTexels = startSplat * texelsPerSplat;
        const startRow = Math.floor(startSplatTexels / textureWidth);
        const startRowElement = startRow * textureWidth * elementsPerTexel;

        const endSplatTexels = endSplat * texelsPerSplat;
        const endRow = Math.floor(endSplatTexels / textureWidth);
        const endRowEndElement = endRow * textureWidth * elementsPerTexel + (textureWidth * elementsPerTexel);

        return {
            'dataStart': startRowElement,
            'dataEnd': endRowEndElement,
            'startRow': startRow,
            'endRow': endRow
        };
    }

    updateDataTexture(paddedData, texture, textureSize, textureProps, elementsPerTexel, elementsPerSplat, bytesPerElement, from, to) {
        const gl = this.renderer.getContext();
        const updateRegion = SplatMesh.computeTextureUpdateRegion(from, to, textureSize.x, elementsPerTexel, elementsPerSplat);
        const updateElementCount = updateRegion.dataEnd - updateRegion.dataStart;
        const updateDataView = new paddedData.constructor(paddedData.buffer,
                                                          updateRegion.dataStart * bytesPerElement, updateElementCount);
        const updateHeight = updateRegion.endRow - updateRegion.startRow + 1;
        const glType = this.webGLUtils.convert(texture.type);
        const glFormat = this.webGLUtils.convert(texture.format, texture.colorSpace);
        const currentTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.bindTexture(gl.TEXTURE_2D, textureProps.__webglTexture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, updateRegion.startRow,
                         textureSize.x, updateHeight, glFormat, glType, updateDataView);
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    }

    static updatePaddedCompressedCovariancesTextureData(sourceData, textureData, textureDataStartIndex, fromElement, toElement) {
        let textureDataView = new DataView(textureData.buffer);
        let textureDataIndex = textureDataStartIndex;
        let sequentialCount = 0;
        for (let i = fromElement; i <= toElement; i+=2) {
            textureDataView.setUint16(textureDataIndex * 2, sourceData[i], true);
            textureDataView.setUint16(textureDataIndex * 2 + 2, sourceData[i + 1], true);
            textureDataIndex += 2;
            sequentialCount++;
            if (sequentialCount >= 3) {
                textureDataIndex += 2;
                sequentialCount = 0;
            }
        }
    }

    static updateCenterColorsPaddedData(from, to, centers, colors, paddedCenterColors) {
        for (let c = from; c <= to; c++) {
            const colorsBase = c * 4;
            const centersBase = c * 3;
            const centerColorsBase = c * 4;
            paddedCenterColors[centerColorsBase] = rgbaArrayToInteger(colors, colorsBase);
            paddedCenterColors[centerColorsBase + 1] = uintEncodedFloat$1(centers[centersBase]);
            paddedCenterColors[centerColorsBase + 2] = uintEncodedFloat$1(centers[centersBase + 1]);
            paddedCenterColors[centerColorsBase + 3] = uintEncodedFloat$1(centers[centersBase + 2]);
        }
    }

    static updateScaleRotationsPaddedData(from, to, scales, rotations, paddedScaleRotations) {
        const combinedSize = 6;
        for (let c = from; c <= to; c++) {
            const scaleBase = c * 3;
            const rotationBase = c * 4;
            const scaleRotationsBase = c * combinedSize;

            paddedScaleRotations[scaleRotationsBase] = scales[scaleBase];
            paddedScaleRotations[scaleRotationsBase + 1] = scales[scaleBase + 1];
            paddedScaleRotations[scaleRotationsBase + 2] = scales[scaleBase + 2];

            paddedScaleRotations[scaleRotationsBase + 3] = rotations[rotationBase];
            paddedScaleRotations[scaleRotationsBase + 4] = rotations[rotationBase + 1];
            paddedScaleRotations[scaleRotationsBase + 5] = rotations[rotationBase + 2];
        }
    }

    updateVisibleRegion(sinceLastBuildOnly) {
        const splatCount = this.getSplatCount(true);
        const tempCenter = new THREE.Vector3();
        if (!sinceLastBuildOnly) {
            const avgCenter = new THREE.Vector3();
            this.scenes.forEach((scene) => {
                avgCenter.add(scene.splatBuffer.sceneCenter);
            });
            avgCenter.multiplyScalar(1.0 / this.scenes.length);
            this.calculatedSceneCenter.copy(avgCenter);
            this.material.uniforms.sceneCenter.value.copy(this.calculatedSceneCenter);
            this.material.uniformsNeedUpdate = true;
        }

        const startSplatFormMaxDistanceCalc = sinceLastBuildOnly ? this.lastBuildSplatCount : 0;
        for (let i = startSplatFormMaxDistanceCalc; i < splatCount; i++) {
            this.getSplatCenter(this.morphedMesh, i, tempCenter, true);
            const distFromCSceneCenter = tempCenter.sub(this.calculatedSceneCenter).length();
            if (distFromCSceneCenter > this.maxSplatDistanceFromSceneCenter) this.maxSplatDistanceFromSceneCenter = distFromCSceneCenter;
        }

        if (this.maxSplatDistanceFromSceneCenter - this.visibleRegionBufferRadius > VISIBLE_REGION_EXPANSION_DELTA) {
            this.visibleRegionBufferRadius = this.maxSplatDistanceFromSceneCenter;
            this.visibleRegionRadius = Math.max(this.visibleRegionBufferRadius - VISIBLE_REGION_EXPANSION_DELTA, 0.0);
        }
        if (this.finalBuild) this.visibleRegionRadius = this.visibleRegionBufferRadius = this.maxSplatDistanceFromSceneCenter;
        this.updateVisibleRegionFadeDistance();
    }

    updateVisibleRegionFadeDistance(sceneRevealMode = SceneRevealMode.Default) {
        const fastFadeRate = SCENE_FADEIN_RATE_FAST * this.sceneFadeInRateMultiplier;
        const gradualFadeRate = SCENE_FADEIN_RATE_GRADUAL * this.sceneFadeInRateMultiplier;
        const defaultFadeInRate = this.finalBuild ? fastFadeRate : gradualFadeRate;
        const fadeInRate = sceneRevealMode === SceneRevealMode.Default ? defaultFadeInRate : gradualFadeRate;
        this.visibleRegionFadeStartRadius = (this.visibleRegionRadius - this.visibleRegionFadeStartRadius) *
                                             fadeInRate + this.visibleRegionFadeStartRadius;
        const fadeInPercentage = (this.visibleRegionBufferRadius > 0) ?
                                 (this.visibleRegionFadeStartRadius / this.visibleRegionBufferRadius) : 0;
        const fadeInComplete = fadeInPercentage > 0.99;
        const shaderFadeInComplete = (fadeInComplete || sceneRevealMode === SceneRevealMode.Instant) ? 1 : 0;

        this.material.uniforms.visibleRegionFadeStartRadius.value = this.visibleRegionFadeStartRadius;
        this.material.uniforms.visibleRegionRadius.value = this.visibleRegionRadius;
        this.material.uniforms.firstRenderTime.value = this.firstRenderTime;
        this.material.uniforms.currentTime.value = performance.now();
        this.material.uniforms.fadeInComplete.value = shaderFadeInComplete;
        this.material.uniformsNeedUpdate = true;
        this.visibleRegionChanging = !fadeInComplete;
    }

    /**
     * Set the indexes of splats that should be rendered; should be sorted in desired render order.
     * @param {Uint32Array} globalIndexes Sorted index list of splats to be rendered
     * @param {number} renderSplatCount Total number of splats to be rendered. Necessary because we may not want to render
     *                                  every splat.
     */
    updateRenderIndexes(globalIndexes, renderSplatCount) {
        const geometry = this.geometry;
        geometry.attributes.splatIndex.set(globalIndexes);
        geometry.attributes.splatIndex.needsUpdate = true;
        if (renderSplatCount > 0 && this.firstRenderTime === -1) this.firstRenderTime = performance.now();
        geometry.instanceCount = renderSplatCount;
        geometry.setDrawRange(0, renderSplatCount);
    }

    /**
     * Update the transforms for each scene in this splat mesh from their individual components (position,
     * quaternion, and scale)
     */
    updateTransforms() {
        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.getScene(i);
            scene.updateTransform(this.dynamicMode);
        }
    }

    updateUniforms = function() {

        const viewport = new THREE.Vector2();

        return function(renderDimensions, cameraFocalLengthX, cameraFocalLengthY,
                        orthographicMode, orthographicZoom, inverseFocalAdjustment) {
            const splatCount = this.getSplatCount();
            if (splatCount > 0) {
                viewport.set(renderDimensions.x * this.devicePixelRatio,
                             renderDimensions.y * this.devicePixelRatio);
                this.material.uniforms.viewport.value.copy(viewport);
                this.material.uniforms.basisViewport.value.set(1.0 / viewport.x, 1.0 / viewport.y);
                this.material.uniforms.focal.value.set(cameraFocalLengthX, cameraFocalLengthY);
                this.material.uniforms.orthographicMode.value = orthographicMode ? 1 : 0;
                this.material.uniforms.orthoZoom.value = orthographicZoom;
                this.material.uniforms.inverseFocalAdjustment.value = inverseFocalAdjustment;
                if (this.dynamicMode) {
                    for (let i = 0; i < this.scenes.length; i++) {
                        this.material.uniforms.transforms.value[i].copy(this.getScene(i).transform);
                    }
                }
                if (this.enableOptionalEffects) {
                    for (let i = 0; i < this.scenes.length; i++) {
                        this.material.uniforms.sceneOpacity.value[i] = clamp(this.getScene(i).opacity, 0.0, 1.0);
                        this.material.uniforms.sceneVisibility.value[i] = this.getScene(i).visible ? 1 : 0;
                        this.material.uniformsNeedUpdate = true;
                    }
                }
                this.material.uniformsNeedUpdate = true;
            }
        };

    }();

    setSplatScale(splatScale = 1) {
        this.splatScale = splatScale;
        this.material.uniforms.splatScale.value = splatScale;
        this.material.uniformsNeedUpdate = true;
    }

    getSplatScale() {
        return this.splatScale;
    }

    setPointCloudModeEnabled(enabled) {
        this.pointCloudModeEnabled = enabled;
        this.material.uniforms.pointCloudModeEnabled.value = enabled ? 1 : 0;
        this.material.uniformsNeedUpdate = true;
    }

    getPointCloudModeEnabled() {
        return this.pointCloudModeEnabled;
    }

    getSplatDataTextures() {
        return this.splatDataTextures;
    }

    getSplatCount(includeSinceLastBuild = false) {
        if (!includeSinceLastBuild) return this.lastBuildSplatCount;
        else return SplatMesh.getTotalSplatCountForScenes(this.scenes);
    }

    static getTotalSplatCountForScenes(scenes) {
        let totalSplatCount = 0;
        for (let scene of scenes) {
            if (scene && scene.splatBuffer) totalSplatCount += scene.splatBuffer.getSplatCount();
        }
        return totalSplatCount;
    }

    static getTotalSplatCountForSplatBuffers(splatBuffers) {
        let totalSplatCount = 0;
        for (let splatBuffer of splatBuffers) totalSplatCount += splatBuffer.getSplatCount();
        return totalSplatCount;
    }

    getMaxSplatCount() {
        return SplatMesh.getTotalMaxSplatCountForScenes(this.scenes);
    }

    static getTotalMaxSplatCountForScenes(scenes) {
        let totalSplatCount = 0;
        for (let scene of scenes) {
            if (scene && scene.splatBuffer) totalSplatCount += scene.splatBuffer.getMaxSplatCount();
        }
        return totalSplatCount;
    }

    static getTotalMaxSplatCountForSplatBuffers(splatBuffers) {
        let totalSplatCount = 0;
        for (let splatBuffer of splatBuffers) totalSplatCount += splatBuffer.getMaxSplatCount();
        return totalSplatCount;
    }

    disposeDistancesComputationGPUResources() {

        if (!this.renderer) return;

        const gl = this.renderer.getContext();

        if (this.distancesTransformFeedback.vao) {
            gl.deleteVertexArray(this.distancesTransformFeedback.vao);
            this.distancesTransformFeedback.vao = null;
        }
        if (this.distancesTransformFeedback.program) {
            gl.deleteProgram(this.distancesTransformFeedback.program);
            gl.deleteShader(this.distancesTransformFeedback.vertexShader);
            gl.deleteShader(this.distancesTransformFeedback.fragmentShader);
            this.distancesTransformFeedback.program = null;
            this.distancesTransformFeedback.vertexShader = null;
            this.distancesTransformFeedback.fragmentShader = null;
        }
        this.disposeDistancesComputationGPUBufferResources();
        if (this.distancesTransformFeedback.id) {
            gl.deleteTransformFeedback(this.distancesTransformFeedback.id);
            this.distancesTransformFeedback.id = null;
        }
    }

    disposeDistancesComputationGPUBufferResources() {

        if (!this.renderer) return;

        const gl = this.renderer.getContext();

        if (this.distancesTransformFeedback.centersBuffer) {
            this.distancesTransformFeedback.centersBuffer = null;
            gl.deleteBuffer(this.distancesTransformFeedback.centersBuffer);
        }
        if (this.distancesTransformFeedback.outDistancesBuffer) {
            gl.deleteBuffer(this.distancesTransformFeedback.outDistancesBuffer);
            this.distancesTransformFeedback.outDistancesBuffer = null;
        }
    }

    /**
     * Set the Three.js renderer used by this splat mesh
     * @param {THREE.WebGLRenderer} renderer Instance of THREE.WebGLRenderer
     */
    setRenderer(renderer) {
        if (renderer !== this.renderer) {
            this.renderer = renderer;
            const gl = this.renderer.getContext();
            const extensions = new WebGLExtensions$1(gl);
            const capabilities = new WebGLCapabilities$1(gl, extensions, {});
            extensions.init(capabilities);
            this.webGLUtils = new WebGLUtils$1(gl, extensions, capabilities);
            if (this.enableDistancesComputationOnGPU && this.getSplatCount() > 0) {
                this.setupDistancesComputationTransformFeedback();
                const { centers, sceneIndexes } = this.getDataForDistancesComputation(0, this.getSplatCount() - 1);
                this.refreshGPUBuffersForDistancesComputation(centers, sceneIndexes);
            }
        }
    }

    setupDistancesComputationTransformFeedback = function() {

        let currentMaxSplatCount;

        return () => {
            const maxSplatCount = this.getMaxSplatCount();

            if (!this.renderer) return;

            const rebuildGPUObjects = (this.lastRenderer !== this.renderer);
            const rebuildBuffers = currentMaxSplatCount !== maxSplatCount;

            if (!rebuildGPUObjects && !rebuildBuffers) return;

            if (rebuildGPUObjects) {
                this.disposeDistancesComputationGPUResources();
            } else if (rebuildBuffers) {
                this.disposeDistancesComputationGPUBufferResources();
            }

            const gl = this.renderer.getContext();

            const createShader = (gl, type, source) => {
                const shader = gl.createShader(type);
                if (!shader) {
                    console.error('Fatal error: gl could not create a shader object.');
                    return null;
                }

                gl.shaderSource(shader, source);
                gl.compileShader(shader);

                const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
                if (!compiled) {
                    let typeName = 'unknown';
                    if (type === gl.VERTEX_SHADER) typeName = 'vertex shader';
                    else if (type === gl.FRAGMENT_SHADER) typeName = 'fragement shader';
                    const errors = gl.getShaderInfoLog(shader);
                    console.error('Failed to compile ' + typeName + ' with these errors:' + errors);
                    gl.deleteShader(shader);
                    return null;
                }

                return shader;
            };

            let vsSource;
            if (this.integerBasedDistancesComputation) {
                vsSource =
                `#version 300 es
                in ivec4 center;
                flat out int distance;`;
                if (this.dynamicMode) {
                    vsSource += `
                        in uint sceneIndex;
                        uniform ivec4 transforms[${Constants$1.MaxScenes}];
                        void main(void) {
                            ivec4 transform = transforms[sceneIndex];
                            distance = center.x * transform.x + center.y * transform.y + center.z * transform.z + transform.w * center.w;
                        }
                    `;
                } else {
                    vsSource += `
                        uniform ivec3 modelViewProj;
                        void main(void) {
                            distance = center.x * modelViewProj.x + center.y * modelViewProj.y + center.z * modelViewProj.z;
                        }
                    `;
                }
            } else {
                vsSource =
                `#version 300 es
                in vec4 center;
                flat out float distance;`;
                if (this.dynamicMode) {
                    vsSource += `
                        in uint sceneIndex;
                        uniform mat4 transforms[${Constants$1.MaxScenes}];
                        void main(void) {
                            vec4 transformedCenter = transforms[sceneIndex] * vec4(center.xyz, 1.0);
                            distance = transformedCenter.z;
                        }
                    `;
                } else {
                    vsSource += `
                        uniform vec3 modelViewProj;
                        void main(void) {
                            distance = center.x * modelViewProj.x + center.y * modelViewProj.y + center.z * modelViewProj.z;
                        }
                    `;
                }
            }

            const fsSource =
            `#version 300 es
                precision lowp float;
                out vec4 fragColor;
                void main(){}
            `;

            const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
            const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
            const currentProgramDeleted = currentProgram ? gl.getProgramParameter(currentProgram, gl.DELETE_STATUS) : false;

            if (rebuildGPUObjects) {
                this.distancesTransformFeedback.vao = gl.createVertexArray();
            }

            gl.bindVertexArray(this.distancesTransformFeedback.vao);

            if (rebuildGPUObjects) {
                const program = gl.createProgram();
                const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
                const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
                if (!vertexShader || !fragmentShader) {
                    throw new Error('Could not compile shaders for distances computation on GPU.');
                }
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.transformFeedbackVaryings(program, ['distance'], gl.SEPARATE_ATTRIBS);
                gl.linkProgram(program);

                const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
                if (!linked) {
                    const error = gl.getProgramInfoLog(program);
                    console.error('Fatal error: Failed to link program: ' + error);
                    gl.deleteProgram(program);
                    gl.deleteShader(fragmentShader);
                    gl.deleteShader(vertexShader);
                    throw new Error('Could not link shaders for distances computation on GPU.');
                }

                this.distancesTransformFeedback.program = program;
                this.distancesTransformFeedback.vertexShader = vertexShader;
                this.distancesTransformFeedback.vertexShader = fragmentShader;
            }

            gl.useProgram(this.distancesTransformFeedback.program);

            this.distancesTransformFeedback.centersLoc =
                gl.getAttribLocation(this.distancesTransformFeedback.program, 'center');
            if (this.dynamicMode) {
                this.distancesTransformFeedback.sceneIndexesLoc =
                    gl.getAttribLocation(this.distancesTransformFeedback.program, 'sceneIndex');
                for (let i = 0; i < this.scenes.length; i++) {
                    this.distancesTransformFeedback.transformsLocs[i] =
                        gl.getUniformLocation(this.distancesTransformFeedback.program, `transforms[${i}]`);
                }
            } else {
                this.distancesTransformFeedback.modelViewProjLoc =
                    gl.getUniformLocation(this.distancesTransformFeedback.program, 'modelViewProj');
            }

            if (rebuildGPUObjects || rebuildBuffers) {
                this.distancesTransformFeedback.centersBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.centersBuffer);
                gl.enableVertexAttribArray(this.distancesTransformFeedback.centersLoc);
                if (this.integerBasedDistancesComputation) {
                    gl.vertexAttribIPointer(this.distancesTransformFeedback.centersLoc, 4, gl.INT, 0, 0);
                } else {
                    gl.vertexAttribPointer(this.distancesTransformFeedback.centersLoc, 4, gl.FLOAT, false, 0, 0);
                }

                if (this.dynamicMode) {
                    this.distancesTransformFeedback.sceneIndexesBuffer = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.sceneIndexesBuffer);
                    gl.enableVertexAttribArray(this.distancesTransformFeedback.sceneIndexesLoc);
                    gl.vertexAttribIPointer(this.distancesTransformFeedback.sceneIndexesLoc, 1, gl.UNSIGNED_INT, 0, 0);
                }
            }

            if (rebuildGPUObjects || rebuildBuffers) {
                this.distancesTransformFeedback.outDistancesBuffer = gl.createBuffer();
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.outDistancesBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, maxSplatCount * 4, gl.STATIC_READ);

            if (rebuildGPUObjects) {
                this.distancesTransformFeedback.id = gl.createTransformFeedback();
            }
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.distancesTransformFeedback.id);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.distancesTransformFeedback.outDistancesBuffer);

            if (currentProgram && currentProgramDeleted !== true) gl.useProgram(currentProgram);
            if (currentVao) gl.bindVertexArray(currentVao);

            this.lastRenderer = this.renderer;
            currentMaxSplatCount = maxSplatCount;
        };

    }();

    /**
     * Refresh GPU buffers used for computing splat distances with centers data from the scenes for this mesh.
     * @param {boolean} isUpdate Specify whether or not to update the GPU buffer or to initialize & fill
     * @param {Array<number>} centers The splat centers data
     * @param {number} offsetSplats Offset in the GPU buffer at which to start updating data, specified in splats
     */
    updateGPUCentersBufferForDistancesComputation(isUpdate, centers, offsetSplats) {

        if (!this.renderer) return;

        const gl = this.renderer.getContext();

        const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
        gl.bindVertexArray(this.distancesTransformFeedback.vao);

        const ArrayType = this.integerBasedDistancesComputation ? Uint32Array : Float32Array;
        const attributeBytesPerCenter = 16;
        const subBufferOffset = offsetSplats * attributeBytesPerCenter;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.centersBuffer);

        if (isUpdate) {
            gl.bufferSubData(gl.ARRAY_BUFFER, subBufferOffset, centers);
        } else {
            const maxArray = new ArrayType(this.getMaxSplatCount() * attributeBytesPerCenter);
            maxArray.set(centers);
            gl.bufferData(gl.ARRAY_BUFFER, maxArray, gl.STATIC_DRAW);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        if (currentVao) gl.bindVertexArray(currentVao);
    }

    /**
     * Refresh GPU buffers used for pre-computing splat distances with centers data from the scenes for this mesh.
     * @param {boolean} isUpdate Specify whether or not to update the GPU buffer or to initialize & fill
     * @param {Array<number>} sceneIndexes The splat scene indexes
     * @param {number} offsetSplats Offset in the GPU buffer at which to start updating data, specified in splats
     */
    updateGPUTransformIndexesBufferForDistancesComputation(isUpdate, sceneIndexes, offsetSplats) {

        if (!this.renderer || !this.dynamicMode) return;

        const gl = this.renderer.getContext();

        const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
        gl.bindVertexArray(this.distancesTransformFeedback.vao);

        const subBufferOffset = offsetSplats * 4;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.sceneIndexesBuffer);

        if (isUpdate) {
            gl.bufferSubData(gl.ARRAY_BUFFER, subBufferOffset, sceneIndexes);
        } else {
            const maxArray = new Uint32Array(this.getMaxSplatCount() * 4);
            maxArray.set(sceneIndexes);
            gl.bufferData(gl.ARRAY_BUFFER, maxArray, gl.STATIC_DRAW);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        if (currentVao) gl.bindVertexArray(currentVao);
    }

    /**
     * Get a typed array containing a mapping from global splat indexes to their scene index.
     * @param {number} start Starting splat index to store
     * @param {number} end Ending splat index to store
     * @return {Uint32Array}
     */
    getSceneIndexes(start, end) {

        let sceneIndexes;
        const fillCount = end - start + 1;
        sceneIndexes = new Uint32Array(fillCount);
        for (let i = start; i <= end; i++) {
            sceneIndexes[i] = this.globalSplatIndexToSceneIndexMap[i];
        }

        return sceneIndexes;
    }

    /**
     * Fill 'array' with the transforms for each scene in this splat mesh.
     * @param {Array} array Empty array to be filled with scene transforms. If not empty, contents will be overwritten.
     */
    fillTransformsArray = function() {

        const tempArray = [];

        return function(array) {
            if (tempArray.length !== array.length) tempArray.length = array.length;
            for (let i = 0; i < this.scenes.length; i++) {
                const sceneTransform = this.getScene(i).transform;
                const sceneTransformElements = sceneTransform.elements;
                for (let j = 0; j < 16; j++) {
                    tempArray[i * 16 + j] = sceneTransformElements[j];
                }
            }
            array.set(tempArray);
        };

    }();

    computeDistancesOnGPU = function() {

        const tempMatrix = new THREE.Matrix4();

        return (modelViewProjMatrix, outComputedDistances) => {
            if (!this.renderer) return;

            // console.time("gpu_compute_distances");
            const gl = this.renderer.getContext();

            const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
            const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
            const currentProgramDeleted = currentProgram ? gl.getProgramParameter(currentProgram, gl.DELETE_STATUS) : false;

            gl.bindVertexArray(this.distancesTransformFeedback.vao);
            gl.useProgram(this.distancesTransformFeedback.program);

            gl.enable(gl.RASTERIZER_DISCARD);

            if (this.dynamicMode) {
                for (let i = 0; i < this.scenes.length; i++) {
                    tempMatrix.copy(this.getScene(i).transform);
                    tempMatrix.premultiply(modelViewProjMatrix);

                    if (this.integerBasedDistancesComputation) {
                        const iTempMatrix = SplatMesh.getIntegerMatrixArray(tempMatrix);
                        const iTransform = [iTempMatrix[2], iTempMatrix[6], iTempMatrix[10], iTempMatrix[14]];
                        gl.uniform4i(this.distancesTransformFeedback.transformsLocs[i], iTransform[0], iTransform[1],
                                                                                        iTransform[2], iTransform[3]);
                    } else {
                        gl.uniformMatrix4fv(this.distancesTransformFeedback.transformsLocs[i], false, tempMatrix.elements);
                    }
                }
            } else {
                if (this.integerBasedDistancesComputation) {
                    const iViewProjMatrix = SplatMesh.getIntegerMatrixArray(modelViewProjMatrix);
                    const iViewProj = [iViewProjMatrix[2], iViewProjMatrix[6], iViewProjMatrix[10]];
                    gl.uniform3i(this.distancesTransformFeedback.modelViewProjLoc, iViewProj[0], iViewProj[1], iViewProj[2]);
                } else {
                    const viewProj = [modelViewProjMatrix.elements[2], modelViewProjMatrix.elements[6], modelViewProjMatrix.elements[10]];
                    gl.uniform3f(this.distancesTransformFeedback.modelViewProjLoc, viewProj[0], viewProj[1], viewProj[2]);
                }
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.centersBuffer);
            gl.enableVertexAttribArray(this.distancesTransformFeedback.centersLoc);
            if (this.integerBasedDistancesComputation) {
                gl.vertexAttribIPointer(this.distancesTransformFeedback.centersLoc, 4, gl.INT, 0, 0);
            } else {
                gl.vertexAttribPointer(this.distancesTransformFeedback.centersLoc, 4, gl.FLOAT, false, 0, 0);
            }

            if (this.dynamicMode) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.sceneIndexesBuffer);
                gl.enableVertexAttribArray(this.distancesTransformFeedback.sceneIndexesLoc);
                gl.vertexAttribIPointer(this.distancesTransformFeedback.sceneIndexesLoc, 1, gl.UNSIGNED_INT, 0, 0);
            }

            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.distancesTransformFeedback.id);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.distancesTransformFeedback.outDistancesBuffer);

            gl.beginTransformFeedback(gl.POINTS);
            gl.drawArrays(gl.POINTS, 0, this.getSplatCount());
            gl.endTransformFeedback();

            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

            gl.disable(gl.RASTERIZER_DISCARD);

            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();

            const promise = new Promise((resolve) => {
                const checkSync = () => {
                    if (this.disposed) {
                        resolve();
                    } else {
                        const timeout = 0;
                        const bitflags = 0;
                        const status = gl.clientWaitSync(sync, bitflags, timeout);
                        switch (status) {
                            case gl.TIMEOUT_EXPIRED:
                                this.computeDistancesOnGPUSyncTimeout = setTimeout(checkSync);
                                return this.computeDistancesOnGPUSyncTimeout;
                            case gl.WAIT_FAILED:
                                throw new Error('should never get here');
                            default: {
                                this.computeDistancesOnGPUSyncTimeout = null;
                                gl.deleteSync(sync);
                                const currentVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
                                gl.bindVertexArray(this.distancesTransformFeedback.vao);
                                gl.bindBuffer(gl.ARRAY_BUFFER, this.distancesTransformFeedback.outDistancesBuffer);
                                gl.getBufferSubData(gl.ARRAY_BUFFER, 0, outComputedDistances);
                                gl.bindBuffer(gl.ARRAY_BUFFER, null);

                                if (currentVao) gl.bindVertexArray(currentVao);

                                // console.timeEnd("gpu_compute_distances");

                                resolve();
                            }
                        }
                    }
                };
                this.computeDistancesOnGPUSyncTimeout = setTimeout(checkSync);
            });

            if (currentProgram && currentProgramDeleted !== true) gl.useProgram(currentProgram);
            if (currentVao) gl.bindVertexArray(currentVao);

            return promise;
        };

    }();

    /**
     * Given a global splat index, return corresponding local data (splat buffer, index of splat in that splat
     * buffer, and the corresponding transform)
     * @param {number} globalIndex Global splat index
     * @param {object} paramsObj Object in which to store local data
     * @param {boolean} returnSceneTransform By default, the transform of the scene to which the splat at 'globalIndex' belongs will be
     *                                       returned via the 'sceneTransform' property of 'paramsObj' only if the splat mesh is static.
     *                                       If 'returnSceneTransform' is true, the 'sceneTransform' property will always contain the scene
     *                                       transform, and if 'returnSceneTransform' is false, the 'sceneTransform' property will always
     *                                       be null.
     */
    getLocalSplatParameters(globalIndex, paramsObj, returnSceneTransform) {
        if (returnSceneTransform === undefined || returnSceneTransform === null) {
            returnSceneTransform = this.dynamicMode ? false : true;
        }
        paramsObj.splatBuffer = this.getSplatBufferForSplat(globalIndex);
        paramsObj.localIndex = this.getSplatLocalIndex(globalIndex);
        paramsObj.sceneTransform = returnSceneTransform ? this.getSceneTransformForSplat(globalIndex) : null;
    }

    /**
     * Fill arrays with splat data and apply transforms if appropriate. Each array is optional.
     * @param {Float32Array} covariances Target storage for splat covariances
     * @param {Float32Array} scales Target storage for splat scales
     * @param {Float32Array} rotations Target storage for splat rotations
     * @param {Float32Array} centers Target storage for splat centers
     * @param {Uint8Array} colors Target storage for splat colors
     * @param {Float32Array} sphericalHarmonics Target storage for spherical harmonics
     * @param {boolean} applySceneTransform By default, scene transforms are applied to relevant splat data only if the splat mesh is
     *                                      static. If 'applySceneTransform' is true, scene transforms will always be applied and if
     *                                      it is false, they will never be applied. If undefined, the default behavior will apply.
     * @param {number} covarianceCompressionLevel The compression level for covariances in the destination array
     * @param {number} sphericalHarmonicsCompressionLevel The compression level for spherical harmonics in the destination array
     * @param {number} srcStart The start location from which to pull source data
     * @param {number} srcEnd The end location from which to pull source data
     * @param {number} destStart The start location from which to write data
     */
    fillSplatDataArrays(covariances, scales, rotations, centers, colors, sphericalHarmonics, flameModelPos,
                         applySceneTransform,
                        covarianceCompressionLevel = 0, scaleRotationCompressionLevel = 0, sphericalHarmonicsCompressionLevel = 1,
                        srcStart, srcEnd, destStart = 0, sceneIndex) {
        const scaleOverride = new THREE.Vector3();
        scaleOverride.x = undefined;
        scaleOverride.y = undefined;
        if (this.splatRenderMode === SplatRenderMode.ThreeD) {
            scaleOverride.z = undefined;
        } else {
            scaleOverride.z = 1;
        }
        const tempTransform = new THREE.Matrix4();

        let startSceneIndex = 0;
        let endSceneIndex = this.scenes.length - 1;
        if (sceneIndex !== undefined && sceneIndex !== null && sceneIndex >= 0 && sceneIndex <= this.scenes.length) {
            startSceneIndex = sceneIndex;
            endSceneIndex = sceneIndex;
        }
        for (let i = startSceneIndex; i <= endSceneIndex; i++) {
            if (applySceneTransform === undefined || applySceneTransform === null) {
                applySceneTransform = this.dynamicMode ? false : true;
            }

            const scene = this.getScene(i);
            const splatBuffer = scene.splatBuffer;
            let sceneTransform;
            if (applySceneTransform) {
                this.getSceneTransform(i, tempTransform);
                sceneTransform = tempTransform;
            }
            if (covariances) {
                splatBuffer.fillSplatCovarianceArray(covariances, sceneTransform, srcStart, srcEnd, destStart, covarianceCompressionLevel);
            }
            if (scales || rotations) {
                if (!scales || !rotations) {
                    throw new Error('SplatMesh::fillSplatDataArrays() -> "scales" and "rotations" must both be valid.');
                }
                splatBuffer.fillSplatScaleRotationArray(scales, rotations, sceneTransform,
                                                        srcStart, srcEnd, destStart, scaleRotationCompressionLevel, scaleOverride);
            }
            if (centers) splatBuffer.fillSplatCenterArray(this.morphedMesh, centers, sceneTransform, srcStart, srcEnd, destStart);
            if (colors) splatBuffer.fillSplatColorArray(colors, scene.minimumAlpha, srcStart, srcEnd, destStart);
            if (sphericalHarmonics) {
                splatBuffer.fillSphericalHarmonicsArray(sphericalHarmonics, this.minSphericalHarmonicsDegree,
                                                        sceneTransform, srcStart, srcEnd, destStart, sphericalHarmonicsCompressionLevel);
            }

            destStart += splatBuffer.getSplatCount();
        }
    }

    morphedMesh;
    /**
     * Convert splat centers, which are floating point values, to an array of integers and multiply
     * each by 1000. Centers will get transformed as appropriate before conversion to integer.
     * @param {number} start The index at which to start retrieving data
     * @param {number} end The index at which to stop retrieving data
     * @param {boolean} padFour Enforce alignment of 4 by inserting a 1 after every 3 values
     * @return {Int32Array}
     */
    getIntegerCenters(start, end, padFour = false) {
        const splatCount = end - start + 1;
        const floatCenters = new Float32Array(splatCount * 3);
        this.fillSplatDataArrays(null, null, null, floatCenters, null, null, undefined, undefined, undefined, undefined, start);
        let intCenters;
        let componentCount = padFour ? 4 : 3;
        intCenters = new Int32Array(splatCount * componentCount);
        for (let i = 0; i < splatCount; i++) {
            for (let t = 0; t < 3; t++) {
                intCenters[i * componentCount + t] = Math.round(floatCenters[i * 3 + t] * 1000.0);
            }
            if (padFour) intCenters[i * componentCount + 3] = 1000;
        }
        return intCenters;
    }

    /**
     * Returns an array of splat centers, transformed as appropriate, optionally padded.
     * @param {number} start The index at which to start retrieving data
     * @param {number} end The index at which to stop retrieving data
     * @param {boolean} padFour Enforce alignment of 4 by inserting a 1 after every 3 values
     * @return {Float32Array}
     */
    getFloatCenters(start, end, padFour = false) {
        const splatCount = end - start + 1;
        const floatCenters = new Float32Array(splatCount * 3);
        this.fillSplatDataArrays(null, null, null, floatCenters, null, null, undefined, undefined, undefined, undefined, start);
        if (!padFour) return floatCenters;
        let paddedFloatCenters = new Float32Array(splatCount * 4);
        for (let i = 0; i < splatCount; i++) {
            for (let t = 0; t < 3; t++) {
                paddedFloatCenters[i * 4 + t] = floatCenters[i * 3 + t];
            }
            paddedFloatCenters[i * 4 + 3] = 1.0;
        }
        return paddedFloatCenters;
    }

    /**
     * Get the center for a splat, transformed as appropriate.
     * @param {number} globalIndex Global index of splat
     * @param {THREE.Vector3} outCenter THREE.Vector3 instance in which to store splat center
     * @param {boolean} applySceneTransform By default, if the splat mesh is static, the transform of the scene to which the splat at
     *                                      'globalIndex' belongs will be applied to the splat center. If 'applySceneTransform' is true,
     *                                      the scene transform will always be applied and if 'applySceneTransform' is false, the
     *                                      scene transform will never be applied. If undefined, the default behavior will apply.
     */
    getSplatCenter = function() {

        const paramsObj = {};

        return function(morphedMesh, globalIndex, outCenter, applySceneTransform) {
            this.getLocalSplatParameters(globalIndex, paramsObj, applySceneTransform);
            paramsObj.splatBuffer.getSplatCenter(morphedMesh, paramsObj.localIndex, outCenter, paramsObj.sceneTransform);
        };

    }();

    /**
     * Get the scale and rotation for a splat, transformed as appropriate.
     * @param {number} globalIndex Global index of splat
     * @param {THREE.Vector3} outScale THREE.Vector3 instance in which to store splat scale
     * @param {THREE.Quaternion} outRotation THREE.Quaternion instance in which to store splat rotation
     * @param {boolean} applySceneTransform By default, if the splat mesh is static, the transform of the scene to which the splat at
     *                                      'globalIndex' belongs will be applied to the splat scale and rotation. If
     *                                      'applySceneTransform' is true, the scene transform will always be applied and if
     *                                      'applySceneTransform' is false, the scene transform will never be applied. If undefined,
     *                                      the default behavior will apply.
     */
    getSplatScaleAndRotation = function() {

        const paramsObj = {};
        const scaleOverride = new THREE.Vector3();

        return function(globalIndex, outScale, outRotation, applySceneTransform) {
            this.getLocalSplatParameters(globalIndex, paramsObj, applySceneTransform);
            scaleOverride.x = undefined;
            scaleOverride.y = undefined;
            scaleOverride.z = undefined;
            if (this.splatRenderMode === SplatRenderMode.TwoD) scaleOverride.z = 0;
            paramsObj.splatBuffer.getSplatScaleAndRotation(paramsObj.localIndex, outScale, outRotation,
                                                           paramsObj.sceneTransform, scaleOverride);
        };

    }();

    /**
     * Get the color for a splat.
     * @param {number} globalIndex Global index of splat
     * @param {THREE.Vector4} outColor THREE.Vector4 instance in which to store splat color
     */
    getSplatColor = function() {

        const paramsObj = {};

        return function(globalIndex, outColor) {
            this.getLocalSplatParameters(globalIndex, paramsObj);
            paramsObj.splatBuffer.getSplatColor(paramsObj.localIndex, outColor);
        };

    }();

    /**
     * Store the transform of the scene at 'sceneIndex' in 'outTransform'.
     * @param {number} sceneIndex Index of the desired scene
     * @param {THREE.Matrix4} outTransform Instance of THREE.Matrix4 in which to store the scene's transform
     */
    getSceneTransform(sceneIndex, outTransform) {
        const scene = this.getScene(sceneIndex);
        scene.updateTransform(this.dynamicMode);
        outTransform.copy(scene.transform);
    }

    /**
     * Get the scene at 'sceneIndex'.
     * @param {number} sceneIndex Index of the desired scene
     * @return {SplatScene}
     */
    getScene(sceneIndex) {
        if (sceneIndex < 0 || sceneIndex >= this.scenes.length) {
            throw new Error('SplatMesh::getScene() -> Invalid scene index.');
        }
        return this.scenes[sceneIndex];
    }

    getSceneCount() {
        return this.scenes.length;
    }

    getSplatBufferForSplat(globalIndex) {
        return this.getScene(this.globalSplatIndexToSceneIndexMap[globalIndex]).splatBuffer;
    }

    getSceneIndexForSplat(globalIndex) {
        return this.globalSplatIndexToSceneIndexMap[globalIndex];
    }

    getSceneTransformForSplat(globalIndex) {
        return this.getScene(this.globalSplatIndexToSceneIndexMap[globalIndex]).transform;
    }

    getSplatLocalIndex(globalIndex) {
        return this.globalSplatIndexToLocalSplatIndexMap[globalIndex];
    }

    static getIntegerMatrixArray(matrix) {
        const matrixElements = matrix.elements;
        const intMatrixArray = [];
        for (let i = 0; i < 16; i++) {
            intMatrixArray[i] = Math.round(matrixElements[i] * 1000.0);
        }
        return intMatrixArray;
    }

    computeBoundingBox(applySceneTransforms = false, sceneIndex) {
        let splatCount = this.getSplatCount();
        if (sceneIndex !== undefined && sceneIndex !== null) {
            if (sceneIndex < 0 || sceneIndex >= this.scenes.length) {
                throw new Error('SplatMesh::computeBoundingBox() -> Invalid scene index.');
            }
            splatCount = this.scenes[sceneIndex].splatBuffer.getSplatCount();
        }

        const floatCenters = new Float32Array(splatCount * 3);
        this.fillSplatDataArrays(null, null, null, floatCenters, null, null, applySceneTransforms,
                                 undefined, undefined, undefined, undefined, sceneIndex);

        const min = new THREE.Vector3();
        const max = new THREE.Vector3();
        for (let i = 0; i < splatCount; i++) {
            const offset = i * 3;
            const x = floatCenters[offset];
            const y = floatCenters[offset + 1];
            const z = floatCenters[offset + 2];
            if (i === 0 || x < min.x) min.x = x;
            if (i === 0 || y < min.y) min.y = y;
            if (i === 0 || z < min.z) min.z = z;
            if (i === 0 || x > max.x) max.x = x;
            if (i === 0 || y > max.y) max.y = y;
            if (i === 0 || z > max.z) max.z = z;
        }

        return new THREE.Box3(min, max);
    }
}

/**
 * DirectLoadError
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Minor enhancement: Added this.name property for better error identification.
 */
class DirectLoadError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'DirectLoadError';
    }
}

/**
 * UncompressedSplatArray
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */


const BASE_COMPONENT_COUNT = 14;

class UncompressedSplatArray {

    static OFFSET = {
        X: 0,
        Y: 1,
        Z: 2,
        SCALE0: 3,
        SCALE1: 4,
        SCALE2: 5,
        ROTATION0: 6,
        ROTATION1: 7,
        ROTATION2: 8,
        ROTATION3: 9,
        FDC0: 10,
        FDC1: 11,
        FDC2: 12,
        OPACITY: 13,
        FRC0: 14,
        FRC1: 15,
        FRC2: 16,
        FRC3: 17,
        FRC4: 18,
        FRC5: 19,
        FRC6: 20,
        FRC7: 21,
        FRC8: 22,
        FRC9: 23,
        FRC10: 24,
        FRC11: 25,
        FRC12: 26,
        FRC13: 27,
        FRC14: 28,
        FRC15: 29,
        FRC16: 30,
        FRC17: 31,
        FRC18: 32,
        FRC19: 33,
        FRC20: 34,
        FRC21: 35,
        FRC22: 36,
        FRC23: 37
    };

    constructor(sphericalHarmonicsDegree = 0) {
        this.sphericalHarmonicsDegree = sphericalHarmonicsDegree;
        this.sphericalHarmonicsCount = getSphericalHarmonicsComponentCountForDegree(this.sphericalHarmonicsDegree);
        this.componentCount = this.sphericalHarmonicsCount + BASE_COMPONENT_COUNT;
        this.defaultSphericalHarmonics = new Array(this.sphericalHarmonicsCount).fill(0);
        this.splats = [];
        this.splatCount = 0;
    }

    static createSplat(sphericalHarmonicsDegree = 0) {
        const baseSplat = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
        let shEntries = getSphericalHarmonicsComponentCountForDegree(sphericalHarmonicsDegree);
        for (let i = 0; i < shEntries; i++) baseSplat.push(0);
        return baseSplat;
    }

    addSplat(splat) {
        this.splats.push(splat);
        this.splatCount++;
    }

    getSplat(index) {
        return this.splats[index];
    }

    addDefaultSplat() {
        const newSplat = UncompressedSplatArray.createSplat(this.sphericalHarmonicsDegree);
        this.addSplat(newSplat);
        return newSplat;
    }

    addSplatFromComonents(x, y, z, scale0, scale1, scale2, rot0, rot1, rot2, rot3, r, g, b, opacity, ...rest) {
        const newSplat = [x, y, z, scale0, scale1, scale2, rot0, rot1, rot2, rot3, r, g, b, opacity, ...this.defaultSphericalHarmonics];
        for (let i = 0; i < rest.length && i < this.sphericalHarmonicsCount; i++) {
            newSplat[i] = rest[i];
        }
        this.addSplat(newSplat);
        return newSplat;
    }

    addSplatFromArray(src, srcIndex) {
        const srcSplat = src.splats[srcIndex];
        const newSplat = UncompressedSplatArray.createSplat(this.sphericalHarmonicsDegree);
        for (let i = 0; i < this.componentCount && i < srcSplat.length; i++) {
            newSplat[i] = srcSplat[i];
        }
        this.addSplat(newSplat);
    }
}

/**
 * SplatBuffer
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */


/**
 * Helper function to copy bytes between buffers
 */
const copyBetweenBuffers = (srcBuffer, srcOffset, destBuffer, destOffset, byteCount = 0) => {
    const src = new Uint8Array(srcBuffer, srcOffset);
    const dest = new Uint8Array(destBuffer, destOffset);
    for (let i = 0; i < byteCount; i++) {
        dest[i] = src[i];
    }
};

// Compression/decompression helper functions
Constants$1.SphericalHarmonics8BitCompressionRange;

const toHalfFloat = THREE.DataUtils.toHalfFloat.bind(THREE.DataUtils);
const fromHalfFloat = THREE.DataUtils.fromHalfFloat.bind(THREE.DataUtils);

const toUncompressedFloat = (f, compressionLevel, isSH = false, range8BitMin, range8BitMax) => {
    if (compressionLevel === 0) {
        return f;
    } else if (compressionLevel === 1 || compressionLevel === 2 && !isSH) {
        return THREE.DataUtils.fromHalfFloat(f);
    } else if (compressionLevel === 2) {
        return fromUint8(f, range8BitMin, range8BitMax);
    }
};

const toUint8 = (v, rangeMin, rangeMax) => {
    v = clamp(v, rangeMin, rangeMax);
    const range = (rangeMax - rangeMin);
    return clamp(Math.floor((v - rangeMin) / range * 255), 0, 255);
};

const fromUint8 = (v, rangeMin, rangeMax) => {
    const range = (rangeMax - rangeMin);
    return (v / 255 * range + rangeMin);
};

const fromHalfFloatToUint8 = (v, rangeMin, rangeMax) => {
    return toUint8(fromHalfFloat(v), rangeMin, rangeMax);
};

const dataViewFloatForCompressionLevel = (dataView, floatIndex, compressionLevel, isSH = false) => {
    if (compressionLevel === 0) {
        return dataView.getFloat32(floatIndex * 4, true);
    } else if (compressionLevel === 1 || compressionLevel === 2 && !isSH) {
        return dataView.getUint16(floatIndex * 2, true);
    } else {
        return dataView.getUint8(floatIndex, true);
    }
};

class SplatBuffer {

    static CurrentMajorVersion = 0;
    static CurrentMinorVersion = 1;

    static CenterComponentCount = 3;
    static ScaleComponentCount = 3;
    static RotationComponentCount = 4;
    static ColorComponentCount = 4;
    static CovarianceComponentCount = 6;

    static SplatScaleOffsetFloat = 3;
    static SplatRotationOffsetFloat = 6;

    static CompressionLevels = {
        0: {
            BytesPerCenter: 12,
            BytesPerScale: 12,
            BytesPerRotation: 16,
            BytesPerColor: 4,
            ScaleOffsetBytes: 12,
            RotationffsetBytes: 24,
            ColorOffsetBytes: 40,
            SphericalHarmonicsOffsetBytes: 44,
            ScaleRange: 1,
            BytesPerSphericalHarmonicsComponent: 4,
            SphericalHarmonicsOffsetFloat: 11,
            SphericalHarmonicsDegrees: {
                0: { BytesPerSplat: 44 },
                1: { BytesPerSplat: 80 },
                2: { BytesPerSplat: 140 }
            },
        },
        1: {
            BytesPerCenter: 6,
            BytesPerScale: 6,
            BytesPerRotation: 8,
            BytesPerColor: 4,
            ScaleOffsetBytes: 6,
            RotationffsetBytes: 12,
            ColorOffsetBytes: 20,
            SphericalHarmonicsOffsetBytes: 24,
            ScaleRange: 32767,
            BytesPerSphericalHarmonicsComponent: 2,
            SphericalHarmonicsOffsetFloat: 12,
            SphericalHarmonicsDegrees: {
                0: { BytesPerSplat: 24 },
                1: { BytesPerSplat: 42 },
                2: { BytesPerSplat: 72 }
            },
        },
        2: {
            BytesPerCenter: 6,
            BytesPerScale: 6,
            BytesPerRotation: 8,
            BytesPerColor: 4,
            ScaleOffsetBytes: 6,
            RotationffsetBytes: 12,
            ColorOffsetBytes: 20,
            SphericalHarmonicsOffsetBytes: 24,
            ScaleRange: 32767,
            BytesPerSphericalHarmonicsComponent: 1,
            SphericalHarmonicsOffsetFloat: 12,
            SphericalHarmonicsDegrees: {
                0: { BytesPerSplat: 24 },
                1: { BytesPerSplat: 33 },
                2: { BytesPerSplat: 48 }
            },
        }
    };

    static CovarianceSizeFloats = 6;

    static HeaderSizeBytes = 4096;
    static SectionHeaderSizeBytes = 1024;

    static BucketStorageSizeBytes = 12;
    static BucketStorageSizeFloats = 3;

    static BucketBlockSize = 5.0;
    static BucketSize = 256;

    constructor(bufferData, secLoadedCountsToMax = true) {
        this.constructFromBuffer(bufferData, secLoadedCountsToMax);
    }

    getSplatCount() {
        return this.splatCount;
    }

    getMaxSplatCount() {
        return this.maxSplatCount;
    }

    getMinSphericalHarmonicsDegree() {
        let minSphericalHarmonicsDegree = 0;
        for (let i = 0; i < this.sections.length; i++) {
            const section = this.sections[i];
            if (i === 0 || section.sphericalHarmonicsDegree < minSphericalHarmonicsDegree) {
                minSphericalHarmonicsDegree = section.sphericalHarmonicsDegree;
            }
        }
        return minSphericalHarmonicsDegree;
    }

    getBucketIndex(section, localSplatIndex) {
        let bucketIndex;
        const maxSplatIndexInFullBuckets = section.fullBucketCount * section.bucketSize;
        if (localSplatIndex < maxSplatIndexInFullBuckets) {
            bucketIndex = Math.floor(localSplatIndex / section.bucketSize);
        } else {
            let bucketSplatIndex = maxSplatIndexInFullBuckets;
            bucketIndex = section.fullBucketCount;
            let partiallyFullBucketIndex = 0;
            while (bucketSplatIndex < section.splatCount) {
                let currentPartiallyFilledBucketSize = section.partiallyFilledBucketLengths[partiallyFullBucketIndex];
                if (localSplatIndex >= bucketSplatIndex && localSplatIndex < bucketSplatIndex + currentPartiallyFilledBucketSize) {
                    break;
                }
                bucketSplatIndex += currentPartiallyFilledBucketSize;
                bucketIndex++;
                partiallyFullBucketIndex++;
            }
        }
        return bucketIndex;
    }

    getSplatCenter(morphedMesh, globalSplatIndex, outCenter, transform) {
        const sectionIndex = this.globalSplatIndexToSectionMap[globalSplatIndex];
        const section = this.sections[sectionIndex];
        const localSplatIndex = globalSplatIndex - section.splatCountOffset;

        const srcSplatCentersBase = section.bytesPerSplat * localSplatIndex;
        const dataView = new DataView(this.bufferData, section.dataBase + srcSplatCentersBase);

        const x = dataViewFloatForCompressionLevel(dataView, 0, this.compressionLevel);
        const y = dataViewFloatForCompressionLevel(dataView, 1, this.compressionLevel);
        const z = dataViewFloatForCompressionLevel(dataView, 2, this.compressionLevel);
        if (this.compressionLevel >= 1) {
            const bucketIndex = this.getBucketIndex(section, localSplatIndex);
            const bucketBase = bucketIndex * SplatBuffer.BucketStorageSizeFloats;
            const sf = section.compressionScaleFactor;
            const sr = section.compressionScaleRange;
            outCenter.x = (x - sr) * sf + section.bucketArray[bucketBase];
            outCenter.y = (y - sr) * sf + section.bucketArray[bucketBase + 1];
            outCenter.z = (z - sr) * sf + section.bucketArray[bucketBase + 2];
        } else {
            outCenter.x = x;
            outCenter.y = y;
            outCenter.z = z;
        }

        outCenter.x += morphedMesh[globalSplatIndex * 3 + 0];
        outCenter.y += morphedMesh[globalSplatIndex * 3 + 1];
        outCenter.z += morphedMesh[globalSplatIndex * 3 + 2];


        if (transform) outCenter.applyMatrix4(transform);
    }

    getSplatScaleAndRotation = function() {

        const scaleMatrix = new THREE.Matrix4();
        const rotationMatrix = new THREE.Matrix4();
        const tempMatrix = new THREE.Matrix4();
        const tempPosition = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const rotation = new THREE.Quaternion();

        return function(index, outScale, outRotation, transform, scaleOverride) {
            const sectionIndex = this.globalSplatIndexToSectionMap[index];
            const section = this.sections[sectionIndex];
            const localSplatIndex = index - section.splatCountOffset;

            const srcSplatScalesBase = section.bytesPerSplat * localSplatIndex +
                                       SplatBuffer.CompressionLevels[this.compressionLevel].ScaleOffsetBytes;

            const dataView = new DataView(this.bufferData, section.dataBase + srcSplatScalesBase);

            scale.set(toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 0, this.compressionLevel), this.compressionLevel),
                      toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 1, this.compressionLevel), this.compressionLevel),
                      toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 2, this.compressionLevel), this.compressionLevel));
            if (scaleOverride) {
                if (scaleOverride.x !== undefined) scale.x = scaleOverride.x;
                if (scaleOverride.y !== undefined) scale.y = scaleOverride.y;
                if (scaleOverride.z !== undefined) scale.z = scaleOverride.z;
            }

            rotation.set(toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 4, this.compressionLevel), this.compressionLevel),
                         toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 5, this.compressionLevel), this.compressionLevel),
                         toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 6, this.compressionLevel), this.compressionLevel),
                         toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 3, this.compressionLevel), this.compressionLevel));

            if (transform) {
                scaleMatrix.makeScale(scale.x, scale.y, scale.z);
                rotationMatrix.makeRotationFromQuaternion(rotation);
                tempMatrix.copy(scaleMatrix).multiply(rotationMatrix).multiply(transform);
                tempMatrix.decompose(tempPosition, outRotation, outScale);
            } else {
                outScale.copy(scale);
                outRotation.copy(rotation);
            }
        };

    }();

    getSplatColor(globalSplatIndex, outColor) {
        const sectionIndex = this.globalSplatIndexToSectionMap[globalSplatIndex];
        const section = this.sections[sectionIndex];
        const localSplatIndex = globalSplatIndex - section.splatCountOffset;

        const srcSplatColorsBase = section.bytesPerSplat * localSplatIndex +
                                   SplatBuffer.CompressionLevels[this.compressionLevel].ColorOffsetBytes;
        const splatColorsArray = new Uint8Array(this.bufferData, section.dataBase + srcSplatColorsBase, 4);

        outColor.set(splatColorsArray[0], splatColorsArray[1],
                     splatColorsArray[2], splatColorsArray[3]);
    }

    fillSplatCenterArray(morphedMesh, outCenterArray, transform, srcFrom, srcTo, destFrom) {
        const splatCount = this.splatCount;

        srcFrom = srcFrom || 0;
        srcTo = srcTo || splatCount - 1;
        if (destFrom === undefined) destFrom = srcFrom;

        const center = new THREE.Vector3();
        for (let i = srcFrom; i <= srcTo; i++) {
            const sectionIndex = this.globalSplatIndexToSectionMap[i];
            const section = this.sections[sectionIndex];
            const localSplatIndex = i - section.splatCountOffset;
            const centerDestBase = (i - srcFrom + destFrom) * SplatBuffer.CenterComponentCount;

            const srcSplatCentersBase = section.bytesPerSplat * localSplatIndex;
            const dataView = new DataView(this.bufferData, section.dataBase + srcSplatCentersBase);

            const x = dataViewFloatForCompressionLevel(dataView, 0, this.compressionLevel);
            const y = dataViewFloatForCompressionLevel(dataView, 1, this.compressionLevel);
            const z = dataViewFloatForCompressionLevel(dataView, 2, this.compressionLevel);
            if (this.compressionLevel >= 1) {
                const bucketIndex = this.getBucketIndex(section, localSplatIndex);
                const bucketBase = bucketIndex * SplatBuffer.BucketStorageSizeFloats;
                const sf = section.compressionScaleFactor;
                const sr = section.compressionScaleRange;
                center.x = (x - sr) * sf + section.bucketArray[bucketBase];
                center.y = (y - sr) * sf + section.bucketArray[bucketBase + 1];
                center.z = (z - sr) * sf + section.bucketArray[bucketBase + 2];
            } else {
                center.x = x;
                center.y = y;
                center.z = z;
            }
            if (transform) {
                center.applyMatrix4(transform);
            }

            outCenterArray[centerDestBase] = center.x + morphedMesh[i * 3 + 0];
            outCenterArray[centerDestBase + 1] = center.y + morphedMesh[i * 3 + 1];
            outCenterArray[centerDestBase + 2] = center.z + morphedMesh[i * 3 + 2];

            // outCenterArray[centerDestBase] = morphedMesh[centerDestBase];
            // outCenterArray[centerDestBase + 1] = morphedMesh[centerDestBase + 1];
            // outCenterArray[centerDestBase + 2] = morphedMesh[centerDestBase + 2];

            // outCenterArray[centerDestBase] = center.x;
            // outCenterArray[centerDestBase + 1] = center.y;
            // outCenterArray[centerDestBase + 2] = center.z;
        }
    }

    fillSplatScaleRotationArray = function() {

        const scaleMatrix = new THREE.Matrix4();
        const rotationMatrix = new THREE.Matrix4();
        const tempMatrix = new THREE.Matrix4();
        const scale = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const tempPosition = new THREE.Vector3();

        const ensurePositiveW = (quaternion) => {
            const flip = quaternion.w < 0 ? -1 : 1;
            quaternion.x *= flip;
            quaternion.y *= flip;
            quaternion.z *= flip;
            quaternion.w *= flip;
        };

        return function(outScaleArray, outRotationArray, transform, srcFrom, srcTo, destFrom,
                        desiredOutputCompressionLevel, scaleOverride) {
            const splatCount = this.splatCount;

            srcFrom = srcFrom || 0;
            srcTo = srcTo || splatCount - 1;
            if (destFrom === undefined) destFrom = srcFrom;

            const outputConversion = (value, srcCompressionLevel) => {
                return convertBetweenCompressionLevels(value, srcCompressionLevel, desiredOutputCompressionLevel);
            };

            for (let i = srcFrom; i <= srcTo; i++) {
                const sectionIndex = this.globalSplatIndexToSectionMap[i];
                const section = this.sections[sectionIndex];
                const localSplatIndex = i - section.splatCountOffset;

                const srcSplatScalesBase = section.bytesPerSplat * localSplatIndex +
                                        SplatBuffer.CompressionLevels[this.compressionLevel].ScaleOffsetBytes;

                const scaleDestBase = (i - srcFrom + destFrom) * SplatBuffer.ScaleComponentCount;
                const rotationDestBase = (i - srcFrom + destFrom) * SplatBuffer.RotationComponentCount;
                const dataView = new DataView(this.bufferData, section.dataBase + srcSplatScalesBase);

                const srcScaleX = (scaleOverride && scaleOverride.x !== undefined) ? scaleOverride.x :
                                   dataViewFloatForCompressionLevel(dataView, 0, this.compressionLevel);
                const srcScaleY = (scaleOverride && scaleOverride.y !== undefined) ? scaleOverride.y :
                                   dataViewFloatForCompressionLevel(dataView, 1, this.compressionLevel);
                const srcScaleZ = (scaleOverride && scaleOverride.z !== undefined) ? scaleOverride.z :
                                   dataViewFloatForCompressionLevel(dataView, 2, this.compressionLevel);

                const srcRotationW = dataViewFloatForCompressionLevel(dataView, 3, this.compressionLevel);
                const srcRotationX = dataViewFloatForCompressionLevel(dataView, 4, this.compressionLevel);
                const srcRotationY = dataViewFloatForCompressionLevel(dataView, 5, this.compressionLevel);
                const srcRotationZ = dataViewFloatForCompressionLevel(dataView, 6, this.compressionLevel);

                scale.set(toUncompressedFloat(srcScaleX, this.compressionLevel),
                          toUncompressedFloat(srcScaleY, this.compressionLevel),
                          toUncompressedFloat(srcScaleZ, this.compressionLevel));

                rotation.set(toUncompressedFloat(srcRotationX, this.compressionLevel),
                             toUncompressedFloat(srcRotationY, this.compressionLevel),
                             toUncompressedFloat(srcRotationZ, this.compressionLevel),
                             toUncompressedFloat(srcRotationW, this.compressionLevel)).normalize();

                if (transform) {
                    tempPosition.set(0, 0, 0);
                    scaleMatrix.makeScale(scale.x, scale.y, scale.z);
                    rotationMatrix.makeRotationFromQuaternion(rotation);
                    tempMatrix.identity().premultiply(scaleMatrix).premultiply(rotationMatrix);
                    tempMatrix.premultiply(transform);
                    tempMatrix.decompose(tempPosition, rotation, scale);
                    rotation.normalize();
                }

                ensurePositiveW(rotation);

                if (outScaleArray) {
                    outScaleArray[scaleDestBase] = outputConversion(scale.x, 0);
                    outScaleArray[scaleDestBase + 1] = outputConversion(scale.y, 0);
                    outScaleArray[scaleDestBase + 2] = outputConversion(scale.z, 0);
                }

                if (outRotationArray) {
                    outRotationArray[rotationDestBase] = outputConversion(rotation.x, 0);
                    outRotationArray[rotationDestBase + 1] = outputConversion(rotation.y, 0);
                    outRotationArray[rotationDestBase + 2] = outputConversion(rotation.z, 0);
                    outRotationArray[rotationDestBase + 3] = outputConversion(rotation.w, 0);
                }
            }
        };
    }();

    static computeCovariance = function() {

        const tempMatrix4 = new THREE.Matrix4();
        const scaleMatrix = new THREE.Matrix3();
        const rotationMatrix = new THREE.Matrix3();
        const covarianceMatrix = new THREE.Matrix3();
        const transformedCovariance = new THREE.Matrix3();
        const transform3x3 = new THREE.Matrix3();
        const transform3x3Transpose = new THREE.Matrix3();

        return function(scale, rotation, transform, outCovariance, outOffset = 0, desiredOutputCompressionLevel) {

            tempMatrix4.makeScale(scale.x, scale.y, scale.z);
            scaleMatrix.setFromMatrix4(tempMatrix4);

            tempMatrix4.makeRotationFromQuaternion(rotation);
            rotationMatrix.setFromMatrix4(tempMatrix4);

            covarianceMatrix.copy(rotationMatrix).multiply(scaleMatrix);
            transformedCovariance.copy(covarianceMatrix).transpose().premultiply(covarianceMatrix);

            if (transform) {
                transform3x3.setFromMatrix4(transform);
                transform3x3Transpose.copy(transform3x3).transpose();
                transformedCovariance.multiply(transform3x3Transpose);
                transformedCovariance.premultiply(transform3x3);
            }

            if (desiredOutputCompressionLevel >= 1) {
                outCovariance[outOffset] = toHalfFloat(transformedCovariance.elements[0]);
                outCovariance[outOffset + 1] = toHalfFloat(transformedCovariance.elements[3]);
                outCovariance[outOffset + 2] = toHalfFloat(transformedCovariance.elements[6]);
                outCovariance[outOffset + 3] = toHalfFloat(transformedCovariance.elements[4]);
                outCovariance[outOffset + 4] = toHalfFloat(transformedCovariance.elements[7]);
                outCovariance[outOffset + 5] = toHalfFloat(transformedCovariance.elements[8]);
            } else {
                outCovariance[outOffset] = transformedCovariance.elements[0];
                outCovariance[outOffset + 1] = transformedCovariance.elements[3];
                outCovariance[outOffset + 2] = transformedCovariance.elements[6];
                outCovariance[outOffset + 3] = transformedCovariance.elements[4];
                outCovariance[outOffset + 4] = transformedCovariance.elements[7];
                outCovariance[outOffset + 5] = transformedCovariance.elements[8];
            }

        };

    }();

    fillSplatCovarianceArray(covarianceArray, transform, srcFrom, srcTo, destFrom, desiredOutputCompressionLevel) {
        const splatCount = this.splatCount;

        const scale = new THREE.Vector3();
        const rotation = new THREE.Quaternion();

        srcFrom = srcFrom || 0;
        srcTo = srcTo || splatCount - 1;
        if (destFrom === undefined) destFrom = srcFrom;

        for (let i = srcFrom; i <= srcTo; i++) {
            const sectionIndex = this.globalSplatIndexToSectionMap[i];
            const section = this.sections[sectionIndex];
            const localSplatIndex = i - section.splatCountOffset;

            const covarianceDestBase = (i - srcFrom + destFrom) * SplatBuffer.CovarianceComponentCount;
            const srcSplatScalesBase = section.bytesPerSplat * localSplatIndex +
                                       SplatBuffer.CompressionLevels[this.compressionLevel].ScaleOffsetBytes;

            const dataView = new DataView(this.bufferData, section.dataBase + srcSplatScalesBase);

            scale.set(toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 0, this.compressionLevel), this.compressionLevel),
                      toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 1, this.compressionLevel), this.compressionLevel),
                      toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 2, this.compressionLevel), this.compressionLevel));

            rotation.set(toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 4, this.compressionLevel), this.compressionLevel),
                         toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 5, this.compressionLevel), this.compressionLevel),
                         toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 6, this.compressionLevel), this.compressionLevel),
                         toUncompressedFloat(dataViewFloatForCompressionLevel(dataView, 3, this.compressionLevel), this.compressionLevel));

            SplatBuffer.computeCovariance(scale, rotation, transform, covarianceArray, covarianceDestBase, desiredOutputCompressionLevel);
        }
    }

    fillSplatColorArray(outColorArray, minimumAlpha, srcFrom, srcTo, destFrom) {
        const splatCount = this.splatCount;

        srcFrom = srcFrom || 0;
        srcTo = srcTo || splatCount - 1;
        if (destFrom === undefined) destFrom = srcFrom;

        for (let i = srcFrom; i <= srcTo; i++) {

            const sectionIndex = this.globalSplatIndexToSectionMap[i];
            const section = this.sections[sectionIndex];
            const localSplatIndex = i - section.splatCountOffset;

            const colorDestBase = (i - srcFrom + destFrom) * SplatBuffer.ColorComponentCount;
            const srcSplatColorsBase = section.bytesPerSplat * localSplatIndex +
                                       SplatBuffer.CompressionLevels[this.compressionLevel].ColorOffsetBytes;

            const dataView = new Uint8Array(this.bufferData, section.dataBase + srcSplatColorsBase);

            let alpha = dataView[3];
            alpha = (alpha >= minimumAlpha) ? alpha : 0;

            outColorArray[colorDestBase] = dataView[0];
            outColorArray[colorDestBase + 1] = dataView[1];
            outColorArray[colorDestBase + 2] = dataView[2];
            outColorArray[colorDestBase + 3] = alpha;
        }
    }

    fillSphericalHarmonicsArray = function() {
        for (let i = 0; i < 15; i++) {
            new THREE.Vector3();
        }

        const tempMatrix3 = new THREE.Matrix3();
        const tempMatrix4 = new THREE.Matrix4();

        const tempTranslation = new THREE.Vector3();
        const tempScale = new THREE.Vector3();
        const tempRotation = new THREE.Quaternion();

        const sh11 = [];
        const sh12 = [];
        const sh13 = [];

        const sh21 = [];
        const sh22 = [];
        const sh23 = [];
        const sh24 = [];
        const sh25 = [];

        const shIn1 = [];
        const shIn2 = [];
        const shIn3 = [];
        const shIn4 = [];
        const shIn5 = [];

        const shOut1 = [];
        const shOut2 = [];
        const shOut3 = [];
        const shOut4 = [];
        const shOut5 = [];

        const noop = (v) => v;

        const set3 = (array, val1, val2, val3) => {
            array[0] = val1;
            array[1] = val2;
            array[2] = val3;
        };

        const set3FromArray = (array, srcDestView, stride, srcBase, compressionLevel) => {
            array[0] = dataViewFloatForCompressionLevel(srcDestView, srcBase, compressionLevel, true);
            array[1] = dataViewFloatForCompressionLevel(srcDestView, srcBase + stride, compressionLevel, true);
            array[2] = dataViewFloatForCompressionLevel(srcDestView, srcBase + stride + stride, compressionLevel, true);
        };

        const copy3 = (srcArray, destArray) => {
            destArray[0] = srcArray[0];
            destArray[1] = srcArray[1];
            destArray[2] = srcArray[2];
        };

        const setOutput3 = (srcArray, destArray, destBase, conversionFunc) => {
            destArray[destBase] = conversionFunc(srcArray[0]);
            destArray[destBase + 1] = conversionFunc(srcArray[1]);
            destArray[destBase + 2] = conversionFunc(srcArray[2]);
        };

        const toUncompressedFloatArray3 = (src, dest, compressionLevel, range8BitMin, range8BitMax) => {
            dest[0] = toUncompressedFloat(src[0], compressionLevel, true, range8BitMin, range8BitMax);
            dest[1] = toUncompressedFloat(src[1], compressionLevel, true, range8BitMin, range8BitMax);
            dest[2] = toUncompressedFloat(src[2], compressionLevel, true, range8BitMin, range8BitMax);
            return dest;
        };

        return function(outSphericalHarmonicsArray, outSphericalHarmonicsDegree, transform,
                        srcFrom, srcTo, destFrom, desiredOutputCompressionLevel) {
            const splatCount = this.splatCount;

            srcFrom = srcFrom || 0;
            srcTo = srcTo || splatCount - 1;
            if (destFrom === undefined) destFrom = srcFrom;

            if (transform && outSphericalHarmonicsDegree >= 1) {
                tempMatrix4.copy(transform);
                tempMatrix4.decompose(tempTranslation, tempRotation, tempScale);
                tempRotation.normalize();
                tempMatrix4.makeRotationFromQuaternion(tempRotation);
                tempMatrix3.setFromMatrix4(tempMatrix4);
                set3(sh11, tempMatrix3.elements[4], -tempMatrix3.elements[7], tempMatrix3.elements[1]);
                set3(sh12, -tempMatrix3.elements[5], tempMatrix3.elements[8], -tempMatrix3.elements[2]);
                set3(sh13, tempMatrix3.elements[3], -tempMatrix3.elements[6], tempMatrix3.elements[0]);
            }

            const localFromHalfFloatToUint8 = (v) => {
                return fromHalfFloatToUint8(v, this.minSphericalHarmonicsCoeff, this.maxSphericalHarmonicsCoeff);
            };

            const localToUint8 = (v) => {
                return toUint8(v, this.minSphericalHarmonicsCoeff, this.maxSphericalHarmonicsCoeff);
            };

            for (let i = srcFrom; i <= srcTo; i++) {

                const sectionIndex = this.globalSplatIndexToSectionMap[i];
                const section = this.sections[sectionIndex];
                outSphericalHarmonicsDegree = Math.min(outSphericalHarmonicsDegree, section.sphericalHarmonicsDegree);
                const outSphericalHarmonicsComponentsCount = getSphericalHarmonicsComponentCountForDegree(outSphericalHarmonicsDegree);

                const localSplatIndex = i - section.splatCountOffset;

                const srcSplatSHBase = section.bytesPerSplat * localSplatIndex +
                                       SplatBuffer.CompressionLevels[this.compressionLevel].SphericalHarmonicsOffsetBytes;

                const dataView = new DataView(this.bufferData, section.dataBase + srcSplatSHBase);

                const shDestBase = (i - srcFrom + destFrom) * outSphericalHarmonicsComponentsCount;

                let compressionLevelForOutputConversion = transform ? 0 : this.compressionLevel;
                let outputConversionFunc = noop;
                if (compressionLevelForOutputConversion !== desiredOutputCompressionLevel) {
                    if (compressionLevelForOutputConversion === 1) {
                        if (desiredOutputCompressionLevel === 0) outputConversionFunc = fromHalfFloat;
                        else if (desiredOutputCompressionLevel == 2) outputConversionFunc = localFromHalfFloatToUint8;
                    } else if (compressionLevelForOutputConversion === 0) {
                        if (desiredOutputCompressionLevel === 1) outputConversionFunc = toHalfFloat;
                        else if (desiredOutputCompressionLevel == 2) outputConversionFunc = localToUint8;
                    }
                }

                const minShCoeff = this.minSphericalHarmonicsCoeff;
                const maxShCoeff = this.maxSphericalHarmonicsCoeff;

                if (outSphericalHarmonicsDegree >= 1) {

                    set3FromArray(shIn1, dataView, 3, 0, this.compressionLevel);
                    set3FromArray(shIn2, dataView, 3, 1, this.compressionLevel);
                    set3FromArray(shIn3, dataView, 3, 2, this.compressionLevel);

                    if (transform) {
                        toUncompressedFloatArray3(shIn1, shIn1, this.compressionLevel, minShCoeff, maxShCoeff);
                        toUncompressedFloatArray3(shIn2, shIn2, this.compressionLevel, minShCoeff, maxShCoeff);
                        toUncompressedFloatArray3(shIn3, shIn3, this.compressionLevel, minShCoeff, maxShCoeff);
                        SplatBuffer.rotateSphericalHarmonics3(shIn1, shIn2, shIn3, sh11, sh12, sh13, shOut1, shOut2, shOut3);
                    } else {
                        copy3(shIn1, shOut1);
                        copy3(shIn2, shOut2);
                        copy3(shIn3, shOut3);
                    }

                    setOutput3(shOut1, outSphericalHarmonicsArray, shDestBase, outputConversionFunc);
                    setOutput3(shOut2, outSphericalHarmonicsArray, shDestBase + 3, outputConversionFunc);
                    setOutput3(shOut3, outSphericalHarmonicsArray, shDestBase + 6, outputConversionFunc);

                    if (outSphericalHarmonicsDegree >= 2) {

                        set3FromArray(shIn1, dataView, 5, 9, this.compressionLevel);
                        set3FromArray(shIn2, dataView, 5, 10, this.compressionLevel);
                        set3FromArray(shIn3, dataView, 5, 11, this.compressionLevel);
                        set3FromArray(shIn4, dataView, 5, 12, this.compressionLevel);
                        set3FromArray(shIn5, dataView, 5, 13, this.compressionLevel);

                        if (transform) {
                            toUncompressedFloatArray3(shIn1, shIn1, this.compressionLevel, minShCoeff, maxShCoeff);
                            toUncompressedFloatArray3(shIn2, shIn2, this.compressionLevel, minShCoeff, maxShCoeff);
                            toUncompressedFloatArray3(shIn3, shIn3, this.compressionLevel, minShCoeff, maxShCoeff);
                            toUncompressedFloatArray3(shIn4, shIn4, this.compressionLevel, minShCoeff, maxShCoeff);
                            toUncompressedFloatArray3(shIn5, shIn5, this.compressionLevel, minShCoeff, maxShCoeff);
                            SplatBuffer.rotateSphericalHarmonics5(shIn1, shIn2, shIn3, shIn4, shIn5,
                                                                  sh11, sh12, sh13, sh21, sh22, sh23, sh24, sh25,
                                                                  shOut1, shOut2, shOut3, shOut4, shOut5);
                        } else {
                            copy3(shIn1, shOut1);
                            copy3(shIn2, shOut2);
                            copy3(shIn3, shOut3);
                            copy3(shIn4, shOut4);
                            copy3(shIn5, shOut5);
                        }

                        setOutput3(shOut1, outSphericalHarmonicsArray, shDestBase + 9, outputConversionFunc);
                        setOutput3(shOut2, outSphericalHarmonicsArray, shDestBase + 12, outputConversionFunc);
                        setOutput3(shOut3, outSphericalHarmonicsArray, shDestBase + 15, outputConversionFunc);
                        setOutput3(shOut4, outSphericalHarmonicsArray, shDestBase + 18, outputConversionFunc);
                        setOutput3(shOut5, outSphericalHarmonicsArray, shDestBase + 21, outputConversionFunc);
                    }
                }
            }
        };

    }();

    static dot3 = (v1, v2, v3, transformRow, outArray) => {
        outArray[0] = outArray[1] = outArray[2] = 0;
        const t0 = transformRow[0];
        const t1 = transformRow[1];
        const t2 = transformRow[2];
        SplatBuffer.addInto3(v1[0] * t0, v1[1] * t0, v1[2] * t0, outArray);
        SplatBuffer.addInto3(v2[0] * t1, v2[1] * t1, v2[2] * t1, outArray);
        SplatBuffer.addInto3(v3[0] * t2, v3[1] * t2, v3[2] * t2, outArray);
    };

    static addInto3 = (val1, val2, val3, destArray) => {
        destArray[0] = destArray[0] + val1;
        destArray[1] = destArray[1] + val2;
        destArray[2] = destArray[2] + val3;
    };

    static dot5 = (v1, v2, v3, v4, v5, transformRow, outArray) => {
        outArray[0] = outArray[1] = outArray[2] = 0;
        const t0 = transformRow[0];
        const t1 = transformRow[1];
        const t2 = transformRow[2];
        const t3 = transformRow[3];
        const t4 = transformRow[4];
        SplatBuffer.addInto3(v1[0] * t0, v1[1] * t0, v1[2] * t0, outArray);
        SplatBuffer.addInto3(v2[0] * t1, v2[1] * t1, v2[2] * t1, outArray);
        SplatBuffer.addInto3(v3[0] * t2, v3[1] * t2, v3[2] * t2, outArray);
        SplatBuffer.addInto3(v4[0] * t3, v4[1] * t3, v4[2] * t3, outArray);
        SplatBuffer.addInto3(v5[0] * t4, v5[1] * t4, v5[2] * t4, outArray);
    };

    static rotateSphericalHarmonics3 = (in1, in2, in3, tsh11, tsh12, tsh13, out1, out2, out3) => {
        SplatBuffer.dot3(in1, in2, in3, tsh11, out1);
        SplatBuffer.dot3(in1, in2, in3, tsh12, out2);
        SplatBuffer.dot3(in1, in2, in3, tsh13, out3);
    };

    static rotateSphericalHarmonics5 = (in1, in2, in3, in4, in5, tsh11, tsh12, tsh13,
                                        tsh21, tsh22, tsh23, tsh24, tsh25, out1, out2, out3, out4, out5) => {

        const kSqrt0104 = Math.sqrt(1.0 / 4.0);
        const kSqrt0304 = Math.sqrt(3.0 / 4.0);
        const kSqrt0103 = Math.sqrt(1.0 / 3.0);
        const kSqrt0403 = Math.sqrt(4.0 / 3.0);
        const kSqrt0112 = Math.sqrt(1.0 / 12.0);

        tsh21[0] = kSqrt0104 * ((tsh13[2] * tsh11[0] + tsh13[0] * tsh11[2]) + (tsh11[2] * tsh13[0] + tsh11[0] * tsh13[2]));
        tsh21[1] = (tsh13[1] * tsh11[0] + tsh11[1] * tsh13[0]);
        tsh21[2] = kSqrt0304 * (tsh13[1] * tsh11[1] + tsh11[1] * tsh13[1]);
        tsh21[3] = (tsh13[1] * tsh11[2] + tsh11[1] * tsh13[2]);
        tsh21[4] = kSqrt0104 * ((tsh13[2] * tsh11[2] - tsh13[0] * tsh11[0]) + (tsh11[2] * tsh13[2] - tsh11[0] * tsh13[0]));
        SplatBuffer.dot5(in1, in2, in3, in4, in5, tsh21, out1);

        tsh22[0] = kSqrt0104 * ((tsh12[2] * tsh11[0] + tsh12[0] * tsh11[2]) + (tsh11[2] * tsh12[0] + tsh11[0] * tsh12[2]));
        tsh22[1] = tsh12[1] * tsh11[0] + tsh11[1] * tsh12[0];
        tsh22[2] = kSqrt0304 * (tsh12[1] * tsh11[1] + tsh11[1] * tsh12[1]);
        tsh22[3] = tsh12[1] * tsh11[2] + tsh11[1] * tsh12[2];
        tsh22[4] = kSqrt0104 * ((tsh12[2] * tsh11[2] - tsh12[0] * tsh11[0]) + (tsh11[2] * tsh12[2] - tsh11[0] * tsh12[0]));
        SplatBuffer.dot5(in1, in2, in3, in4, in5, tsh22, out2);

        tsh23[0] = kSqrt0103 * (tsh12[2] * tsh12[0] + tsh12[0] * tsh12[2]) + -kSqrt0112 *
                   ((tsh13[2] * tsh13[0] + tsh13[0] * tsh13[2]) + (tsh11[2] * tsh11[0] + tsh11[0] * tsh11[2]));
        tsh23[1] = kSqrt0403 * tsh12[1] * tsh12[0] + -kSqrt0103 * (tsh13[1] * tsh13[0] + tsh11[1] * tsh11[0]);
        tsh23[2] = tsh12[1] * tsh12[1] + -kSqrt0104 * (tsh13[1] * tsh13[1] + tsh11[1] * tsh11[1]);
        tsh23[3] = kSqrt0403 * tsh12[1] * tsh12[2] + -kSqrt0103 * (tsh13[1] * tsh13[2] + tsh11[1] * tsh11[2]);
        tsh23[4] = kSqrt0103 * (tsh12[2] * tsh12[2] - tsh12[0] * tsh12[0]) + -kSqrt0112 *
                   ((tsh13[2] * tsh13[2] - tsh13[0] * tsh13[0]) + (tsh11[2] * tsh11[2] - tsh11[0] * tsh11[0]));
        SplatBuffer.dot5(in1, in2, in3, in4, in5, tsh23, out3);

        tsh24[0] = kSqrt0104 * ((tsh12[2] * tsh13[0] + tsh12[0] * tsh13[2]) + (tsh13[2] * tsh12[0] + tsh13[0] * tsh12[2]));
        tsh24[1] = tsh12[1] * tsh13[0] + tsh13[1] * tsh12[0];
        tsh24[2] = kSqrt0304 * (tsh12[1] * tsh13[1] + tsh13[1] * tsh12[1]);
        tsh24[3] = tsh12[1] * tsh13[2] + tsh13[1] * tsh12[2];
        tsh24[4] = kSqrt0104 * ((tsh12[2] * tsh13[2] - tsh12[0] * tsh13[0]) + (tsh13[2] * tsh12[2] - tsh13[0] * tsh12[0]));
        SplatBuffer.dot5(in1, in2, in3, in4, in5, tsh24, out4);

        tsh25[0] = kSqrt0104 * ((tsh13[2] * tsh13[0] + tsh13[0] * tsh13[2]) - (tsh11[2] * tsh11[0] + tsh11[0] * tsh11[2]));
        tsh25[1] = (tsh13[1] * tsh13[0] - tsh11[1] * tsh11[0]);
        tsh25[2] = kSqrt0304 * (tsh13[1] * tsh13[1] - tsh11[1] * tsh11[1]);
        tsh25[3] = (tsh13[1] * tsh13[2] - tsh11[1] * tsh11[2]);
        tsh25[4] = kSqrt0104 * ((tsh13[2] * tsh13[2] - tsh13[0] * tsh13[0]) - (tsh11[2] * tsh11[2] - tsh11[0] * tsh11[0]));
        SplatBuffer.dot5(in1, in2, in3, in4, in5, tsh25, out5);
    };

    static parseHeader(buffer) {
        const headerArrayUint8 = new Uint8Array(buffer, 0, SplatBuffer.HeaderSizeBytes);
        const headerArrayUint16 = new Uint16Array(buffer, 0, SplatBuffer.HeaderSizeBytes / 2);
        const headerArrayUint32 = new Uint32Array(buffer, 0, SplatBuffer.HeaderSizeBytes / 4);
        const headerArrayFloat32 = new Float32Array(buffer, 0, SplatBuffer.HeaderSizeBytes / 4);
        const versionMajor = headerArrayUint8[0];
        const versionMinor = headerArrayUint8[1];
        const maxSectionCount = headerArrayUint32[1];
        const sectionCount = headerArrayUint32[2];
        const maxSplatCount = headerArrayUint32[3];
        const splatCount = headerArrayUint32[4];
        const compressionLevel = headerArrayUint16[10];
        const sceneCenter = new THREE.Vector3(headerArrayFloat32[6], headerArrayFloat32[7], headerArrayFloat32[8]);

        const minSphericalHarmonicsCoeff = headerArrayFloat32[9] || -DefaultSphericalHarmonics8BitCompressionHalfRange;
        const maxSphericalHarmonicsCoeff = headerArrayFloat32[10] || DefaultSphericalHarmonics8BitCompressionHalfRange;

        return {
            versionMajor,
            versionMinor,
            maxSectionCount,
            sectionCount,
            maxSplatCount,
            splatCount,
            compressionLevel,
            sceneCenter,
            minSphericalHarmonicsCoeff,
            maxSphericalHarmonicsCoeff
        };
    }

    static writeHeaderCountsToBuffer(sectionCount, splatCount, buffer) {
        const headerArrayUint32 = new Uint32Array(buffer, 0, SplatBuffer.HeaderSizeBytes / 4);
        headerArrayUint32[2] = sectionCount;
        headerArrayUint32[4] = splatCount;
    }

    static writeHeaderToBuffer(header, buffer) {
        const headerArrayUint8 = new Uint8Array(buffer, 0, SplatBuffer.HeaderSizeBytes);
        const headerArrayUint16 = new Uint16Array(buffer, 0, SplatBuffer.HeaderSizeBytes / 2);
        const headerArrayUint32 = new Uint32Array(buffer, 0, SplatBuffer.HeaderSizeBytes / 4);
        const headerArrayFloat32 = new Float32Array(buffer, 0, SplatBuffer.HeaderSizeBytes / 4);
        headerArrayUint8[0] = header.versionMajor;
        headerArrayUint8[1] = header.versionMinor;
        headerArrayUint8[2] = 0; // unused for now
        headerArrayUint8[3] = 0; // unused for now
        headerArrayUint32[1] = header.maxSectionCount;
        headerArrayUint32[2] = header.sectionCount;
        headerArrayUint32[3] = header.maxSplatCount;
        headerArrayUint32[4] = header.splatCount;
        headerArrayUint16[10] = header.compressionLevel;
        headerArrayFloat32[6] = header.sceneCenter.x;
        headerArrayFloat32[7] = header.sceneCenter.y;
        headerArrayFloat32[8] = header.sceneCenter.z;
        headerArrayFloat32[9] = header.minSphericalHarmonicsCoeff || -DefaultSphericalHarmonics8BitCompressionHalfRange;
        headerArrayFloat32[10] = header.maxSphericalHarmonicsCoeff || DefaultSphericalHarmonics8BitCompressionHalfRange;
    }

    static parseSectionHeaders(header, buffer, offset = 0, secLoadedCountsToMax) {
        const compressionLevel = header.compressionLevel;

        const maxSectionCount = header.maxSectionCount;
        const sectionHeaderArrayUint16 = new Uint16Array(buffer, offset, maxSectionCount * SplatBuffer.SectionHeaderSizeBytes / 2);
        const sectionHeaderArrayUint32 = new Uint32Array(buffer, offset, maxSectionCount * SplatBuffer.SectionHeaderSizeBytes / 4);
        const sectionHeaderArrayFloat32 = new Float32Array(buffer, offset, maxSectionCount * SplatBuffer.SectionHeaderSizeBytes / 4);

        const sectionHeaders = [];
        let sectionHeaderBase = 0;
        let sectionHeaderBaseUint16 = sectionHeaderBase / 2;
        let sectionHeaderBaseUint32 = sectionHeaderBase / 4;
        let sectionBase = SplatBuffer.HeaderSizeBytes + header.maxSectionCount * SplatBuffer.SectionHeaderSizeBytes;
        let splatCountOffset = 0;
        for (let i = 0; i < maxSectionCount; i++) {
            const maxSplatCount = sectionHeaderArrayUint32[sectionHeaderBaseUint32 + 1];
            const bucketSize = sectionHeaderArrayUint32[sectionHeaderBaseUint32 + 2];
            const bucketCount = sectionHeaderArrayUint32[sectionHeaderBaseUint32 + 3];
            const bucketBlockSize = sectionHeaderArrayFloat32[sectionHeaderBaseUint32 + 4];
            const halfBucketBlockSize = bucketBlockSize / 2.0;
            const bucketStorageSizeBytes = sectionHeaderArrayUint16[sectionHeaderBaseUint16 + 10];
            const compressionScaleRange = sectionHeaderArrayUint32[sectionHeaderBaseUint32 + 6] ||
                                          SplatBuffer.CompressionLevels[compressionLevel].ScaleRange;
            const fullBucketCount = sectionHeaderArrayUint32[sectionHeaderBaseUint32 + 8];
            const partiallyFilledBucketCount = sectionHeaderArrayUint32[sectionHeaderBaseUint32 + 9];
            const bucketsMetaDataSizeBytes = partiallyFilledBucketCount * 4;
            const bucketsStorageSizeBytes = bucketStorageSizeBytes * bucketCount + bucketsMetaDataSizeBytes;

            const sphericalHarmonicsDegree = sectionHeaderArrayUint16[sectionHeaderBaseUint16 + 20];
            const { bytesPerSplat } = SplatBuffer.calculateComponentStorage(compressionLevel, sphericalHarmonicsDegree);

            const splatDataStorageSizeBytes = bytesPerSplat * maxSplatCount;
            const storageSizeBytes = splatDataStorageSizeBytes + bucketsStorageSizeBytes;
            const sectionHeader = {
                bytesPerSplat: bytesPerSplat,
                splatCountOffset: splatCountOffset,
                splatCount: secLoadedCountsToMax ? maxSplatCount : 0,
                maxSplatCount: maxSplatCount,
                bucketSize: bucketSize,
                bucketCount: bucketCount,
                bucketBlockSize: bucketBlockSize,
                halfBucketBlockSize: halfBucketBlockSize,
                bucketStorageSizeBytes: bucketStorageSizeBytes,
                bucketsStorageSizeBytes: bucketsStorageSizeBytes,
                splatDataStorageSizeBytes: splatDataStorageSizeBytes,
                storageSizeBytes: storageSizeBytes,
                compressionScaleRange: compressionScaleRange,
                compressionScaleFactor: halfBucketBlockSize / compressionScaleRange,
                base: sectionBase,
                bucketsBase: sectionBase + bucketsMetaDataSizeBytes,
                dataBase: sectionBase + bucketsStorageSizeBytes,
                fullBucketCount: fullBucketCount,
                partiallyFilledBucketCount: partiallyFilledBucketCount,
                sphericalHarmonicsDegree: sphericalHarmonicsDegree
            };
            sectionHeaders[i] = sectionHeader;
            sectionBase += storageSizeBytes;
            sectionHeaderBase += SplatBuffer.SectionHeaderSizeBytes;
            sectionHeaderBaseUint16 = sectionHeaderBase / 2;
            sectionHeaderBaseUint32 = sectionHeaderBase / 4;
            splatCountOffset += maxSplatCount;
        }

        return sectionHeaders;
    }


    static writeSectionHeaderToBuffer(sectionHeader, compressionLevel, buffer, offset = 0) {
        const sectionHeadeArrayUint16 = new Uint16Array(buffer, offset, SplatBuffer.SectionHeaderSizeBytes / 2);
        const sectionHeadeArrayUint32 = new Uint32Array(buffer, offset, SplatBuffer.SectionHeaderSizeBytes / 4);
        const sectionHeadeArrayFloat32 = new Float32Array(buffer, offset, SplatBuffer.SectionHeaderSizeBytes / 4);

        sectionHeadeArrayUint32[0] = sectionHeader.splatCount;
        sectionHeadeArrayUint32[1] = sectionHeader.maxSplatCount;
        sectionHeadeArrayUint32[2] = compressionLevel >= 1 ? sectionHeader.bucketSize : 0;
        sectionHeadeArrayUint32[3] = compressionLevel >= 1 ? sectionHeader.bucketCount : 0;
        sectionHeadeArrayFloat32[4] = compressionLevel >= 1 ? sectionHeader.bucketBlockSize : 0.0;
        sectionHeadeArrayUint16[10] = compressionLevel >= 1 ? SplatBuffer.BucketStorageSizeBytes : 0;
        sectionHeadeArrayUint32[6] = compressionLevel >= 1 ? sectionHeader.compressionScaleRange : 0;
        sectionHeadeArrayUint32[7] = sectionHeader.storageSizeBytes;
        sectionHeadeArrayUint32[8] = compressionLevel >= 1 ? sectionHeader.fullBucketCount : 0;
        sectionHeadeArrayUint32[9] = compressionLevel >= 1 ? sectionHeader.partiallyFilledBucketCount : 0;
        sectionHeadeArrayUint16[20] = sectionHeader.sphericalHarmonicsDegree;

    }

    static writeSectionHeaderSplatCountToBuffer(splatCount, buffer, offset = 0) {
        const sectionHeadeArrayUint32 = new Uint32Array(buffer, offset, SplatBuffer.SectionHeaderSizeBytes / 4);
        sectionHeadeArrayUint32[0] = splatCount;
    }

    constructFromBuffer(bufferData, secLoadedCountsToMax) {
        this.bufferData = bufferData;

        this.globalSplatIndexToLocalSplatIndexMap = [];
        this.globalSplatIndexToSectionMap = [];

        const header = SplatBuffer.parseHeader(this.bufferData);
        this.versionMajor = header.versionMajor;
        this.versionMinor = header.versionMinor;
        this.maxSectionCount = header.maxSectionCount;
        this.sectionCount = secLoadedCountsToMax ? header.maxSectionCount : 0;
        this.maxSplatCount = header.maxSplatCount;
        this.splatCount = secLoadedCountsToMax ? header.maxSplatCount : 0;
        this.compressionLevel = header.compressionLevel;
        this.sceneCenter = new THREE.Vector3().copy(header.sceneCenter);
        this.minSphericalHarmonicsCoeff = header.minSphericalHarmonicsCoeff;
        this.maxSphericalHarmonicsCoeff = header.maxSphericalHarmonicsCoeff;

        this.sections = SplatBuffer.parseSectionHeaders(header, this.bufferData, SplatBuffer.HeaderSizeBytes, secLoadedCountsToMax);

        this.linkBufferArrays();
        this.buildMaps();
    }

    static calculateComponentStorage(compressionLevel, sphericalHarmonicsDegree) {
        const bytesPerCenter = SplatBuffer.CompressionLevels[compressionLevel].BytesPerCenter;
        const bytesPerScale = SplatBuffer.CompressionLevels[compressionLevel].BytesPerScale;
        const bytesPerRotation = SplatBuffer.CompressionLevels[compressionLevel].BytesPerRotation;
        const bytesPerColor = SplatBuffer.CompressionLevels[compressionLevel].BytesPerColor;
        const sphericalHarmonicsComponentsPerSplat = getSphericalHarmonicsComponentCountForDegree(sphericalHarmonicsDegree);
        const sphericalHarmonicsBytesPerSplat = SplatBuffer.CompressionLevels[compressionLevel].BytesPerSphericalHarmonicsComponent *
                                                sphericalHarmonicsComponentsPerSplat;
        const bytesPerSplat = bytesPerCenter + bytesPerScale + bytesPerRotation +
                              bytesPerColor + sphericalHarmonicsBytesPerSplat;
        return {
            bytesPerCenter,
            bytesPerScale,
            bytesPerRotation,
            bytesPerColor,
            sphericalHarmonicsComponentsPerSplat,
            sphericalHarmonicsBytesPerSplat,
            bytesPerSplat
        };
    }

    linkBufferArrays() {
        for (let i = 0; i < this.maxSectionCount; i++) {
            const section = this.sections[i];
            section.bucketArray = new Float32Array(this.bufferData, section.bucketsBase,
                                                   section.bucketCount * SplatBuffer.BucketStorageSizeFloats);
            if (section.partiallyFilledBucketCount > 0) {
                section.partiallyFilledBucketLengths = new Uint32Array(this.bufferData, section.base,
                                                                       section.partiallyFilledBucketCount);
            }
        }
    }

    buildMaps() {
        let cumulativeSplatCount = 0;
        for (let i = 0; i < this.maxSectionCount; i++) {
            const section = this.sections[i];
            for (let j = 0; j < section.maxSplatCount; j++) {
                const globalSplatIndex = cumulativeSplatCount + j;
                this.globalSplatIndexToLocalSplatIndexMap[globalSplatIndex] = j;
                this.globalSplatIndexToSectionMap[globalSplatIndex] = i;
            }
            cumulativeSplatCount += section.maxSplatCount;
        }
    }

    updateLoadedCounts(newSectionCount, newSplatCount) {
        SplatBuffer.writeHeaderCountsToBuffer(newSectionCount, newSplatCount, this.bufferData);
        this.sectionCount = newSectionCount;
        this.splatCount = newSplatCount;
    }

    updateSectionLoadedCounts(sectionIndex, newSplatCount) {
        const sectionHeaderOffset = SplatBuffer.HeaderSizeBytes + SplatBuffer.SectionHeaderSizeBytes * sectionIndex;
        SplatBuffer.writeSectionHeaderSplatCountToBuffer(newSplatCount, this.bufferData, sectionHeaderOffset);
        this.sections[sectionIndex].splatCount = newSplatCount;
    }

    static writeSplatDataToSectionBuffer = function() {

        const tempCenterBuffer = new ArrayBuffer(12);
        const tempScaleBuffer = new ArrayBuffer(12);
        const tempRotationBuffer = new ArrayBuffer(16);
        const tempColorBuffer = new ArrayBuffer(4);
        const tempSHBuffer = new ArrayBuffer(256);
        const tempRot = new THREE.Quaternion();
        const tempScale = new THREE.Vector3();
        const bucketCenterDelta = new THREE.Vector3();

        const {
            X: OFFSET_X, Y: OFFSET_Y, Z: OFFSET_Z,
            SCALE0: OFFSET_SCALE0, SCALE1: OFFSET_SCALE1, SCALE2: OFFSET_SCALE2,
            ROTATION0: OFFSET_ROT0, ROTATION1: OFFSET_ROT1, ROTATION2: OFFSET_ROT2, ROTATION3: OFFSET_ROT3,
            FDC0: OFFSET_FDC0, FDC1: OFFSET_FDC1, FDC2: OFFSET_FDC2, OPACITY: OFFSET_OPACITY,
            FRC0: OFFSET_FRC0, FRC9: OFFSET_FRC9,
        } = UncompressedSplatArray.OFFSET;

        const compressPositionOffset = (v, compressionScaleFactor, compressionScaleRange) => {
            const doubleCompressionScaleRange = compressionScaleRange * 2 + 1;
            v = Math.round(v * compressionScaleFactor) + compressionScaleRange;
            return clamp(v, 0, doubleCompressionScaleRange);
        };

        return function(targetSplat, sectionBuffer, bufferOffset, compressionLevel, sphericalHarmonicsDegree,
                        bucketCenter, compressionScaleFactor, compressionScaleRange,
                        minSphericalHarmonicsCoeff = -DefaultSphericalHarmonics8BitCompressionHalfRange,
                        maxSphericalHarmonicsCoeff = DefaultSphericalHarmonics8BitCompressionHalfRange) {

            const sphericalHarmonicsComponentsPerSplat = getSphericalHarmonicsComponentCountForDegree(sphericalHarmonicsDegree);
            const bytesPerCenter = SplatBuffer.CompressionLevels[compressionLevel].BytesPerCenter;
            const bytesPerScale = SplatBuffer.CompressionLevels[compressionLevel].BytesPerScale;
            const bytesPerRotation = SplatBuffer.CompressionLevels[compressionLevel].BytesPerRotation;
            const bytesPerColor = SplatBuffer.CompressionLevels[compressionLevel].BytesPerColor;

            const centerBase = bufferOffset;
            const scaleBase = centerBase + bytesPerCenter;
            const rotationBase = scaleBase + bytesPerScale;
            const colorBase = rotationBase + bytesPerRotation;
            const sphericalHarmonicsBase = colorBase + bytesPerColor;

            if (targetSplat[OFFSET_ROT0] !== undefined) {
                tempRot.set(targetSplat[OFFSET_ROT0], targetSplat[OFFSET_ROT1], targetSplat[OFFSET_ROT2], targetSplat[OFFSET_ROT3]);
                tempRot.normalize();
            } else {
                tempRot.set(1.0, 0.0, 0.0, 0.0);
            }

            if (targetSplat[OFFSET_SCALE0] !== undefined) {
                tempScale.set(targetSplat[OFFSET_SCALE0] || 0,
                              targetSplat[OFFSET_SCALE1] || 0,
                              targetSplat[OFFSET_SCALE2] || 0);
            } else {
                tempScale.set(0, 0, 0);
            }

            if (compressionLevel === 0) {
                const center = new Float32Array(sectionBuffer, centerBase, SplatBuffer.CenterComponentCount);
                const rot = new Float32Array(sectionBuffer, rotationBase, SplatBuffer.RotationComponentCount);
                const scale = new Float32Array(sectionBuffer, scaleBase, SplatBuffer.ScaleComponentCount);

                rot.set([tempRot.x, tempRot.y, tempRot.z, tempRot.w]);
                scale.set([tempScale.x, tempScale.y, tempScale.z]);
                center.set([targetSplat[OFFSET_X], targetSplat[OFFSET_Y], targetSplat[OFFSET_Z]]);

                if (sphericalHarmonicsDegree > 0) {
                    const shOut = new Float32Array(sectionBuffer, sphericalHarmonicsBase, sphericalHarmonicsComponentsPerSplat);
                    if (sphericalHarmonicsDegree >= 1) {
                            for (let s = 0; s < 9; s++) shOut[s] = targetSplat[OFFSET_FRC0 + s] || 0;
                            if (sphericalHarmonicsDegree >= 2) {
                                for (let s = 0; s < 15; s++) shOut[s + 9] = targetSplat[OFFSET_FRC9 + s] || 0;
                            }
                    }
                }
            } else {
                const center = new Uint16Array(tempCenterBuffer, 0, SplatBuffer.CenterComponentCount);
                const rot = new Uint16Array(tempRotationBuffer, 0, SplatBuffer.RotationComponentCount);
                const scale = new Uint16Array(tempScaleBuffer, 0, SplatBuffer.ScaleComponentCount);

                rot.set([toHalfFloat(tempRot.x), toHalfFloat(tempRot.y), toHalfFloat(tempRot.z), toHalfFloat(tempRot.w)]);
                scale.set([toHalfFloat(tempScale.x), toHalfFloat(tempScale.y), toHalfFloat(tempScale.z)]);

                bucketCenterDelta.set(targetSplat[OFFSET_X], targetSplat[OFFSET_Y], targetSplat[OFFSET_Z]).sub(bucketCenter);
                bucketCenterDelta.x = compressPositionOffset(bucketCenterDelta.x, compressionScaleFactor, compressionScaleRange);
                bucketCenterDelta.y = compressPositionOffset(bucketCenterDelta.y, compressionScaleFactor, compressionScaleRange);
                bucketCenterDelta.z = compressPositionOffset(bucketCenterDelta.z, compressionScaleFactor, compressionScaleRange);
                center.set([bucketCenterDelta.x, bucketCenterDelta.y, bucketCenterDelta.z]);

                if (sphericalHarmonicsDegree > 0) {
                    const SHArrayType = compressionLevel === 1 ? Uint16Array : Uint8Array;
                    const bytesPerSHComponent = compressionLevel === 1 ? 2 : 1;
                    const shOut = new SHArrayType(tempSHBuffer, 0, sphericalHarmonicsComponentsPerSplat);
                    if (sphericalHarmonicsDegree >= 1) {
                        for (let s = 0; s < 9; s++) {
                            const srcVal = targetSplat[OFFSET_FRC0 + s] || 0;
                            shOut[s] = compressionLevel === 1 ? toHalfFloat(srcVal) :
                                       toUint8(srcVal, minSphericalHarmonicsCoeff, maxSphericalHarmonicsCoeff);
                        }
                        const degree1ByteCount = 9 * bytesPerSHComponent;
                        copyBetweenBuffers(shOut.buffer, 0, sectionBuffer, sphericalHarmonicsBase, degree1ByteCount);
                        if (sphericalHarmonicsDegree >= 2) {
                            for (let s = 0; s < 15; s++) {
                                const srcVal = targetSplat[OFFSET_FRC9 + s] || 0;
                                shOut[s + 9] = compressionLevel === 1 ? toHalfFloat(srcVal) :
                                               toUint8(srcVal, minSphericalHarmonicsCoeff, maxSphericalHarmonicsCoeff);
                            }
                            copyBetweenBuffers(shOut.buffer, degree1ByteCount, sectionBuffer,
                                               sphericalHarmonicsBase + degree1ByteCount, 15 * bytesPerSHComponent);
                        }
                    }
                }

                copyBetweenBuffers(center.buffer, 0, sectionBuffer, centerBase, 6);
                copyBetweenBuffers(scale.buffer, 0, sectionBuffer, scaleBase, 6);
                copyBetweenBuffers(rot.buffer, 0, sectionBuffer, rotationBase, 8);
            }

            const rgba = new Uint8ClampedArray(tempColorBuffer, 0, 4);
            rgba.set([targetSplat[OFFSET_FDC0] || 0, targetSplat[OFFSET_FDC1] || 0, targetSplat[OFFSET_FDC2] || 0]);
            rgba[3] = targetSplat[OFFSET_OPACITY] || 0;

            copyBetweenBuffers(rgba.buffer, 0, sectionBuffer, colorBase, 4);
        };

    }();

    static generateFromUncompressedSplatArrays(splatArrays, minimumAlpha, compressionLevel,
                                               sceneCenter, blockSize, bucketSize, options = []) {

        let shDegree = 0;
        for (let sa = 0; sa < splatArrays.length; sa ++) {
            const splatArray = splatArrays[sa];
            shDegree = Math.max(splatArray.sphericalHarmonicsDegree, shDegree);
        }

        let minSphericalHarmonicsCoeff;
        let maxSphericalHarmonicsCoeff;

        for (let sa = 0; sa < splatArrays.length; sa ++) {
            const splatArray = splatArrays[sa];
            for (let i = 0; i < splatArray.splats.length; i++) {
                const splat = splatArray.splats[i];
                for (let sc = UncompressedSplatArray.OFFSET.FRC0; sc < UncompressedSplatArray.OFFSET.FRC23 && sc < splat.length; sc++) {
                    if (!minSphericalHarmonicsCoeff || splat[sc] < minSphericalHarmonicsCoeff) {
                        minSphericalHarmonicsCoeff = splat[sc];
                    }
                    if (!maxSphericalHarmonicsCoeff || splat[sc] > maxSphericalHarmonicsCoeff) {
                        maxSphericalHarmonicsCoeff = splat[sc];
                    }
                }
            }
        }

        minSphericalHarmonicsCoeff = minSphericalHarmonicsCoeff || -DefaultSphericalHarmonics8BitCompressionHalfRange;
        maxSphericalHarmonicsCoeff = maxSphericalHarmonicsCoeff || DefaultSphericalHarmonics8BitCompressionHalfRange;

        const { bytesPerSplat } = SplatBuffer.calculateComponentStorage(compressionLevel, shDegree);
        const compressionScaleRange = SplatBuffer.CompressionLevels[compressionLevel].ScaleRange;

        const sectionBuffers = [];
        const sectionHeaderBuffers = [];
        let totalSplatCount = 0;

        for (let sa = 0; sa < splatArrays.length; sa ++) {
            const splatArray = splatArrays[sa];
            const validSplats = new UncompressedSplatArray(shDegree);
            for (let i = 0; i < splatArray.splatCount; i++) {
                const targetSplat = splatArray.splats[i];
                if ((targetSplat[UncompressedSplatArray.OFFSET.OPACITY] || 0) >= minimumAlpha) {
                    validSplats.addSplat(targetSplat);
                }
            }

            const sectionOptions = options[sa] || {};
            const sectionBlockSize = (sectionOptions.blockSizeFactor || 1) * (blockSize || SplatBuffer.BucketBlockSize);
            const sectionBucketSize = Math.ceil((sectionOptions.bucketSizeFactor || 1) * (bucketSize || SplatBuffer.BucketSize));

            const bucketInfo = SplatBuffer.computeBucketsForUncompressedSplatArray(validSplats, sectionBlockSize, sectionBucketSize);
            const fullBucketCount = bucketInfo.fullBuckets.length;
            const partiallyFullBucketLengths = bucketInfo.partiallyFullBuckets.map((bucket) => bucket.splats.length);
            const partiallyFilledBucketCount = partiallyFullBucketLengths.length;
            const buckets = [...bucketInfo.fullBuckets, ...bucketInfo.partiallyFullBuckets];

            const sectionDataSizeBytes = validSplats.splats.length * bytesPerSplat;
            const bucketMetaDataSizeBytes = partiallyFilledBucketCount * 4;
            const bucketDataBytes = compressionLevel >= 1 ? buckets.length *
                                                            SplatBuffer.BucketStorageSizeBytes + bucketMetaDataSizeBytes : 0;
            const sectionSizeBytes = sectionDataSizeBytes + bucketDataBytes;
            const sectionBuffer = new ArrayBuffer(sectionSizeBytes);

            const compressionScaleFactor = compressionScaleRange / (sectionBlockSize * 0.5);
            const bucketCenter = new THREE.Vector3();

            let outSplatCount = 0;
            for (let b = 0; b < buckets.length; b++) {
                const bucket = buckets[b];
                bucketCenter.fromArray(bucket.center);
                for (let i = 0; i < bucket.splats.length; i++) {
                    let row = bucket.splats[i];
                    const targetSplat = validSplats.splats[row];
                    const bufferOffset = bucketDataBytes + outSplatCount * bytesPerSplat;
                    SplatBuffer.writeSplatDataToSectionBuffer(targetSplat, sectionBuffer, bufferOffset, compressionLevel, shDegree,
                                                              bucketCenter, compressionScaleFactor, compressionScaleRange,
                                                              minSphericalHarmonicsCoeff, maxSphericalHarmonicsCoeff);
                    outSplatCount++;
                }
            }
            totalSplatCount += outSplatCount;

            if (compressionLevel >= 1) {
                const bucketMetaDataArray = new Uint32Array(sectionBuffer, 0, partiallyFullBucketLengths.length * 4);
                for (let pfb = 0; pfb < partiallyFullBucketLengths.length; pfb ++) {
                    bucketMetaDataArray[pfb] = partiallyFullBucketLengths[pfb];
                }
                const bucketArray = new Float32Array(sectionBuffer, bucketMetaDataSizeBytes,
                                                     buckets.length * SplatBuffer.BucketStorageSizeFloats);
                for (let b = 0; b < buckets.length; b++) {
                    const bucket = buckets[b];
                    const base = b * 3;
                    bucketArray[base] = bucket.center[0];
                    bucketArray[base + 1] = bucket.center[1];
                    bucketArray[base + 2] = bucket.center[2];
                }
            }
            sectionBuffers.push(sectionBuffer);

            const sectionHeaderBuffer = new ArrayBuffer(SplatBuffer.SectionHeaderSizeBytes);
            SplatBuffer.writeSectionHeaderToBuffer({
                maxSplatCount: outSplatCount,
                splatCount: outSplatCount,
                bucketSize: sectionBucketSize,
                bucketCount: buckets.length,
                bucketBlockSize: sectionBlockSize,
                compressionScaleRange: compressionScaleRange,
                storageSizeBytes: sectionSizeBytes,
                fullBucketCount: fullBucketCount,
                partiallyFilledBucketCount: partiallyFilledBucketCount,
                sphericalHarmonicsDegree: shDegree
            }, compressionLevel, sectionHeaderBuffer, 0);
            sectionHeaderBuffers.push(sectionHeaderBuffer);

        }

        let sectionsCumulativeSizeBytes = 0;
        for (let sectionBuffer of sectionBuffers) sectionsCumulativeSizeBytes += sectionBuffer.byteLength;
        const unifiedBufferSize = SplatBuffer.HeaderSizeBytes +
                                  SplatBuffer.SectionHeaderSizeBytes * sectionBuffers.length + sectionsCumulativeSizeBytes;
        const unifiedBuffer = new ArrayBuffer(unifiedBufferSize);

        SplatBuffer.writeHeaderToBuffer({
            versionMajor: 0,
            versionMinor: 1,
            maxSectionCount: sectionBuffers.length,
            sectionCount: sectionBuffers.length,
            maxSplatCount: totalSplatCount,
            splatCount: totalSplatCount,
            compressionLevel: compressionLevel,
            sceneCenter: sceneCenter,
            minSphericalHarmonicsCoeff: minSphericalHarmonicsCoeff,
            maxSphericalHarmonicsCoeff: maxSphericalHarmonicsCoeff
        }, unifiedBuffer);

        let currentUnifiedBase = SplatBuffer.HeaderSizeBytes;
        for (let sectionHeaderBuffer of sectionHeaderBuffers) {
            new Uint8Array(unifiedBuffer, currentUnifiedBase, SplatBuffer.SectionHeaderSizeBytes).set(new Uint8Array(sectionHeaderBuffer));
            currentUnifiedBase += SplatBuffer.SectionHeaderSizeBytes;
        }

        for (let sectionBuffer of sectionBuffers) {
            new Uint8Array(unifiedBuffer, currentUnifiedBase, sectionBuffer.byteLength).set(new Uint8Array(sectionBuffer));
            currentUnifiedBase += sectionBuffer.byteLength;
        }

        const splatBuffer = new SplatBuffer(unifiedBuffer);
        return splatBuffer;
    }

    static computeBucketsForUncompressedSplatArray(splatArray, blockSize, bucketSize) {
        let splatCount = splatArray.splatCount;
        const halfBlockSize = blockSize / 2.0;

        const min = new THREE.Vector3();
        const max = new THREE.Vector3();

        for (let i = 0; i < splatCount; i++) {
            const targetSplat = splatArray.splats[i];
            const center = [targetSplat[UncompressedSplatArray.OFFSET.X],
                            targetSplat[UncompressedSplatArray.OFFSET.Y],
                            targetSplat[UncompressedSplatArray.OFFSET.Z]];
            if (i === 0 || center[0] < min.x) min.x = center[0];
            if (i === 0 || center[0] > max.x) max.x = center[0];
            if (i === 0 || center[1] < min.y) min.y = center[1];
            if (i === 0 || center[1] > max.y) max.y = center[1];
            if (i === 0 || center[2] < min.z) min.z = center[2];
            if (i === 0 || center[2] > max.z) max.z = center[2];
        }

        const dimensions = new THREE.Vector3().copy(max).sub(min);
        const yBlocks = Math.ceil(dimensions.y / blockSize);
        const zBlocks = Math.ceil(dimensions.z / blockSize);

        const blockCenter = new THREE.Vector3();
        const fullBuckets = [];
        const partiallyFullBuckets = {};

        for (let i = 0; i < splatCount; i++) {
            const targetSplat = splatArray.splats[i];
            const center = [targetSplat[UncompressedSplatArray.OFFSET.X],
                            targetSplat[UncompressedSplatArray.OFFSET.Y],
                            targetSplat[UncompressedSplatArray.OFFSET.Z]];
            const xBlock = Math.floor((center[0] - min.x) / blockSize);
            const yBlock = Math.floor((center[1] - min.y) / blockSize);
            const zBlock = Math.floor((center[2] - min.z) / blockSize);

            blockCenter.x = xBlock * blockSize + min.x + halfBlockSize;
            blockCenter.y = yBlock * blockSize + min.y + halfBlockSize;
            blockCenter.z = zBlock * blockSize + min.z + halfBlockSize;

            const bucketId = xBlock * (yBlocks * zBlocks) + yBlock * zBlocks + zBlock;
            let bucket = partiallyFullBuckets[bucketId];
            if (!bucket) {
                partiallyFullBuckets[bucketId] = bucket = {
                    'splats': [],
                    'center': blockCenter.toArray()
                };
            }

            bucket.splats.push(i);
            if (bucket.splats.length >= bucketSize) {
                fullBuckets.push(bucket);
                partiallyFullBuckets[bucketId] = null;
            }
        }

        const partiallyFullBucketArray = [];
        for (let bucketId in partiallyFullBuckets) {
            if (Object.hasOwn(partiallyFullBuckets, bucketId)) {
                const bucket = partiallyFullBuckets[bucketId];
                if (bucket) {
                    partiallyFullBucketArray.push(bucket);
                }
            }
        }

        return {
            'fullBuckets': fullBuckets,
            'partiallyFullBuckets': partiallyFullBucketArray,
        };
    }

}

/**
 * SplatPartitioner
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */


class SplatPartitioner {

    constructor(sectionCount, sectionFilters, groupingParameters, partitionGenerator) {
        this.sectionCount = sectionCount;
        this.sectionFilters = sectionFilters;
        this.groupingParameters = groupingParameters;
        this.partitionGenerator = partitionGenerator;
    }

    partitionUncompressedSplatArray(splatArray) {
        let groupingParameters;
        let sectionCount;
        let sectionFilters;
        if (this.partitionGenerator) {
            const results = this.partitionGenerator(splatArray);
            groupingParameters = results.groupingParameters;
            sectionCount = results.sectionCount;
            sectionFilters = results.sectionFilters;
        } else {
            groupingParameters = this.groupingParameters;
            sectionCount = this.sectionCount;
            sectionFilters = this.sectionFilters;
        }

        const newArrays = [];
        for (let s = 0; s < sectionCount; s++) {
            const sectionSplats = new UncompressedSplatArray(splatArray.sphericalHarmonicsDegree);
            const sectionFilter = sectionFilters[s];
            for (let i = 0; i < splatArray.splatCount; i++) {
                if (sectionFilter(i)) {
                    sectionSplats.addSplat(splatArray.splats[i]);
                }
            }
            newArrays.push(sectionSplats);
        }
        return {
            splatArrays: newArrays,
            parameters: groupingParameters
        };
    }

    static getStandardPartitioner(partitionSize = 0, sceneCenter = new THREE.Vector3(),
                                  blockSize = SplatBuffer.BucketBlockSize, bucketSize = SplatBuffer.BucketSize) {

        const partitionGenerator = (splatArray) => {

            const OFFSET_X = UncompressedSplatArray.OFFSET.X;
            const OFFSET_Y = UncompressedSplatArray.OFFSET.Y;
            const OFFSET_Z = UncompressedSplatArray.OFFSET.Z;

            if (partitionSize <= 0) partitionSize = splatArray.splatCount;

            const center = new THREE.Vector3();
            const clampDistance = 0.5;
            const clampPoint = (point) => {
                point.x = Math.floor(point.x / clampDistance) * clampDistance;
                point.y = Math.floor(point.y / clampDistance) * clampDistance;
                point.z = Math.floor(point.z / clampDistance) * clampDistance;
            };
            splatArray.splats.forEach((splat) => {
                center.set(splat[OFFSET_X], splat[OFFSET_Y], splat[OFFSET_Z]).sub(sceneCenter);
                clampPoint(center);
                splat.centerDist = center.lengthSq();
            });
            splatArray.splats.sort((a, b) => {
                let centerADist = a.centerDist;
                let centerBDist = b.centerDist;
                if (centerADist > centerBDist) return 1;
                else return -1;
            });

            const sectionFilters = [];
            const groupingParameters = [];
            partitionSize = Math.min(splatArray.splatCount, partitionSize);
            const patitionCount = Math.ceil(splatArray.splatCount / partitionSize);
            let currentStartSplat = 0;
            for (let i = 0; i < patitionCount; i ++) {
                let startSplat = currentStartSplat;
                sectionFilters.push((splatIndex) => {
                    return splatIndex >= startSplat && splatIndex < startSplat + partitionSize;
                });
                groupingParameters.push({
                    'blocksSize': blockSize,
                    'bucketSize': bucketSize,
                });
                currentStartSplat += partitionSize;
            }
            return {
                'sectionCount': sectionFilters.length,
                sectionFilters,
                groupingParameters
            };
        };
        return new SplatPartitioner(undefined, undefined, undefined, partitionGenerator);
    }
}

/**
 * SplatBufferGenerator
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */


class SplatBufferGenerator {

    constructor(splatPartitioner, alphaRemovalThreshold, compressionLevel, sectionSize, sceneCenter, blockSize, bucketSize) {
        this.splatPartitioner = splatPartitioner;
        this.alphaRemovalThreshold = alphaRemovalThreshold;
        this.compressionLevel = compressionLevel;
        this.sectionSize = sectionSize;
        this.sceneCenter = sceneCenter ? new THREE.Vector3().copy(sceneCenter) : undefined;
        this.blockSize = blockSize;
        this.bucketSize = bucketSize;
    }

    generateFromUncompressedSplatArray(splatArray) {
        const partitionResults = this.splatPartitioner.partitionUncompressedSplatArray(splatArray);
        return SplatBuffer.generateFromUncompressedSplatArrays(partitionResults.splatArrays,
                                                               this.alphaRemovalThreshold, this.compressionLevel,
                                                               this.sceneCenter, this.blockSize, this.bucketSize,
                                                               partitionResults.parameters);
    }

    static getStandardGenerator(alphaRemovalThreshold = 1, compressionLevel = 1, sectionSize = 0, sceneCenter = new THREE.Vector3(),
                                blockSize = SplatBuffer.BucketBlockSize, bucketSize = SplatBuffer.BucketSize) {
        const splatPartitioner = SplatPartitioner.getStandardPartitioner(sectionSize, sceneCenter, blockSize, bucketSize);
        return new SplatBufferGenerator(splatPartitioner, alphaRemovalThreshold, compressionLevel,
                                        sectionSize, sceneCenter, blockSize, bucketSize);
    }
}

/**
 * PlyParserUtils and related constants
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Simplified for FLAME avatar - only supports INRIAV1 format.
 */

// Ply format types (simplified - FLAME uses INRIAV1)
const PlyFormat = {
    'INRIAV1': 0
};

// Field size IDs
const FieldSizeIdDouble = 0;
const FieldSizeIdInt = 1;
const FieldSizeIdUInt = 2;
const FieldSizeIdFloat = 3;
const FieldSizeIdShort = 4;
const FieldSizeIdUShort = 5;
const FieldSizeIdUChar = 6;

const FieldSizeStringMap = {
    'double': FieldSizeIdDouble,
    'int': FieldSizeIdInt,
    'uint': FieldSizeIdUInt,
    'float': FieldSizeIdFloat,
    'short': FieldSizeIdShort,
    'ushort': FieldSizeIdUShort,
    'uchar': FieldSizeIdUChar,
};

const FieldSize = {
    [FieldSizeIdDouble]: 8,
    [FieldSizeIdInt]: 4,
    [FieldSizeIdUInt]: 4,
    [FieldSizeIdFloat]: 4,
    [FieldSizeIdShort]: 2,
    [FieldSizeIdUShort]: 2,
    [FieldSizeIdUChar]: 1,
};

class PlyParserUtils {

    static HeaderEndToken = 'end_header';

    constructor() {
    }

    decodeSectionHeader(headerLines, fieldNameIdMap, headerStartLine = 0) {

        const extractedLines = [];

        let processingSection = false;
        let headerEndLine = -1;
        let vertexCount = 0;
        let endOfHeader = false;
        let sectionName = null;

        const fieldIds = [];
        const fieldTypes = [];
        const allFieldNames = [];
        const fieldTypesByName = {};

        for (let i = headerStartLine; i < headerLines.length; i++) {
            const line = headerLines[i].trim();
            if (line.startsWith('element')) {
                if (processingSection) {
                    headerEndLine--;
                    break;
                } else {
                    processingSection = true;
                    headerStartLine = i;
                    headerEndLine = i;
                    const lineComponents = line.split(' ');
                    let validComponents = 0;
                    for (let lineComponent of lineComponents) {
                        const trimmedComponent = lineComponent.trim();
                        if (trimmedComponent.length > 0) {
                            validComponents++;
                            if (validComponents === 2) {
                                sectionName = trimmedComponent;
                            } else if (validComponents === 3) {
                                vertexCount = parseInt(trimmedComponent);
                            }
                        }
                    }
                }
            } else if (line.startsWith('property')) {
                const fieldMatch = line.match(/(\w+)\s+(\w+)\s+(\w+)/);
                if (fieldMatch) {
                    const fieldTypeStr = fieldMatch[2];
                    const fieldName = fieldMatch[3];
                    allFieldNames.push(fieldName);
                    const fieldId = fieldNameIdMap[fieldName];
                    fieldTypesByName[fieldName] = fieldTypeStr;
                    const fieldType = FieldSizeStringMap[fieldTypeStr];
                    if (fieldId !== undefined) {
                        fieldIds.push(fieldId);
                        fieldTypes[fieldId] = fieldType;
                    }
                }
            }
            if (line === PlyParserUtils.HeaderEndToken) {
                endOfHeader = true;
                break;
            }
            if (processingSection) {
                extractedLines.push(line);
                headerEndLine++;
            }
        }

        const fieldOffsets = [];
        let bytesPerVertex = 0;
        for (let fieldName of allFieldNames) {
            const fieldType = fieldTypesByName[fieldName];
            if (Object.hasOwn(fieldTypesByName, fieldName)) {
                const fieldId = fieldNameIdMap[fieldName];
                if (fieldId !== undefined) {
                    fieldOffsets[fieldId] = bytesPerVertex;
                }
            }
            bytesPerVertex += FieldSize[FieldSizeStringMap[fieldType]];
        }

        const sphericalHarmonics = this.decodeSphericalHarmonicsFromSectionHeader(allFieldNames, fieldNameIdMap);

        return {
            'headerLines': extractedLines,
            'headerStartLine': headerStartLine,
            'headerEndLine': headerEndLine,
            'fieldTypes': fieldTypes,
            'fieldIds': fieldIds,
            'fieldOffsets': fieldOffsets,
            'bytesPerVertex': bytesPerVertex,
            'vertexCount': vertexCount,
            'dataSizeBytes': bytesPerVertex * vertexCount,
            'endOfHeader': endOfHeader,
            'sectionName': sectionName,
            'sphericalHarmonicsDegree': sphericalHarmonics.degree,
            'sphericalHarmonicsCoefficientsPerChannel': sphericalHarmonics.coefficientsPerChannel,
            'sphericalHarmonicsDegree1Fields': sphericalHarmonics.degree1Fields,
            'sphericalHarmonicsDegree2Fields': sphericalHarmonics.degree2Fields
        };
    }

    decodeSphericalHarmonicsFromSectionHeader(fieldNames, fieldNameIdMap) {
        let sphericalHarmonicsFieldCount = 0;
        let coefficientsPerChannel = 0;
        for (let fieldName of fieldNames) {
            if (fieldName.startsWith('f_rest')) sphericalHarmonicsFieldCount++;
        }
        coefficientsPerChannel = sphericalHarmonicsFieldCount / 3;
        let degree = 0;
        if (coefficientsPerChannel >= 3) degree = 1;
        if (coefficientsPerChannel >= 8) degree = 2;

        let degree1Fields = [];
        let degree2Fields = [];

        for (let rgb = 0; rgb < 3; rgb++) {
            if (degree >= 1) {
                for (let i = 0; i < 3; i++) {
                    degree1Fields.push(fieldNameIdMap['f_rest_' + (i + coefficientsPerChannel * rgb)]);
                }
            }
            if (degree >= 2) {
                for (let i = 0; i < 5; i++) {
                    degree2Fields.push(fieldNameIdMap['f_rest_' + (i + coefficientsPerChannel * rgb + 3)]);
                }
            }
        }

        return {
            'degree': degree,
            'coefficientsPerChannel': coefficientsPerChannel,
            'degree1Fields': degree1Fields,
            'degree2Fields': degree2Fields
        };
    }

    static getHeaderSectionNames(headerLines) {
        const sectionNames = [];
        for (let headerLine of headerLines) {
            if (headerLine.startsWith('element')) {
                const lineComponents = headerLine.split(' ');
                let validComponents = 0;
                for (let lineComponent of lineComponents) {
                    const trimmedComponent = lineComponent.trim();
                    if (trimmedComponent.length > 0) {
                        validComponents++;
                        if (validComponents === 2) {
                            sectionNames.push(trimmedComponent);
                        }
                    }
                }
            }
        }
        return sectionNames;
    }

    static checkTextForEndHeader(endHeaderTestText) {
        if (endHeaderTestText.includes(PlyParserUtils.HeaderEndToken)) {
            return true;
        }
        return false;
    }

    static checkBufferForEndHeader(buffer, searchOfset, chunkSize, decoder) {
        const endHeaderTestChunk = new Uint8Array(buffer, Math.max(0, searchOfset - chunkSize), chunkSize);
        const endHeaderTestText = decoder.decode(endHeaderTestChunk);
        return PlyParserUtils.checkTextForEndHeader(endHeaderTestText);
    }

    static extractHeaderFromBufferToText(plyBuffer) {
        const decoder = new TextDecoder();
        let headerOffset = 0;
        let headerText = '';
        const readChunkSize = 100;

        while (true) {
            if (headerOffset + readChunkSize >= plyBuffer.byteLength) {
                throw new Error('End of file reached while searching for end of header');
            }
            const headerChunk = new Uint8Array(plyBuffer, headerOffset, readChunkSize);
            headerText += decoder.decode(headerChunk);
            headerOffset += readChunkSize;

            if (PlyParserUtils.checkBufferForEndHeader(plyBuffer, headerOffset, readChunkSize * 2, decoder)) {
                break;
            }
        }

        return headerText;
    }

    readHeaderFromBuffer(plyBuffer) {
        const decoder = new TextDecoder();
        let headerOffset = 0;
        let headerText = '';
        const readChunkSize = 100;

        while (true) {
            if (headerOffset + readChunkSize >= plyBuffer.byteLength) {
                throw new Error('End of file reached while searching for end of header');
            }
            const headerChunk = new Uint8Array(plyBuffer, headerOffset, readChunkSize);
            headerText += decoder.decode(headerChunk);
            headerOffset += readChunkSize;

            if (PlyParserUtils.checkBufferForEndHeader(plyBuffer, headerOffset, readChunkSize * 2, decoder)) {
                break;
            }
        }

        return headerText;
    }

    static convertHeaderTextToLines(headerText) {
        const headerLines = headerText.split('\n');
        const prunedLines = [];
        for (let i = 0; i < headerLines.length; i++) {
            const line = headerLines[i].trim();
            prunedLines.push(line);
            if (line === PlyParserUtils.HeaderEndToken) {
                break;
            }
        }
        return prunedLines;
    }

    static determineHeaderFormatFromHeaderText(_headerText) {
        // Simplified - FLAME avatars always use INRIAV1 format
        return PlyFormat.INRIAV1;
    }

    static determineHeaderFormatFromPlyBuffer(plyBuffer) {
        const headertText = PlyParserUtils.extractHeaderFromBufferToText(plyBuffer);
        return PlyParserUtils.determineHeaderFormatFromHeaderText(headertText);
    }

    static readVertex(vertexData, header, row, dataOffset, fieldsToRead, rawVertex, normalize = true) {
        const offset = row * header.bytesPerVertex + dataOffset;
        const fieldOffsets = header.fieldOffsets;
        const fieldTypes = header.fieldTypes;
        for (let fieldId of fieldsToRead) {
            const fieldType = fieldTypes[fieldId];
            if (fieldType === FieldSizeIdFloat) {
                rawVertex[fieldId] = vertexData.getFloat32(offset + fieldOffsets[fieldId], true);
            } else if (fieldType === FieldSizeIdShort) {
                rawVertex[fieldId] = vertexData.getInt16(offset + fieldOffsets[fieldId], true);
            } else if (fieldType === FieldSizeIdUShort) {
                rawVertex[fieldId] = vertexData.getUint16(offset + fieldOffsets[fieldId], true);
            } else if (fieldType === FieldSizeIdInt) {
                rawVertex[fieldId] = vertexData.getInt32(offset + fieldOffsets[fieldId], true);
            } else if (fieldType === FieldSizeIdUInt) {
                rawVertex[fieldId] = vertexData.getUint32(offset + fieldOffsets[fieldId], true);
            } else if (fieldType === FieldSizeIdUChar) {
                if (normalize) {
                    rawVertex[fieldId] = vertexData.getUint8(offset + fieldOffsets[fieldId]) / 255.0;
                } else {
                    rawVertex[fieldId] = vertexData.getUint8(offset + fieldOffsets[fieldId]);
                }
            }
        }
    }
}

/**
 * INRIAV1PlyParser
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */


const BaseFieldNamesToRead = ['scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'x', 'y', 'z',
                              'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'red', 'green', 'blue', 'f_rest_0'];

const BaseFieldsToReadIndexes = BaseFieldNamesToRead.map((e, i) => i);

const [
        SCALE_0, SCALE_1, SCALE_2, ROT_0, ROT_1, ROT_2, ROT_3, X, Y, Z, F_DC_0, F_DC_1, F_DC_2, OPACITY, RED, GREEN, BLUE, F_REST_0
      ] = BaseFieldsToReadIndexes;

class INRIAV1PlyParser {

    constructor() {
        this.plyParserutils = new PlyParserUtils();
    }

    decodeHeaderLines(headerLines) {

        let shLineCount = 0;
        headerLines.forEach((line) => {
            if (line.includes('f_rest_')) shLineCount++;
        });

        let shFieldsToReadCount = 0;
        if (shLineCount >= 45) {
            shFieldsToReadCount = 45;
        } else if (shLineCount >= 24) {
            shFieldsToReadCount = 24;
        } else if (shLineCount >= 9) {
            shFieldsToReadCount = 9;
        }

        const shFieldIndexesToMap = Array.from(Array(Math.max(shFieldsToReadCount - 1, 0)));
        let shRemainingFieldNamesToRead = shFieldIndexesToMap.map((element, index) => `f_rest_${index + 1}`);

        const fieldNamesToRead = [...BaseFieldNamesToRead, ...shRemainingFieldNamesToRead];
        const fieldsToReadIndexes = fieldNamesToRead.map((e, i) => i);

        const fieldNameIdMap = fieldsToReadIndexes.reduce((acc, element) => {
            acc[fieldNamesToRead[element]] = element;
            return acc;
        }, {});
        const header = this.plyParserutils.decodeSectionHeader(headerLines, fieldNameIdMap, 0);
        header.splatCount = header.vertexCount;
        header.bytesPerSplat = header.bytesPerVertex;
        header.fieldsToReadIndexes = fieldsToReadIndexes;
        return header;
    }

    decodeHeaderText(headerText) {
        const headerLines = PlyParserUtils.convertHeaderTextToLines(headerText);
        const header = this.decodeHeaderLines(headerLines);
        header.headerText = headerText;
        header.headerSizeBytes = headerText.indexOf(PlyParserUtils.HeaderEndToken) + PlyParserUtils.HeaderEndToken.length + 1;
        return header;
    }

    decodeHeaderFromBuffer(plyBuffer) {
        const headerText = this.plyParserutils.readHeaderFromBuffer(plyBuffer);
        return this.decodeHeaderText(headerText);
    }

    findSplatData(plyBuffer, header) {
        return new DataView(plyBuffer, header.headerSizeBytes);
    }

    parseToUncompressedSplatBufferSection(header, fromSplat, toSplat, splatData, splatDataOffset,
                                          toBuffer, toOffset, outSphericalHarmonicsDegree = 0) {
        outSphericalHarmonicsDegree = Math.min(outSphericalHarmonicsDegree, header.sphericalHarmonicsDegree);
        const outBytesPerSplat = SplatBuffer.CompressionLevels[0].SphericalHarmonicsDegrees[outSphericalHarmonicsDegree].BytesPerSplat;

        for (let i = fromSplat; i <= toSplat; i++) {
            const parsedSplat = INRIAV1PlyParser.parseToUncompressedSplat(splatData, i, header,
                                                                          splatDataOffset, outSphericalHarmonicsDegree);
            const outBase = i * outBytesPerSplat + toOffset;
            SplatBuffer.writeSplatDataToSectionBuffer(parsedSplat, toBuffer, outBase, 0, outSphericalHarmonicsDegree);
        }
    }

    parseToUncompressedSplatArraySection(header, fromSplat, toSplat, splatData, splatDataOffset,
                                         splatArray, outSphericalHarmonicsDegree = 0) {
        outSphericalHarmonicsDegree = Math.min(outSphericalHarmonicsDegree, header.sphericalHarmonicsDegree);
        for (let i = fromSplat; i <= toSplat; i++) {
            const parsedSplat = INRIAV1PlyParser.parseToUncompressedSplat(splatData, i, header,
                                                                          splatDataOffset, outSphericalHarmonicsDegree);
            splatArray.addSplat(parsedSplat);
        }
    }

    decodeSectionSplatData(sectionSplatData, splatCount, sectionHeader, outSphericalHarmonicsDegree) {
        outSphericalHarmonicsDegree = Math.min(outSphericalHarmonicsDegree, sectionHeader.sphericalHarmonicsDegree);
        const splatArray = new UncompressedSplatArray(outSphericalHarmonicsDegree);
        for (let row = 0; row < splatCount; row++) {
            const newSplat = INRIAV1PlyParser.parseToUncompressedSplat(sectionSplatData, row, sectionHeader,
                                                                       0, outSphericalHarmonicsDegree);
            splatArray.addSplat(newSplat);
        }
        return splatArray;
    }

    static parseToUncompressedSplat = function() {

        let rawSplat = [];
        const tempRotation = new THREE.Quaternion();

        const OFFSET_X = UncompressedSplatArray.OFFSET.X;
        const OFFSET_Y = UncompressedSplatArray.OFFSET.Y;
        const OFFSET_Z = UncompressedSplatArray.OFFSET.Z;

        const OFFSET_SCALE0 = UncompressedSplatArray.OFFSET.SCALE0;
        const OFFSET_SCALE1 = UncompressedSplatArray.OFFSET.SCALE1;
        const OFFSET_SCALE2 = UncompressedSplatArray.OFFSET.SCALE2;

        const OFFSET_ROTATION0 = UncompressedSplatArray.OFFSET.ROTATION0;
        const OFFSET_ROTATION1 = UncompressedSplatArray.OFFSET.ROTATION1;
        const OFFSET_ROTATION2 = UncompressedSplatArray.OFFSET.ROTATION2;
        const OFFSET_ROTATION3 = UncompressedSplatArray.OFFSET.ROTATION3;

        const OFFSET_FDC0 = UncompressedSplatArray.OFFSET.FDC0;
        const OFFSET_FDC1 = UncompressedSplatArray.OFFSET.FDC1;
        const OFFSET_FDC2 = UncompressedSplatArray.OFFSET.FDC2;
        const OFFSET_OPACITY = UncompressedSplatArray.OFFSET.OPACITY;

        const OFFSET_FRC = [];

        for (let i = 0; i < 45; i++) {
            OFFSET_FRC[i] = UncompressedSplatArray.OFFSET.FRC0 + i;
        }

        return function(splatData, row, header, splatDataOffset = 0, outSphericalHarmonicsDegree = 0) {
            outSphericalHarmonicsDegree = Math.min(outSphericalHarmonicsDegree, header.sphericalHarmonicsDegree);
            INRIAV1PlyParser.readSplat(splatData, header, row, splatDataOffset, rawSplat);
            const newSplat = UncompressedSplatArray.createSplat(outSphericalHarmonicsDegree);
            if (rawSplat[SCALE_0] !== undefined) {
                newSplat[OFFSET_SCALE0] = Math.exp(rawSplat[SCALE_0]);
                newSplat[OFFSET_SCALE1] = Math.exp(rawSplat[SCALE_1]);
                newSplat[OFFSET_SCALE2] = Math.exp(rawSplat[SCALE_2]);
            } else {
                newSplat[OFFSET_SCALE0] = 0.01;
                newSplat[OFFSET_SCALE1] = 0.01;
                newSplat[OFFSET_SCALE2] = 0.01;
            }

            if (rawSplat[F_DC_0] !== undefined) {
                newSplat[OFFSET_FDC0] = rawSplat[F_DC_0] * 255;
                newSplat[OFFSET_FDC1] = rawSplat[F_DC_1] * 255;
                newSplat[OFFSET_FDC2] = rawSplat[F_DC_2] * 255;
            } else if (rawSplat[RED] !== undefined) {
                newSplat[OFFSET_FDC0] = rawSplat[RED] * 255;
                newSplat[OFFSET_FDC1] = rawSplat[GREEN] * 255;
                newSplat[OFFSET_FDC2] = rawSplat[BLUE] * 255;
            } else {
                newSplat[OFFSET_FDC0] = 0;
                newSplat[OFFSET_FDC1] = 0;
                newSplat[OFFSET_FDC2] = 0;
            }

            if (rawSplat[OPACITY] !== undefined) {
                newSplat[OFFSET_OPACITY] = (1 / (1 + Math.exp(-rawSplat[OPACITY]))) * 255;
            }

            newSplat[OFFSET_FDC0] = clamp(Math.floor(newSplat[OFFSET_FDC0]), 0, 255);
            newSplat[OFFSET_FDC1] = clamp(Math.floor(newSplat[OFFSET_FDC1]), 0, 255);
            newSplat[OFFSET_FDC2] = clamp(Math.floor(newSplat[OFFSET_FDC2]), 0, 255);
            newSplat[OFFSET_OPACITY] = clamp(Math.floor(newSplat[OFFSET_OPACITY]), 0, 255);

            if (outSphericalHarmonicsDegree >= 1) {
                if (rawSplat[F_REST_0] !== undefined) {
                    for (let i = 0; i < 9; i++) {
                        newSplat[OFFSET_FRC[i]] = rawSplat[header.sphericalHarmonicsDegree1Fields[i]];
                    }
                    if (outSphericalHarmonicsDegree >= 2) {
                        for (let i = 0; i < 15; i++) {
                            newSplat[OFFSET_FRC[9 + i]] = rawSplat[header.sphericalHarmonicsDegree2Fields[i]];
                        }
                    }
                }
            }

            tempRotation.set(rawSplat[ROT_0], rawSplat[ROT_1], rawSplat[ROT_2], rawSplat[ROT_3]);
            tempRotation.normalize();

            newSplat[OFFSET_ROTATION0] = tempRotation.x;
            newSplat[OFFSET_ROTATION1] = tempRotation.y;
            newSplat[OFFSET_ROTATION2] = tempRotation.z;
            newSplat[OFFSET_ROTATION3] = tempRotation.w;

            newSplat[OFFSET_X] = rawSplat[X];
            newSplat[OFFSET_Y] = rawSplat[Y];
            newSplat[OFFSET_Z] = rawSplat[Z];

            return newSplat;
        };

    }();

    static readSplat(splatData, header, row, dataOffset, rawSplat) {
        return PlyParserUtils.readVertex(splatData, header, row, dataOffset, header.fieldsToReadIndexes, rawSplat, true);
    }

    parseToUncompressedSplatArray(plyBuffer, outSphericalHarmonicsDegree = 0) {
        const header = this.decodeHeaderFromBuffer(plyBuffer);
        const splatCount = header.splatCount;
        const splatData = this.findSplatData(plyBuffer, header);
        const splatArray = this.decodeSectionSplatData(splatData, splatCount, header, outSphericalHarmonicsDegree);
        return splatArray;
    }
}

/**
 * PlyParser
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Simplified for FLAME avatar - only supports INRIAV1 PLY format.
 */


class PlyParser {

    static parseToUncompressedSplatArray(plyBuffer, outSphericalHarmonicsDegree = 0) {
        // FLAME avatars use INRIAV1 PLY format
        return new INRIAV1PlyParser().parseToUncompressedSplatArray(plyBuffer, outSphericalHarmonicsDegree);
    }

}

/**
 * PlyLoader
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Simplified for FLAME avatar - only supports INRIAV1 PLY format.
 */


/**
 * Helper function to store chunks into a single buffer
 */
function storeChunksInBuffer(chunks, buffer) {
    let inBytes = 0;
    for (let chunk of chunks) inBytes += chunk.sizeBytes;

    if (!buffer || buffer.byteLength < inBytes) {
        buffer = new ArrayBuffer(inBytes);
    }

    let offset = 0;
    for (let chunk of chunks) {
        new Uint8Array(buffer, offset, chunk.sizeBytes).set(chunk.data);
        offset += chunk.sizeBytes;
    }

    return buffer;
}

/**
 * Helper function to finalize splat data
 */
function finalize$1(splatData, optimizeSplatData, minimumAlpha, compressionLevel, sectionSize, sceneCenter, blockSize, bucketSize) {
    if (optimizeSplatData) {
        const splatBufferGenerator = SplatBufferGenerator.getStandardGenerator(minimumAlpha, compressionLevel,
                                                                               sectionSize, sceneCenter,
                                                                               blockSize, bucketSize);
        return splatBufferGenerator.generateFromUncompressedSplatArray(splatData);
    } else {
        return SplatBuffer.generateFromUncompressedSplatArrays([splatData], minimumAlpha, 0, new THREE.Vector3());
    }
}

class PlyLoader {

    static loadFromURL(fileName, onProgress, loadDirectoToSplatBuffer, onProgressiveLoadSectionProgress,
                       minimumAlpha, compressionLevel, optimizeSplatData = true, outSphericalHarmonicsDegree = 0,
                       headers, sectionSize, sceneCenter, blockSize, bucketSize) {

        let internalLoadType = loadDirectoToSplatBuffer ? InternalLoadType.DirectToSplatBuffer : InternalLoadType.DirectToSplatArray;
        if (optimizeSplatData) internalLoadType = InternalLoadType.DirectToSplatArray;

        const directLoadSectionSizeBytes = Constants$1.ProgressiveLoadSectionSize;
        const splatDataOffsetBytes = SplatBuffer.HeaderSizeBytes + SplatBuffer.SectionHeaderSizeBytes;
        const sectionCount = 1;

        let directLoadBufferIn;
        let directLoadBufferOut;
        let directLoadSplatBuffer;
        let maxSplatCount = 0;
        let splatCount = 0;

        let headerLoaded = false;
        let readyToLoadSplatData = false;

        const loadPromise = nativePromiseWithExtractedComponents();

        let numBytesStreamed = 0;
        let numBytesParsed = 0;
        let numBytesDownloaded = 0;
        let headerText = '';
        let header = null;
        let chunks = [];

        let standardLoadUncompressedSplatArray;

        const textDecoder = new TextDecoder();
        const inriaV1PlyParser = new INRIAV1PlyParser();

        const localOnProgress = (percent, percentLabel, chunkData) => {
            const loadComplete = percent >= 100;

            if (chunkData) {
                chunks.push({
                    'data': chunkData,
                    'sizeBytes': chunkData.byteLength,
                    'startBytes': numBytesDownloaded,
                    'endBytes': numBytesDownloaded + chunkData.byteLength
                });
                numBytesDownloaded += chunkData.byteLength;
            }

            if (internalLoadType === InternalLoadType.DownloadBeforeProcessing) {
                if (loadComplete) {
                    loadPromise.resolve(chunks);
                }
            } else {
                if (!headerLoaded) {
                    headerText += textDecoder.decode(chunkData);
                    if (PlyParserUtils.checkTextForEndHeader(headerText)) {
                        // FLAME avatars use INRIAV1 format
                        header = inriaV1PlyParser.decodeHeaderText(headerText);
                        maxSplatCount = header.splatCount;
                        readyToLoadSplatData = true;
                        
                        outSphericalHarmonicsDegree = Math.min(outSphericalHarmonicsDegree, header.sphericalHarmonicsDegree);

                        const shDescriptor = SplatBuffer.CompressionLevels[0].SphericalHarmonicsDegrees[outSphericalHarmonicsDegree];
                        const splatBufferSizeBytes = splatDataOffsetBytes + shDescriptor.BytesPerSplat * maxSplatCount;

                        if (internalLoadType === InternalLoadType.DirectToSplatBuffer) {
                            directLoadBufferOut = new ArrayBuffer(splatBufferSizeBytes);
                            SplatBuffer.writeHeaderToBuffer({
                                versionMajor: SplatBuffer.CurrentMajorVersion,
                                versionMinor: SplatBuffer.CurrentMinorVersion,
                                maxSectionCount: sectionCount,
                                sectionCount: sectionCount,
                                maxSplatCount: maxSplatCount,
                                splatCount: splatCount,
                                compressionLevel: 0,
                                sceneCenter: new THREE.Vector3()
                            }, directLoadBufferOut);
                        } else {
                            standardLoadUncompressedSplatArray = new UncompressedSplatArray(outSphericalHarmonicsDegree);
                        }

                        numBytesStreamed = header.headerSizeBytes;
                        numBytesParsed = header.headerSizeBytes;
                        headerLoaded = true;
                    }
                }

                if (headerLoaded && readyToLoadSplatData) {

                    if (chunks.length > 0) {

                        directLoadBufferIn = storeChunksInBuffer(chunks, directLoadBufferIn);

                        const bytesLoadedSinceLastStreamedSection = numBytesDownloaded - numBytesStreamed;
                        if (bytesLoadedSinceLastStreamedSection > directLoadSectionSizeBytes || loadComplete) {
                            const numBytesToProcess = numBytesDownloaded - numBytesParsed;
                            const addedSplatCount = Math.floor(numBytesToProcess / header.bytesPerSplat);
                            const numBytesToParse = addedSplatCount * header.bytesPerSplat;
                            const numBytesLeftOver = numBytesToProcess - numBytesToParse;
                            const newSplatCount = splatCount + addedSplatCount;
                            const parsedDataViewOffset = numBytesParsed - chunks[0].startBytes;
                            const dataToParse = new DataView(directLoadBufferIn, parsedDataViewOffset, numBytesToParse);

                            const shDescriptor = SplatBuffer.CompressionLevels[0].SphericalHarmonicsDegrees[outSphericalHarmonicsDegree];
                            const outOffset = splatCount * shDescriptor.BytesPerSplat + splatDataOffsetBytes;

                            if (internalLoadType === InternalLoadType.DirectToSplatBuffer) {
                                inriaV1PlyParser.parseToUncompressedSplatBufferSection(header, 0, addedSplatCount - 1, dataToParse,
                                                                                    0, directLoadBufferOut, outOffset,
                                                                                    outSphericalHarmonicsDegree);
                            } else {
                                inriaV1PlyParser.parseToUncompressedSplatArraySection(header, 0, addedSplatCount - 1, dataToParse,
                                                                                    0, standardLoadUncompressedSplatArray,
                                                                                    outSphericalHarmonicsDegree);
                            }

                            splatCount = newSplatCount;

                            if (internalLoadType === InternalLoadType.DirectToSplatBuffer) {
                                if (!directLoadSplatBuffer) {
                                    SplatBuffer.writeSectionHeaderToBuffer({
                                        maxSplatCount: maxSplatCount,
                                        splatCount: splatCount,
                                        bucketSize: 0,
                                        bucketCount: 0,
                                        bucketBlockSize: 0,
                                        compressionScaleRange: 0,
                                        storageSizeBytes: 0,
                                        fullBucketCount: 0,
                                        partiallyFilledBucketCount: 0,
                                        sphericalHarmonicsDegree: outSphericalHarmonicsDegree
                                    }, 0, directLoadBufferOut, SplatBuffer.HeaderSizeBytes);
                                    directLoadSplatBuffer = new SplatBuffer(directLoadBufferOut, false);
                                }
                                directLoadSplatBuffer.updateLoadedCounts(1, splatCount);
                                if (onProgressiveLoadSectionProgress) {
                                    onProgressiveLoadSectionProgress(directLoadSplatBuffer, loadComplete);
                                }
                            }

                            numBytesStreamed += directLoadSectionSizeBytes;
                            numBytesParsed += numBytesToParse;

                            if (numBytesLeftOver === 0) {
                                chunks = [];
                            } else {
                                let keepChunks = [];
                                let keepSize = 0;
                                for (let i = chunks.length - 1; i >= 0; i--) {
                                    const chunk = chunks[i];
                                    keepSize += chunk.sizeBytes;
                                    keepChunks.unshift(chunk);
                                    if (keepSize >= numBytesLeftOver) break;
                                }
                                chunks = keepChunks;
                            }
                        }
                    }

                    if (loadComplete) {
                        if (internalLoadType === InternalLoadType.DirectToSplatBuffer) {
                            loadPromise.resolve(directLoadSplatBuffer);
                        } else {
                            loadPromise.resolve(standardLoadUncompressedSplatArray);
                        }
                    }
                }
            }

            if (onProgress) onProgress(percent, percentLabel, LoaderStatus.Downloading);
        };

        if (onProgress) onProgress(0, '0%', LoaderStatus.Downloading);
        return fetchWithProgress(fileName, localOnProgress, false, headers).then(() => {
            if (onProgress) onProgress(0, '0%', LoaderStatus.Processing);
            return loadPromise.promise.then((splatData) => {
                if (onProgress) onProgress(100, '100%', LoaderStatus.Done);
                if (internalLoadType === InternalLoadType.DownloadBeforeProcessing) {
                    const chunkDatas = chunks.map((chunk) => chunk.data);
                    return new Blob(chunkDatas).arrayBuffer().then((plyFileData) => {
                        return PlyLoader.loadFromFileData(plyFileData, minimumAlpha, compressionLevel, optimizeSplatData,
                                                          outSphericalHarmonicsDegree, sectionSize, sceneCenter, blockSize, bucketSize);
                    });
                } else if (internalLoadType === InternalLoadType.DirectToSplatBuffer) {
                    return splatData;
                } else {
                    return delayedExecute(() => {
                        return finalize$1(splatData, optimizeSplatData, minimumAlpha, compressionLevel,
                                        sectionSize, sceneCenter, blockSize, bucketSize);
                    });
                }
            });
        });
    }

    static loadFromFileData(plyFileData, minimumAlpha, compressionLevel, optimizeSplatData, outSphericalHarmonicsDegree = 0,
                            sectionSize, sceneCenter, blockSize, bucketSize) {
        return delayedExecute(() => {
            return PlyParser.parseToUncompressedSplatArray(plyFileData, outSphericalHarmonicsDegree);
        })
        .then((splatArray) => {
            return finalize$1(splatArray, optimizeSplatData, minimumAlpha, compressionLevel,
                            sectionSize, sceneCenter, blockSize, bucketSize);
        });
    }
}

/**
 * Ray
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 */


const VectorRight = new THREE__namespace.Vector3(1, 0, 0);
const VectorUp = new THREE__namespace.Vector3(0, 1, 0);
const VectorBackward = new THREE__namespace.Vector3(0, 0, 1);

class Ray {

    constructor(origin = new THREE__namespace.Vector3(), direction = new THREE__namespace.Vector3()) {
        this.origin = new THREE__namespace.Vector3();
        this.direction = new THREE__namespace.Vector3();
        this.setParameters(origin, direction);
    }

    setParameters(origin, direction) {
        this.origin.copy(origin);
        this.direction.copy(direction).normalize();
    }

    boxContainsPoint(box, point, epsilon) {
        return point.x < box.min.x - epsilon || point.x > box.max.x + epsilon ||
               point.y < box.min.y - epsilon || point.y > box.max.y + epsilon ||
               point.z < box.min.z - epsilon || point.z > box.max.z + epsilon ? false : true;
    }

    intersectBox = function() {

        const planeIntersectionPoint = new THREE__namespace.Vector3();
        const planeIntersectionPointArray = [];
        const originArray = [];
        const directionArray = [];

        return function(box, outHit) {

            originArray[0] = this.origin.x;
            originArray[1] = this.origin.y;
            originArray[2] = this.origin.z;
            directionArray[0] = this.direction.x;
            directionArray[1] = this.direction.y;
            directionArray[2] = this.direction.z;

            if (this.boxContainsPoint(box, this.origin, 0.0001)) {
                if (outHit) {
                    outHit.origin.copy(this.origin);
                    outHit.normal.set(0, 0, 0);
                    outHit.distance = -1;
                }
                return true;
            }

            for (let i = 0; i < 3; i++) {
                if (directionArray[i] == 0.0) continue;

                const hitNormal = i == 0 ? VectorRight : i == 1 ? VectorUp : VectorBackward;
                const extremeVec = directionArray[i] < 0 ? box.max : box.min;
                let multiplier = -Math.sign(directionArray[i]);
                planeIntersectionPointArray[0] = i == 0 ? extremeVec.x : i == 1 ? extremeVec.y : extremeVec.z;
                let toSide = planeIntersectionPointArray[0] - originArray[i];

                if (toSide * multiplier < 0) {
                    const idx1 = (i + 1) % 3;
                    const idx2 = (i + 2) % 3;
                    planeIntersectionPointArray[2] = directionArray[idx1] / directionArray[i] * toSide + originArray[idx1];
                    planeIntersectionPointArray[1] = directionArray[idx2] / directionArray[i] * toSide + originArray[idx2];
                    planeIntersectionPoint.set(planeIntersectionPointArray[i],
                                               planeIntersectionPointArray[idx2],
                                               planeIntersectionPointArray[idx1]);
                    if (this.boxContainsPoint(box, planeIntersectionPoint, 0.0001)) {
                        if (outHit) {
                            outHit.origin.copy(planeIntersectionPoint);
                            outHit.normal.copy(hitNormal).multiplyScalar(multiplier);
                            outHit.distance = planeIntersectionPoint.sub(this.origin).length();
                        }
                        return true;
                    }
                }
            }

            return false;
        };

    }();

    intersectSphere = function() {

        const toSphereCenterVec = new THREE__namespace.Vector3();

        return function(center, radius, outHit) {
            toSphereCenterVec.copy(center).sub(this.origin);
            const toClosestApproach = toSphereCenterVec.dot(this.direction);
            const toClosestApproachSq = toClosestApproach * toClosestApproach;
            const toSphereCenterSq = toSphereCenterVec.dot(toSphereCenterVec);
            const diffSq = toSphereCenterSq - toClosestApproachSq;
            const radiusSq = radius * radius;

            if (diffSq > radiusSq) return false;

            const thc = Math.sqrt(radiusSq - diffSq);
            const t0 = toClosestApproach - thc;
            const t1 = toClosestApproach + thc;

            if (t1 < 0) return false;
            let t = t0 < 0 ? t1 : t0;

            if (outHit) {
                outHit.origin.copy(this.origin).addScaledVector(this.direction, t);
                outHit.normal.copy(outHit.origin).sub(center).normalize();
                outHit.distance = t;
            }
            return true;
        };

    }();
}

/**
 * Hit
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 */


class Hit {

    constructor() {
        this.origin = new THREE__namespace.Vector3();
        this.normal = new THREE__namespace.Vector3();
        this.distance = 0;
        this.splatIndex = 0;
    }

    set(origin, normal, distance, splatIndex) {
        this.origin.copy(origin);
        this.normal.copy(normal);
        this.distance = distance;
        this.splatIndex = splatIndex;
    }

    clone() {
        const hitClone = new Hit();
        hitClone.origin.copy(this.origin);
        hitClone.normal.copy(this.normal);
        hitClone.distance = this.distance;
        hitClone.splatIndex = this.splatIndex;
        return hitClone;
    }

}

/**
 * Raycaster
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */


class Raycaster {

    constructor(origin, direction, raycastAgainstTrueSplatEllipsoid = false) {
        this.ray = new Ray(origin, direction);
        this.raycastAgainstTrueSplatEllipsoid = raycastAgainstTrueSplatEllipsoid;
    }

    setFromCameraAndScreenPosition = function() {

        const ndcCoords = new THREE__namespace.Vector2();

        return function(camera, screenPosition, screenDimensions) {
            ndcCoords.x = screenPosition.x / screenDimensions.x * 2.0 - 1.0;
            ndcCoords.y = (screenDimensions.y - screenPosition.y) / screenDimensions.y * 2.0 - 1.0;
            if (camera.isPerspectiveCamera) {
                this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
                this.ray.direction.set(ndcCoords.x, ndcCoords.y, 0.5 ).unproject(camera).sub(this.ray.origin).normalize();
                this.camera = camera;
            } else if (camera.isOrthographicCamera) {
                this.ray.origin.set(ndcCoords.x, ndcCoords.y,
                                   (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera);
                this.ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
                this.camera = camera;
            } else {
                throw new Error('Raycaster::setFromCameraAndScreenPosition() -> Unsupported camera type');
            }
        };

    }();

    intersectSplatMesh = function() {

        const toLocal = new THREE__namespace.Matrix4();
        const fromLocal = new THREE__namespace.Matrix4();
        const sceneTransform = new THREE__namespace.Matrix4();
        const localRay = new Ray();
        const tempPoint = new THREE__namespace.Vector3();

        return function(splatMesh, outHits = []) {
            const splatTree = splatMesh.getSplatTree();

            if (!splatTree) return;

            for (let s = 0; s < splatTree.subTrees.length; s++) {
                const subTree = splatTree.subTrees[s];

                fromLocal.copy(splatMesh.matrixWorld);
                if (splatMesh.dynamicMode) {
                    splatMesh.getSceneTransform(s, sceneTransform);
                    fromLocal.multiply(sceneTransform);
                }
                toLocal.copy(fromLocal).invert();

                localRay.origin.copy(this.ray.origin).applyMatrix4(toLocal);
                localRay.direction.copy(this.ray.origin).add(this.ray.direction);
                localRay.direction.applyMatrix4(toLocal).sub(localRay.origin).normalize();

                const outHitsForSubTree = [];
                if (subTree.rootNode) {
                    this.castRayAtSplatTreeNode(localRay, splatTree, subTree.rootNode, outHitsForSubTree);
                }

                outHitsForSubTree.forEach((hit) => {
                    hit.origin.applyMatrix4(fromLocal);
                    hit.normal.applyMatrix4(fromLocal).normalize();
                    hit.distance = tempPoint.copy(hit.origin).sub(this.ray.origin).length();
                });

                outHits.push(...outHitsForSubTree);
            }

            outHits.sort((a, b) => {
                if (a.distance > b.distance) return 1;
                else return -1;
            });

            return outHits;
        };

    }();

    castRayAtSplatTreeNode = function() {

        const tempColor = new THREE__namespace.Vector4();
        const tempCenter = new THREE__namespace.Vector3();
        const tempScale = new THREE__namespace.Vector3();
        const tempRotation = new THREE__namespace.Quaternion();
        const tempHit = new Hit();
        const scaleEpsilon = 0.0000001;

        const origin = new THREE__namespace.Vector3(0, 0, 0);
        const uniformScaleMatrix = new THREE__namespace.Matrix4();
        const scaleMatrix = new THREE__namespace.Matrix4();
        const rotationMatrix = new THREE__namespace.Matrix4();
        const toSphereSpace = new THREE__namespace.Matrix4();
        const fromSphereSpace = new THREE__namespace.Matrix4();
        const tempRay = new Ray();

        return function(ray, splatTree, node, outHits = []) {
            if (!ray.intersectBox(node.boundingBox)) {
                return;
            }
            if (node.data && node.data.indexes && node.data.indexes.length > 0) {
                for (let i = 0; i < node.data.indexes.length; i++) {

                    const splatGlobalIndex = node.data.indexes[i];
                    const splatSceneIndex = splatTree.splatMesh.getSceneIndexForSplat(splatGlobalIndex);
                    const splatScene = splatTree.splatMesh.getScene(splatSceneIndex);
                    if (!splatScene.visible) continue;

                    splatTree.splatMesh.getSplatColor(splatGlobalIndex, tempColor);
                    splatTree.splatMesh.getSplatCenter(splatGlobalIndex, tempCenter);
                    splatTree.splatMesh.getSplatScaleAndRotation(splatGlobalIndex, tempScale, tempRotation);

                    if (tempScale.x <= scaleEpsilon || tempScale.y <= scaleEpsilon ||
                        splatTree.splatMesh.splatRenderMode === SplatRenderMode.ThreeD && tempScale.z <= scaleEpsilon) {
                        continue;
                    }

                    if (!this.raycastAgainstTrueSplatEllipsoid) {
                        let radius = (tempScale.x + tempScale.y);
                        let componentCount = 2;
                        if (splatTree.splatMesh.splatRenderMode === SplatRenderMode.ThreeD) {
                            radius += tempScale.z;
                            componentCount = 3;
                        }
                        radius = radius / componentCount;
                        if (ray.intersectSphere(tempCenter, radius, tempHit)) {
                            const hitClone = tempHit.clone();
                            hitClone.splatIndex = splatGlobalIndex;
                            outHits.push(hitClone);
                        }
                    } else {
                        scaleMatrix.makeScale(tempScale.x, tempScale.y, tempScale.z);
                        rotationMatrix.makeRotationFromQuaternion(tempRotation);
                        const uniformScale = Math.log10(tempColor.w) * 2.0;
                        uniformScaleMatrix.makeScale(uniformScale, uniformScale, uniformScale);
                        fromSphereSpace.copy(uniformScaleMatrix).multiply(rotationMatrix).multiply(scaleMatrix);
                        toSphereSpace.copy(fromSphereSpace).invert();
                        tempRay.origin.copy(ray.origin).sub(tempCenter).applyMatrix4(toSphereSpace);
                        tempRay.direction.copy(ray.origin).add(ray.direction).sub(tempCenter);
                        tempRay.direction.applyMatrix4(toSphereSpace).sub(tempRay.origin).normalize();
                        if (tempRay.intersectSphere(origin, 1.0, tempHit)) {
                            const hitClone = tempHit.clone();
                            hitClone.splatIndex = splatGlobalIndex;
                            hitClone.origin.applyMatrix4(fromSphereSpace).add(tempCenter);
                            outHits.push(hitClone);
                        }
                    }
                }
             }
            if (node.children && node.children.length > 0) {
                for (let child of node.children) {
                    this.castRayAtSplatTreeNode(ray, splatTree, child, outHits);
                }
            }
            return outHits;
        };

    }();
}

/**
 * SortWorker
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Handles GPU-based sorting using WebAssembly
 */


// Base64 encoded WASM modules for sorting
const SorterWasm = "AGFzbQEAAAAADwhkeWxpbmsuMAEEAAAAAAEbA2AAAGAQf39/f39/f39/f39/f39/fwBgAAF/AhIBA2VudgZtZW1vcnkCAwCAgAQDBAMAAQIHVAQRX193YXNtX2NhbGxfY3RvcnMAABhfX3dhc21fYXBwbHlfZGF0YV9yZWxvY3MAAAtzb3J0SW5kZXhlcwABE2Vtc2NyaXB0ZW5fdGxzX2luaXQAAgqWEAMDAAELihAEAXwDewN/A30gCyAKayEMAkACQCAOBEAgDQRAQfj///8HIQpBiICAgHghDSALIAxNDQMgDCEBA0AgAyABQQJ0IgVqIAIgACAFaigCAEECdGooAgAiBTYCACAFIAogBSAKSBshCiAFIA0gBSANShshDSABQQFqIgEgC0cNAAsMAwsgDwRAIAsgDE0NAkF/IQ9B+P///wchCkGIgICAeCENIAwhAgNAIA8gByAAIAJBAnQiFWooAgAiFkECdGooAgAiFEcEQAJ/IAX9CQI4IAggFEEGdGoiDv0JAgwgDioCHP0gASAOKgIs/SACIA4qAjz9IAP95gEgBf0JAiggDv0JAgggDioCGP0gASAOKgIo/SACIA4qAjj9IAP95gEgBf0JAgggDv0JAgAgDioCEP0gASAOKgIg/SACIA4qAjD9IAP95gEgBf0JAhggDv0JAgQgDioCFP0gASAOKgIk/SACIA4qAjT9IAP95gH95AH95AH95AEiEf1f/QwAAAAAAECPQAAAAAAAQI9AIhL98gEiE/0hASIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAshDgJ/IBP9IQAiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgL/REgDv0cAQJ/IBEgEf0NCAkKCwwNDg8AAAAAAAAAAP1fIBL98gEiEf0hACIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAv9HAICfyAR/SEBIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4C/0cAyESIBQhDwsgAyAVaiABIBZBBHRq/QAAACAS/bUBIhH9GwAgEf0bAWogEf0bAmogEf0bA2oiDjYCACAOIAogCiAOShshCiAOIA0gDSAOSBshDSACQQFqIgIgC0cNAAsMAwsCfyAFKgIIu/0UIAUqAhi7/SIB/QwAAAAAAECPQAAAAAAAQI9A/fIBIhH9IQEiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIQ4CfyAR/SEAIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyECAn8gBSoCKLtEAAAAAABAj0CiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEFQfj///8HIQpBiICAgHghDSALIAxNDQIgAv0RIA79HAEgBf0cAiESIAwhBQNAIAMgBUECdCICaiABIAAgAmooAgBBBHRq/QAAACAS/bUBIhH9GwAgEf0bAWogEf0bAmoiAjYCACACIAogAiAKSBshCiACIA0gAiANShshDSAFQQFqIgUgC0cNAAsMAgsgDQRAQfj///8HIQpBiICAgHghDSALIAxNDQIgDCEBA0AgAyABQQJ0IgVqAn8gAiAAIAVqKAIAQQJ0aioCALtEAAAAAAAAsECiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyIONgIAIAogDiAKIA5IGyEKIA0gDiANIA5KGyENIAFBAWoiASALRw0ACwwCCyAPRQRAIAsgDE0NASAFKgIoIRcgBSoCGCEYIAUqAgghGUH4////ByEKQYiAgIB4IQ0gDCEFA0ACfyAXIAEgACAFQQJ0IgdqKAIAQQR0aiICKgIIlCAZIAIqAgCUIBggAioCBJSSkrtEAAAAAAAAsECiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEOIAMgB2ogDjYCACAKIA4gCiAOSBshCiANIA4gDSAOShshDSAFQQFqIgUgC0cNAAsMAgsgCyAMTQ0AQX8hD0H4////ByEKQYiAgIB4IQ0gDCECA0AgDyAHIAAgAkECdCIUaigCAEECdCIVaigCACIORwRAIAX9CQI4IAggDkEGdGoiD/0JAgwgDyoCHP0gASAPKgIs/SACIA8qAjz9IAP95gEgBf0JAiggD/0JAgggDyoCGP0gASAPKgIo/SACIA8qAjj9IAP95gEgBf0JAgggD/0JAgAgDyoCEP0gASAPKgIg/SACIA8qAjD9IAP95gEgBf0JAhggD/0JAgQgDyoCFP0gASAPKgIk/SACIA8qAjT9IAP95gH95AH95AH95AEhESAOIQ8LIAMgFGoCfyAR/R8DIAEgFUECdCIOQQxyaioCAJQgEf0fAiABIA5BCHJqKgIAlCAR/R8AIAEgDmoqAgCUIBH9HwEgASAOQQRyaioCAJSSkpK7RAAAAAAAALBAoiIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAsiDjYCACAKIA4gCiAOSBshCiANIA4gDSAOShshDSACQQFqIgIgC0cNAAsMAQtBiICAgHghDUH4////ByEKCyALIAxLBEAgCUEBa7MgDbIgCrKTlSEXIAwhDQNAAn8gFyADIA1BAnRqIgEoAgAgCmuylCIYi0MAAABPXQRAIBioDAELQYCAgIB4CyEOIAEgDjYCACAEIA5BAnRqIgEgASgCAEEBajYCACANQQFqIg0gC0cNAAsLIAlBAk8EQCAEKAIAIQ1BASEKA0AgBCAKQQJ0aiIBIAEoAgAgDWoiDTYCACAKQQFqIgogCUcNAAsLIAxBAEoEQCAMIQoDQCAGIApBAWsiAUECdCICaiAAIAJqKAIANgIAIApBAUshAiABIQogAg0ACwsgCyAMSgRAIAshCgNAIAYgCyAEIAMgCkEBayIKQQJ0IgFqKAIAQQJ0aiICKAIAIgVrQQJ0aiAAIAFqKAIANgIAIAIgBUEBazYCACAKIAxKDQALCwsEAEEACw==";

const SorterWasmNoSIMD = "AGFzbQEAAAAADwhkeWxpbmsuMAEEAAAAAAEXAmAAAGAQf39/f39/f39/f39/f39/fwACEgEDZW52Bm1lbW9yeQIDAICABAMDAgABBz4DEV9fd2FzbV9jYWxsX2N0b3JzAAAYX193YXNtX2FwcGx5X2RhdGFfcmVsb2NzAAALc29ydEluZGV4ZXMAAQqiDwICAAucDwMBfAd9Bn8gCyAKayEMAkACQCAOBEAgDQRAQfj///8HIQpBiICAgHghDSALIAxNDQMgDCEFA0AgAyAFQQJ0IgFqIAIgACABaigCAEECdGooAgAiATYCACABIAogASAKSBshCiABIA0gASANShshDSAFQQFqIgUgC0cNAAsMAwsgDwRAIAsgDE0NAkF/IQ9B+P///wchCkGIgICAeCENIAwhAgNAIA8gByAAIAJBAnQiGmooAgBBAnQiG2ooAgAiDkcEQAJ/IAUqAjgiESAIIA5BBnRqIg8qAjyUIAUqAigiEiAPKgI4lCAFKgIIIhMgDyoCMJQgBSoCGCIUIA8qAjSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIRgCfyARIA8qAiyUIBIgDyoCKJQgEyAPKgIglCAUIA8qAiSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIRkCfyARIA8qAhyUIBIgDyoCGJQgEyAPKgIQlCAUIA8qAhSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIRwCfyARIA8qAgyUIBIgDyoCCJQgEyAPKgIAlCAUIA8qAgSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIR0gDiEPCyADIBpqIAEgG0ECdGoiDigCBCAcbCAOKAIAIB1saiAOKAIIIBlsaiAOKAIMIBhsaiIONgIAIA4gCiAKIA5KGyEKIA4gDSANIA5IGyENIAJBAWoiAiALRw0ACwwDCwJ/IAUqAii7RAAAAAAAQI9AoiIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAshAgJ/IAUqAhi7RAAAAAAAQI9AoiIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAshByALIAxNAn8gBSoCCLtEAAAAAABAj0CiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEPQfj///8HIQpBiICAgHghDQ0CIAwhBQNAIAMgBUECdCIIaiABIAAgCGooAgBBBHRqIggoAgQgB2wgCCgCACAPbGogCCgCCCACbGoiCDYCACAIIAogCCAKSBshCiAIIA0gCCANShshDSAFQQFqIgUgC0cNAAsMAgsgDQRAQfj///8HIQpBiICAgHghDSALIAxNDQIgDCEFA0AgAyAFQQJ0IgFqAn8gAiAAIAFqKAIAQQJ0aioCALtEAAAAAAAAsECiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyIONgIAIAogDiAKIA5IGyEKIA0gDiANIA5KGyENIAVBAWoiBSALRw0ACwwCCyAPRQRAIAsgDE0NASAFKgIoIREgBSoCGCESIAUqAgghE0H4////ByEKQYiAgIB4IQ0gDCEFA0ACfyARIAEgACAFQQJ0IgdqKAIAQQR0aiICKgIIlCATIAIqAgCUIBIgAioCBJSSkrtEAAAAAAAAsECiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEOIAMgB2ogDjYCACAKIA4gCiAOSBshCiANIA4gDSAOShshDSAFQQFqIgUgC0cNAAsMAgsgCyAMTQ0AQX8hD0H4////ByEKQYiAgIB4IQ0gDCECA0AgDyAHIAAgAkECdCIYaigCAEECdCIZaigCACIORwRAIAUqAjgiESAIIA5BBnRqIg8qAjyUIAUqAigiEiAPKgI4lCAFKgIIIhMgDyoCMJQgBSoCGCIUIA8qAjSUkpKSIRUgESAPKgIslCASIA8qAiiUIBMgDyoCIJQgFCAPKgIklJKSkiEWIBEgDyoCHJQgEiAPKgIYlCATIA8qAhCUIBQgDyoCFJSSkpIhFyARIA8qAgyUIBIgDyoCCJQgEyAPKgIAlCAUIA8qAgSUkpKSIREgDiEPCyADIBhqAn8gFSABIBlBAnRqIg4qAgyUIBYgDioCCJQgESAOKgIAlCAXIA4qAgSUkpKSu0QAAAAAAACwQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIg42AgAgCiAOIAogDkgbIQogDSAOIA0gDkobIQ0gAkEBaiICIAtHDQALDAELQYiAgIB4IQ1B+P///wchCgsgCyAMSwRAIAlBAWuzIA2yIAqyk5UhESAMIQ0DQAJ/IBEgAyANQQJ0aiIBKAIAIAprspQiEotDAAAAT10EQCASqAwBC0GAgICAeAshDiABIA42AgAgBCAOQQJ0aiIBIAEoAgBBAWo2AgAgDUEBaiINIAtHDQALCyAJQQJPBEAgBCgCACENQQEhCgNAIAQgCkECdGoiASABKAIAIA1qIg02AgAgCkEBaiIKIAlHDQALCyAMQQBKBEAgDCEKA0AgBiAKQQFrIgFBAnQiAmogACACaigCADYCACAKQQFLIAEhCg0ACwsgCyAMSgRAIAshCgNAIAYgCyAEIAMgCkEBayIKQQJ0IgFqKAIAQQJ0aiICKAIAIgVrQQJ0aiAAIAFqKAIANgIAIAIgBUEBazYCACAKIAxKDQALCws=";

const SorterWasmNonShared = "AGFzbQEAAAAADwhkeWxpbmsuMAEEAAAAAAEXAmAAAGAQf39/f39/f39/f39/f39/fwACDwEDZW52Bm1lbW9yeQIAAAMDAgABBz4DEV9fd2FzbV9jYWxsX2N0b3JzAAAYX193YXNtX2FwcGx5X2RhdGFfcmVsb2NzAAALc29ydEluZGV4ZXMAAQrrDwICAAvlDwQBfAN7B30DfyALIAprIQwCQAJAIA4EQCANBEBB+P///wchCkGIgICAeCENIAsgDE0NAyAMIQUDQCADIAVBAnQiAWogAiAAIAFqKAIAQQJ0aigCACIBNgIAIAEgCiABIApIGyEKIAEgDSABIA1KGyENIAVBAWoiBSALRw0ACwwDCyAPBEAgCyAMTQ0CQX8hD0H4////ByEKQYiAgIB4IQ0gDCECA0AgDyAHIAAgAkECdCIcaigCACIdQQJ0aigCACIbRwRAAn8gBf0JAjggCCAbQQZ0aiIO/QkCDCAOKgIc/SABIA4qAiz9IAIgDioCPP0gA/3mASAF/QkCKCAO/QkCCCAOKgIY/SABIA4qAij9IAIgDioCOP0gA/3mASAF/QkCCCAO/QkCACAOKgIQ/SABIA4qAiD9IAIgDioCMP0gA/3mASAF/QkCGCAO/QkCBCAOKgIU/SABIA4qAiT9IAIgDioCNP0gA/3mAf3kAf3kAf3kASIR/V/9DAAAAAAAQI9AAAAAAABAj0AiEv3yASIT/SEBIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEOAn8gE/0hACIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAv9ESAO/RwBAn8gESAR/Q0ICQoLDA0ODwABAgMAAQID/V8gEv3yASIR/SEAIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4C/0cAgJ/IBH9IQEiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgL/RwDIRIgGyEPCyADIBxqIAEgHUEEdGr9AAAAIBL9tQEiEf0bACAR/RsBaiAR/RsCaiAR/RsDaiIONgIAIA4gCiAKIA5KGyEKIA4gDSANIA5IGyENIAJBAWoiAiALRw0ACwwDCwJ/IAUqAgi7/RQgBSoCGLv9IgH9DAAAAAAAQI9AAAAAAABAj0D98gEiEf0hASIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAshDgJ/IBH9IQAiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLAn8gBSoCKLtEAAAAAABAj0CiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEFQfj///8HIQpBiICAgHghDSALIAxNDQL9ESAO/RwBIAX9HAIhEiAMIQUDQCADIAVBAnQiAmogASAAIAJqKAIAQQR0av0AAAAgEv21ASIR/RsAIBH9GwFqIBH9GwJqIgI2AgAgAiAKIAIgCkgbIQogAiANIAIgDUobIQ0gBUEBaiIFIAtHDQALDAILIA0EQEH4////ByEKQYiAgIB4IQ0gCyAMTQ0CIAwhBQNAIAMgBUECdCIBagJ/IAIgACABaigCAEECdGoqAgC7RAAAAAAAALBAoiIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAsiDjYCACAKIA4gCiAOSBshCiANIA4gDSAOShshDSAFQQFqIgUgC0cNAAsMAgsgD0UEQCALIAxNDQEgBSoCKCEUIAUqAhghFSAFKgIIIRZB+P///wchCkGIgICAeCENIAwhBQNAAn8gFCABIAAgBUECdCIHaigCAEEEdGoiAioCCJQgFiACKgIAlCAVIAIqAgSUkpK7RAAAAAAAALBAoiIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAshDiADIAdqIA42AgAgCiAOIAogDkgbIQogDSAOIA0gDkobIQ0gBUEBaiIFIAtHDQALDAILIAsgDE0NAEF/IQ9B+P///wchCkGIgICAeCENIAwhAgNAIA8gByAAIAJBAnQiG2ooAgBBAnQiHGooAgAiDkcEQCAFKgI4IhQgCCAOQQZ0aiIPKgI8lCAFKgIoIhUgDyoCOJQgBSoCCCIWIA8qAjCUIAUqAhgiFyAPKgI0lJKSkiEYIBQgDyoCLJQgFSAPKgIolCAWIA8qAiCUIBcgDyoCJJSSkpIhGSAUIA8qAhyUIBUgDyoCGJQgFiAPKgIQlCAXIA8qAhSUkpKSIRogFCAPKgIMlCAVIA8qAgiUIBYgDyoCAJQgFyAPKgIElJKSkiEUIA4hDwsgAyAbagJ/IBggASAcQQJ0aiIOKgIMlCAZIA4qAgiUIBQgDioCAJQgGiAOKgIElJKSkrtEAAAAAAAAsECiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyIONgIAIAogDiAKIA5IGyEKIA0gDiANIA5KGyENIAJBAWoiAiALRw0ACwwBC0GIgICAeCENQfj///8HIQoLIAsgDEsEQCAJQQFrsyANsiAKspOVIRQgDCENA0ACfyAUIAMgDUECdGoiASgCACAKa7KUIhWLQwAAAE9dBEAgFagMAQtBgICAgHgLIQ4gASAONgIAIAQgDkECdGoiASABKAIAQQFqNgIAIA1BAWoiDSALRw0ACwsgCUECTwRAIAQoAgAhDUEBIQoDQCAEIApBAnRqIgEgASgCACANaiINNgIAIApBAWoiCiAJRw0ACwsgDEEASgRAIAwhCgNAIAYgCkEBayIBQQJ0IgJqIAAgAmooAgA2AgAgCkEBSyABIQoNAAsLIAsgDEoEQCALIQoDQCAGIAsgBCADIApBAWsiCkECdCIBaigCAEECdGoiAigCACIFa0ECdGogACABaigCADYCACACIAVBAWs2AgAgCiAMSg0ACwsL";

const SorterWasmNoSIMDNonShared = "AGFzbQEAAAAADwhkeWxpbmsuMAEEAAAAAAEXAmAAAGAQf39/f39/f39/f39/f39/fwACDwEDZW52Bm1lbW9yeQIAAAMDAgABBz4DEV9fd2FzbV9jYWxsX2N0b3JzAAAYX193YXNtX2FwcGx5X2RhdGFfcmVsb2NzAAALc29ydEluZGV4ZXMAAQqiDwICAAucDwMBfAd9Bn8gCyAKayEMAkACQCAOBEAgDQRAQfj///8HIQpBiICAgHghDSALIAxNDQMgDCEFA0AgAyAFQQJ0IgFqIAIgACABaigCAEECdGooAgAiATYCACABIAogASAKSBshCiABIA0gASANShshDSAFQQFqIgUgC0cNAAsMAwsgDwRAIAsgDE0NAkF/IQ9B+P///wchCkGIgICAeCENIAwhAgNAIA8gByAAIAJBAnQiGmooAgBBAnQiG2ooAgAiDkcEQAJ/IAUqAjgiESAIIA5BBnRqIg8qAjyUIAUqAigiEiAPKgI4lCAFKgIIIhMgDyoCMJQgBSoCGCIUIA8qAjSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIRgCfyARIA8qAiyUIBIgDyoCKJQgEyAPKgIglCAUIA8qAiSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIRkCfyARIA8qAhyUIBIgDyoCGJQgEyAPKgIQlCAUIA8qAhSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIRwCfyARIA8qAgyUIBIgDyoCCJQgEyAPKgIAlCAUIA8qAgSUkpKSu0QAAAAAAECPQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIR0gDiEPCyADIBpqIAEgG0ECdGoiDigCBCAcbCAOKAIAIB1saiAOKAIIIBlsaiAOKAIMIBhsaiIONgIAIA4gCiAKIA5KGyEKIA4gDSANIA5IGyENIAJBAWoiAiALRw0ACwwDCwJ/IAUqAii7RAAAAAAAQI9AoiIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAshAgJ/IAUqAhi7RAAAAAAAQI9AoiIQmUQAAAAAAADgQWMEQCAQqgwBC0GAgICAeAshByALIAxNAn8gBSoCCLtEAAAAAABAj0CiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEPQfj///8HIQpBiICAgHghDQ0CIAwhBQNAIAMgBUECdCIIaiABIAAgCGooAgBBBHRqIggoAgQgB2wgCCgCACAPbGogCCgCCCACbGoiCDYCACAIIAogCCAKSBshCiAIIA0gCCANShshDSAFQQFqIgUgC0cNAAsMAgsgDQRAQfj///8HIQpBiICAgHghDSALIAxNDQIgDCEFA0AgAyAFQQJ0IgFqAn8gAiAAIAFqKAIAQQJ0aioCALtEAAAAAAAAsECiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyIONgIAIAogDiAKIA5IGyEKIA0gDiANIA5KGyENIAVBAWoiBSALRw0ACwwCCyAPRQRAIAsgDE0NASAFKgIoIREgBSoCGCESIAUqAgghE0H4////ByEKQYiAgIB4IQ0gDCEFA0ACfyARIAEgACAFQQJ0IgdqKAIAQQR0aiICKgIIlCATIAIqAgCUIBIgAioCBJSSkrtEAAAAAAAAsECiIhCZRAAAAAAAAOBBYwRAIBCqDAELQYCAgIB4CyEOIAMgB2ogDjYCACAKIA4gCiAOSBshCiANIA4gDSAOShshDSAFQQFqIgUgC0cNAAsMAgsgCyAMTQ0AQX8hD0H4////ByEKQYiAgIB4IQ0gDCECA0AgDyAHIAAgAkECdCIYaigCAEECdCIZaigCACIORwRAIAUqAjgiESAIIA5BBnRqIg8qAjyUIAUqAigiEiAPKgI4lCAFKgIIIhMgDyoCMJQgBSoCGCIUIA8qAjSUkpKSIRUgESAPKgIslCASIA8qAiiUIBMgDyoCIJQgFCAPKgIklJKSkiEWIBEgDyoCHJQgEiAPKgIYlCATIA8qAhCUIBQgDyoCFJSSkpIhFyARIA8qAgyUIBIgDyoCCJQgEyAPKgIAlCAUIA8qAgSUkpKSIREgDiEPCyADIBhqAn8gFSABIBlBAnRqIg4qAgyUIBYgDioCCJQgESAOKgIAlCAXIA4qAgSUkpKSu0QAAAAAAACwQKIiEJlEAAAAAAAA4EFjBEAgEKoMAQtBgICAgHgLIg42AgAgCiAOIAogDkgbIQogDSAOIA0gDkobIQ0gAkEBaiICIAtHDQALDAELQYiAgIB4IQ1B+P///wchCgsgCyAMSwRAIAlBAWuzIA2yIAqyk5UhESAMIQ0DQAJ/IBEgAyANQQJ0aiIBKAIAIAprspQiEotDAAAAT10EQCASqAwBC0GAgICAeAshDiABIA42AgAgBCAOQQJ0aiIBIAEoAgBBAWo2AgAgDUEBaiINIAtHDQALCyAJQQJPBEAgBCgCACENQQEhCgNAIAQgCkECdGoiASABKAIAIA1qIg02AgAgCkEBaiIKIAlHDQALCyAMQQBKBEAgDCEKA0AgBiAKQQFrIgFBAnQiAmogACACaigCADYCACAKQQFLIAEhCg0ACwsgCyAMSgRAIAshCgNAIAYgCyAEIAMgCkEBayIKQQJ0IgFqKAIAQQJ0aiICKAIAIgVrQQJ0aiAAIAFqKAIANgIAIAIgBUEBazYCACAKIAxKDQALCws=";

/**
 * Sort worker function that runs in a Web Worker
 * Handles the actual sorting logic using WebAssembly
 */
function sortWorker(self) {

    let wasmInstance;
    let wasmMemory;
    let useSharedMemory;
    let integerBasedSort;
    let dynamicMode;
    let splatCount;
    let indexesToSortOffset;
    let sortedIndexesOffset;
    let sceneIndexesOffset;
    let transformsOffset;
    let precomputedDistancesOffset;
    let mappedDistancesOffset;
    let frequenciesOffset;
    let centersOffset;
    let modelViewProjOffset;
    let countsZero;
    let sortedIndexesOut;
    let distanceMapRange;
    let uploadedSplatCount;
    let Constants;

    function sort(splatSortCount, splatRenderCount, modelViewProj,
                  usePrecomputedDistances, copyIndexesToSort, copyPrecomputedDistances, copyTransforms) {
        const sortStartTime = performance.now();

        if (!useSharedMemory) {
            const indexesToSort = new Uint32Array(wasmMemory, indexesToSortOffset, copyIndexesToSort.byteLength / Constants.BytesPerInt);
            indexesToSort.set(copyIndexesToSort);
            const transforms = new Float32Array(wasmMemory, transformsOffset, copyTransforms.byteLength / Constants.BytesPerFloat);
            transforms.set(copyTransforms);
            if (usePrecomputedDistances) {
                let precomputedDistances;
                if (integerBasedSort) {
                    precomputedDistances = new Int32Array(wasmMemory, precomputedDistancesOffset,
                                                          copyPrecomputedDistances.byteLength / Constants.BytesPerInt);
                } else {
                    precomputedDistances = new Float32Array(wasmMemory, precomputedDistancesOffset,
                                                            copyPrecomputedDistances.byteLength / Constants.BytesPerFloat);
                }
                precomputedDistances.set(copyPrecomputedDistances);
            }
        }

        if (!countsZero) countsZero = new Uint32Array(distanceMapRange);
        new Float32Array(wasmMemory, modelViewProjOffset, 16).set(modelViewProj);
        new Uint32Array(wasmMemory, frequenciesOffset, distanceMapRange).set(countsZero);
        wasmInstance.exports.sortIndexes(indexesToSortOffset, centersOffset, precomputedDistancesOffset,
                                         mappedDistancesOffset, frequenciesOffset, modelViewProjOffset,
                                         sortedIndexesOffset, sceneIndexesOffset, transformsOffset, distanceMapRange,
                                         splatSortCount, splatRenderCount, splatCount, usePrecomputedDistances, integerBasedSort,
                                         dynamicMode);

        const sortMessage = {
            'sortDone': true,
            'splatSortCount': splatSortCount,
            'splatRenderCount': splatRenderCount,
            'sortTime': 0
        };
        if (!useSharedMemory) {
            const sortedIndexes = new Uint32Array(wasmMemory, sortedIndexesOffset, splatRenderCount);
            if (!sortedIndexesOut || sortedIndexesOut.length < splatRenderCount) {
                sortedIndexesOut = new Uint32Array(splatRenderCount);
            }
            sortedIndexesOut.set(sortedIndexes);
            sortMessage.sortedIndexes = sortedIndexesOut;
        }
        const sortEndTime = performance.now();

        sortMessage.sortTime = sortEndTime - sortStartTime;

        self.postMessage(sortMessage);
    }

    self.onmessage = (e) => {
        if (e.data.centers) {
            let centers = e.data.centers;
            let sceneIndexes = e.data.sceneIndexes;
            if (integerBasedSort) {
                new Int32Array(wasmMemory, centersOffset + e.data.range.from * Constants.BytesPerInt * 4,
                               e.data.range.count * 4).set(new Int32Array(centers));
            } else {
                new Float32Array(wasmMemory, centersOffset + e.data.range.from * Constants.BytesPerFloat * 4,
                                 e.data.range.count * 4).set(new Float32Array(centers));
            }
            if (dynamicMode) {
                new Uint32Array(wasmMemory, sceneIndexesOffset + e.data.range.from * 4,
                                e.data.range.count).set(new Uint32Array(sceneIndexes));
            }
            uploadedSplatCount = e.data.range.from + e.data.range.count;
        } else if (e.data.sort) {
            const renderCount = Math.min(e.data.sort.splatRenderCount || 0, uploadedSplatCount);
            const sortCount = Math.min(e.data.sort.splatSortCount || 0, uploadedSplatCount);
            const usePrecomputedDistances = e.data.sort.usePrecomputedDistances;

            let copyIndexesToSort;
            let copyPrecomputedDistances;
            let copyTransforms;
            if (!useSharedMemory) {
                copyIndexesToSort = e.data.sort.indexesToSort;
                copyTransforms = e.data.sort.transforms;
                if (usePrecomputedDistances) copyPrecomputedDistances = e.data.sort.precomputedDistances;
            }
            sort(sortCount, renderCount, e.data.sort.modelViewProj, usePrecomputedDistances,
                 copyIndexesToSort, copyPrecomputedDistances, copyTransforms);
        } else if (e.data.init) {
            // Yep, this is super hacky and gross :(
            Constants = e.data.init.Constants;

            splatCount = e.data.init.splatCount;
            useSharedMemory = e.data.init.useSharedMemory;
            integerBasedSort = e.data.init.integerBasedSort;
            dynamicMode = e.data.init.dynamicMode;
            distanceMapRange = e.data.init.distanceMapRange;
            uploadedSplatCount = 0;

            const CENTERS_BYTES_PER_ENTRY = integerBasedSort ? (Constants.BytesPerInt * 4) : (Constants.BytesPerFloat * 4);

            const sorterWasmBytes = new Uint8Array(e.data.init.sorterWasmBytes);

            const matrixSize = 16 * Constants.BytesPerFloat;
            const memoryRequiredForIndexesToSort = splatCount * Constants.BytesPerInt;
            const memoryRequiredForCenters = splatCount * CENTERS_BYTES_PER_ENTRY;
            const memoryRequiredForModelViewProjectionMatrix = matrixSize;
            const memoryRequiredForPrecomputedDistances = integerBasedSort ?
                                                          (splatCount * Constants.BytesPerInt) : (splatCount * Constants.BytesPerFloat);
            const memoryRequiredForMappedDistances = splatCount * Constants.BytesPerInt;
            const memoryRequiredForSortedIndexes = splatCount * Constants.BytesPerInt;
            const memoryRequiredForIntermediateSortBuffers = integerBasedSort ? (distanceMapRange * Constants.BytesPerInt * 2) :
                                                                                (distanceMapRange * Constants.BytesPerFloat * 2);
            const memoryRequiredforTransformIndexes = dynamicMode ? (splatCount * Constants.BytesPerInt) : 0;
            const memoryRequiredforTransforms = dynamicMode ? (Constants.MaxScenes * matrixSize) : 0;
            const extraMemory = Constants.MemoryPageSize * 32;

            const totalRequiredMemory = memoryRequiredForIndexesToSort +
                                        memoryRequiredForCenters +
                                        memoryRequiredForModelViewProjectionMatrix +
                                        memoryRequiredForPrecomputedDistances +
                                        memoryRequiredForMappedDistances +
                                        memoryRequiredForIntermediateSortBuffers +
                                        memoryRequiredForSortedIndexes +
                                        memoryRequiredforTransformIndexes +
                                        memoryRequiredforTransforms +
                                        extraMemory;
            const totalPagesRequired = Math.floor(totalRequiredMemory / Constants.MemoryPageSize ) + 1;
            const sorterWasmImport = {
                module: {},
                env: {
                    memory: new WebAssembly.Memory({
                        initial: totalPagesRequired,
                        maximum: totalPagesRequired,
                        shared: true,
                    }),
                }
            };
            WebAssembly.compile(sorterWasmBytes)
            .then((wasmModule) => {
                return WebAssembly.instantiate(wasmModule, sorterWasmImport);
            })
            .then((instance) => {
                wasmInstance = instance;
                indexesToSortOffset = 0;
                centersOffset = indexesToSortOffset + memoryRequiredForIndexesToSort;
                modelViewProjOffset = centersOffset + memoryRequiredForCenters;
                precomputedDistancesOffset = modelViewProjOffset + memoryRequiredForModelViewProjectionMatrix;
                mappedDistancesOffset = precomputedDistancesOffset + memoryRequiredForPrecomputedDistances;
                frequenciesOffset = mappedDistancesOffset + memoryRequiredForMappedDistances;
                sortedIndexesOffset = frequenciesOffset + memoryRequiredForIntermediateSortBuffers;
                sceneIndexesOffset = sortedIndexesOffset + memoryRequiredForSortedIndexes;
                transformsOffset = sceneIndexesOffset + memoryRequiredforTransformIndexes;
                wasmMemory = sorterWasmImport.env.memory.buffer;
                if (useSharedMemory) {
                    self.postMessage({
                        'sortSetupPhase1Complete': true,
                        'indexesToSortBuffer': wasmMemory,
                        'indexesToSortOffset': indexesToSortOffset,
                        'sortedIndexesBuffer': wasmMemory,
                        'sortedIndexesOffset': sortedIndexesOffset,
                        'precomputedDistancesBuffer': wasmMemory,
                        'precomputedDistancesOffset': precomputedDistancesOffset,
                        'transformsBuffer': wasmMemory,
                        'transformsOffset': transformsOffset
                    });
                } else {
                    self.postMessage({
                        'sortSetupPhase1Complete': true
                    });
                }
            });
        }
    };
}

/**
 * Creates a sort worker for GPU-based sorting
 * @param {number} splatCount - Number of splats to sort
 * @param {boolean} useSharedMemory - Whether to use shared memory
 * @param {boolean} enableSIMDInSort - Whether to enable SIMD instructions
 * @param {boolean} integerBasedSort - Whether to use integer-based sorting
 * @param {boolean} dynamicMode - Whether dynamic mode is enabled
 * @param {number} splatSortDistanceMapPrecision - Precision for distance map
 * @returns {Worker} The created sort worker
 */
function createSortWorker(splatCount, useSharedMemory, enableSIMDInSort, integerBasedSort, dynamicMode,
                                 splatSortDistanceMapPrecision = Constants$1.DefaultSplatSortDistanceMapPrecision) {
    const worker = new Worker(
        URL.createObjectURL(
            new Blob(['(', sortWorker.toString(), ')(self)'], {
                type: 'application/javascript',
            }),
        ),
    );

    let sourceWasm = SorterWasm;

    // iOS makes choosing the right WebAssembly configuration tricky :(
    const iOSSemVer = isIOS() ? getIOSSemever() : null;
    if (!enableSIMDInSort && !useSharedMemory) {
        sourceWasm = SorterWasmNoSIMD;
        // Testing on various devices has shown that even when shared memory is disabled, the WASM module with shared
        // memory can still be used most of the time -- the exception seems to be iOS devices below 16.4
        if (iOSSemVer && iOSSemVer.major <= 16 && iOSSemVer.minor < 4) {
            sourceWasm = SorterWasmNoSIMDNonShared;
        }
    } else if (!enableSIMDInSort) {
        sourceWasm = SorterWasmNoSIMD;
    } else if (!useSharedMemory) {
        // Same issue with shared memory as above on iOS devices
        if (iOSSemVer && iOSSemVer.major <= 16 && iOSSemVer.minor < 4) {
            sourceWasm = SorterWasmNonShared;
        }
    }

    const sorterWasmBinaryString = atob(sourceWasm);
    const sorterWasmBytes = new Uint8Array(sorterWasmBinaryString.length);
    for (let i = 0; i < sorterWasmBinaryString.length; i++) {
        sorterWasmBytes[i] = sorterWasmBinaryString.charCodeAt(i);
    }

    worker.postMessage({
        'init': {
            'sorterWasmBytes': sorterWasmBytes.buffer,
            'splatCount': splatCount,
            'useSharedMemory': useSharedMemory,
            'integerBasedSort': integerBasedSort,
            'dynamicMode': dynamicMode,
            'distanceMapRange': 1 << splatSortDistanceMapPrecision,
            // Super hacky
            'Constants': {
                'BytesPerFloat': Constants$1.BytesPerFloat,
                'BytesPerInt': Constants$1.BytesPerInt,
                'MemoryPageSize': Constants$1.MemoryPageSize,
                'MaxScenes': Constants$1.MaxScenes
            }
        }
    });
    return worker;
}

/**
 * Viewer
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * HEAVILY MODIFIED for FLAME avatar support:
 * - Added FLAME head model integration
 * - Extended with expression/pose controls
 * - Additional rendering pipeline modifications
 * - Additional ~900 lines of FLAME-specific code
 */


// UI components - stub implementations for now
class LoadingSpinner {
    constructor(msg, container) { this.tasks = []; }
    show() {}
    hide() {}
    setContainer(c) {}
    addTask(msg) { return this.tasks.push(msg); }
    removeTask(id) {}
    removeAllTasks() { this.tasks = []; }
    setMessageForTask(id, msg) {}
}

class LoadingProgressBar {
    constructor(container) {}
    show() {}
    hide() {}
    setContainer(c) {}
    setProgress(p) {}
}

class SceneHelper {
    constructor(scene) { 
        this.scene = scene; 
        this.meshCursor = null;
        this.meshCursorVisible = false;
        this.focusMarker = null;
        this.focusMarkerOpacity = 0;
        this.controlPlane = null;
        this.controlPlaneVisible = false;
    }
    setupMeshCursor() {}
    setupFocusMarker() {}
    setupControlPlane() {}
    updateMeshCursor(pos, active) {}
    updateFocusMarker(target, camera, renderDimensions) {}
    updateControlPlane(cam, ctrl) {}
    setFocusMarkerVisibility(v) {}
    setFocusMarkerOpacity(o) { this.focusMarkerOpacity = o; }
    getFocusMarkerOpacity() { return this.focusMarkerOpacity; }
    positionAndOrientFocusMarker(pos, cam) {}
    positionAndOrientMeshCursor(pos, cam) {}
    setMeshCursorVisibility(visible) { this.meshCursorVisible = visible; }
    getMeschCursorVisibility() { return this.meshCursorVisible; }
    setControlPlaneVisibility(visible) { this.controlPlaneVisible = visible; }
    positionAndOrientControlPlane(pos, quat, scale) {}
    updateForRenderMode(mode, mesh) {}
    dispose() {}
}

/**
 * Viewer - Core Gaussian Splatting Viewer
 * Handles the Three.js scene, camera, controls, and rendering loop.
 */
class Viewer {
  /**
   * @param {object} options - Configuration options
   * @param {Array<number>} [options.cameraUp=[0, 1, 0]] - Camera up vector
   * @param {Array<number>} [options.initialCameraPosition=[0, 10, 15]] - Initial camera position
   * @param {Array<number>} [options.initialCameraRotation=[0, 0, 0]] - Initial camera rotation
   * @param {Array<number>} [options.initialCameraLookAt=[0, 0, 0]] - Initial camera look-at point
   * @param {boolean} [options.dropInMode=false] - If true, viewer is used as a Three.js scene object
   * @param {boolean} [options.selfDrivenMode=true] - If true, viewer manages its own render loop
   * @param {boolean} [options.useBuiltInControls=true] - If true, uses OrbitControls
   * @param {HTMLElement} [options.rootElement] - Parent element for the canvas
   * @param {HTMLCanvasElement} [options.threejsCanvas] - Existing canvas to use
   * @param {boolean} [options.ignoreDevicePixelRatio=false] - If true, forces DPR to 1
   * @param {boolean} [options.halfPrecisionCovariancesOnGPU=false] - Use 16-bit float for covariances
   * @param {THREE.Scene} [options.threeScene] - External Three.js scene to render
   * @param {THREE.WebGLRenderer} [options.renderer] - External Three.js renderer
   * @param {THREE.Camera} [options.camera] - External Three.js camera
   * @param {boolean} [options.gpuAcceleratedSort=false] - Use GPU for sorting distances
   * @param {boolean} [options.integerBasedSort=true] - Use integer arithmetic for sorting
   * @param {boolean} [options.sharedMemoryForWorkers=true] - Use SharedArrayBuffer for workers
   * @param {boolean} [options.dynamicScene=false] - Optimize for dynamic scenes
   */
  constructor(options = {}) {
    // The natural 'up' vector for viewing the scene (only has an effect when used with orbit controls and
    // when the viewer uses its own camera).
    if (!options.cameraUp) options.cameraUp = [0, 1, 0];
    this.cameraUp = new THREE.Vector3().fromArray(options.cameraUp);

    // The camera's initial position (only used when the viewer uses its own camera).
    if (!options.initialCameraPosition)
      options.initialCameraPosition = [0, 10, 15];
    this.initialCameraPosition = new THREE.Vector3().fromArray(
      options.initialCameraPosition
    );

    if (!options.initialCameraRotation)
        options.initialCameraRotation = [0, 0, 0];
      this.initialCameraRotation = new THREE.Vector3().fromArray(
        options.initialCameraRotation
    );
    this.backgroundColor = options.backgroundColor;

    // The initial focal point of the camera and center of the camera's orbit (only used when the viewer uses its own camera).
    if (!options.initialCameraLookAt) options.initialCameraLookAt = [0, 0, 0];
    this.initialCameraLookAt = new THREE.Vector3().fromArray(
      options.initialCameraLookAt
    );

    // 'dropInMode' is a flag that is used internally to support the usage of the viewer as a Three.js scene object
    this.dropInMode = options.dropInMode || false;

    // If 'selfDrivenMode' is true, the viewer manages its own update/animation loop via requestAnimationFrame()
    if (options.selfDrivenMode === undefined || options.selfDrivenMode === null)
      options.selfDrivenMode = true;
    this.selfDrivenMode = options.selfDrivenMode && !this.dropInMode;
    this.selfDrivenUpdateFunc = this.selfDrivenUpdate.bind(this);

    // If 'useBuiltInControls' is true, the viewer will create its own instance of OrbitControls and attach to the camera
    if (options.useBuiltInControls === undefined)
      options.useBuiltInControls = true;
    this.useBuiltInControls = options.useBuiltInControls;

    // parent element of the Three.js renderer canvas
    this.rootElement = options.rootElement;
    this.canvas = options.threejsCanvas;
    // Tells the viewer to pretend the device pixel ratio is 1, which can boost performance on devices where it is larger,
    // at a small cost to visual quality
    this.ignoreDevicePixelRatio = options.ignoreDevicePixelRatio || false;
    this.devicePixelRatio = this.ignoreDevicePixelRatio
      ? 1
      : window.devicePixelRatio || 1;

    // Tells the viewer to use 16-bit floating point values when storing splat covariance data in textures, instead of 32-bit
    this.halfPrecisionCovariancesOnGPU =
      options.halfPrecisionCovariancesOnGPU || false;

    // If 'threeScene' is valid, it will be rendered by the viewer along with the splat mesh
    this.threeScene = options.threeScene;
    // Allows for usage of an external Three.js renderer
    this.renderer = options.renderer;
    // Allows for usage of an external Three.js camera
    this.camera = options.camera;

    // If 'gpuAcceleratedSort' is true, a partially GPU-accelerated approach to sorting splats will be used.
    // Currently this means pre-computing splat distances from the camera on the GPU
    this.gpuAcceleratedSort = options.gpuAcceleratedSort || false;

    // if 'integerBasedSort' is true, the integer version of splat centers as well as other values used to calculate
    // splat distances are used instead of the float version. This speeds up computation, but introduces the possibility of
    // overflow in larger scenes.
    if (
      options.integerBasedSort === undefined ||
      options.integerBasedSort === null
    ) {
      options.integerBasedSort = true;
    }
    this.integerBasedSort = options.integerBasedSort;

    // If 'sharedMemoryForWorkers' is true, a SharedArrayBuffer will be used to communicate with web workers. This method
    // is faster than copying memory to or from web workers, but comes with security implications as outlined here:
    // https://web.dev/articles/cross-origin-isolation-guide
    // If enabled, it requires specific CORS headers to be present in the response from the server that is sent when
    // loading the application. More information is available in the README.
    if (
      options.sharedMemoryForWorkers === undefined ||
      options.sharedMemoryForWorkers === null
    )
      options.sharedMemoryForWorkers = true;
    this.sharedMemoryForWorkers = false; //options.sharedMemoryForWorkers;

    // if 'dynamicScene' is true, it tells the viewer to assume scene elements are not stationary or that the number of splats in the
    // scene may change. This prevents optimizations that depend on a static scene from being made. Additionally, if 'dynamicScene' is
    // true it tells the splat mesh to not apply scene tranforms to splat data that is returned by functions like
    // SplatMesh.getSplatCenter() by default.
    this.dynamicScene = !!options.dynamicScene;

    // When true, will perform additional steps during rendering to address artifacts caused by the rendering of gaussians at a
    // substantially different resolution than that at which they were rendered during training. This will only work correctly
    // for models that were trained using a process that utilizes this compensation calculation. For more details:
    // https://github.com/nerfstudio-project/gsplat/pull/117
    // https://github.com/graphdeco-inria/gaussian-splatting/issues/294#issuecomment-1772688093
    this.antialiased = options.antialiased || false;

    // This constant is added to the projected 2D screen-space splat scales
    this.kernel2DSize =
      options.kernel2DSize === undefined ? 0.3 : options.kernel2DSize;

    // if 'renderMode' is RenderMode.Always, then the viewer will rrender the scene on every update. If it is RenderMode.OnChange,
    // it will only render when something in the scene has changed.
    this.renderMode = options.renderMode || RenderMode.Always;

    // SceneRevealMode.Default results in a nice, slow fade-in effect for progressively loaded scenes,
    // and a fast fade-in for non progressively loaded scenes.
    // SceneRevealMode.Gradual will force a slow fade-in for all scenes.
    // SceneRevealMode.Instant will force all loaded scene data to be immediately visible.
    this.sceneRevealMode = options.sceneRevealMode || SceneRevealMode.Default;

    // Hacky, experimental, non-scientific parameter for tweaking focal length related calculations. For scenes with very
    // small gaussians, small details, and small dimensions -- increasing this value can help improve visual quality.
    this.focalAdjustment = options.focalAdjustment || 1.0;

    // Specify the maximum screen-space splat size, can help deal with large splats that get too unwieldy
    this.maxScreenSpaceSplatSize = options.maxScreenSpaceSplatSize || 1024;

    // The verbosity of console logging
    this.logLevel = options.logLevel || LogLevel.None;

    // Degree of spherical harmonics to utilize in rendering splats (assuming the data is present in the splat scene).
    // Valid values are 0 - 2. Default value is 0.
    this.sphericalHarmonicsDegree = options.sphericalHarmonicsDegree || 0;

    // When true, allows for usage of extra properties and attributes during rendering for effects such as opacity adjustment.
    // Default is false for performance reasons. These properties are separate from transform properties (scale, rotation, position)
    // that are enabled by the 'dynamicScene' parameter.
    this.enableOptionalEffects = options.enableOptionalEffects || false;

    // Enable the usage of SIMD WebAssembly instructions for the splat sort
    if (
      options.enableSIMDInSort === undefined ||
      options.enableSIMDInSort === null
    )
      options.enableSIMDInSort = true;
    this.enableSIMDInSort = options.enableSIMDInSort;

    // Level to compress non KSPLAT files when loading them for direct rendering
    if (
      options.inMemoryCompressionLevel === undefined ||
      options.inMemoryCompressionLevel === null
    ) {
      options.inMemoryCompressionLevel = 0;
    }
    this.inMemoryCompressionLevel = options.inMemoryCompressionLevel;

    // Reorder splat data in memory after loading is complete to optimize cache utilization. Default is true.
    // Does not apply if splat scene is progressively loaded.
    if (
      options.optimizeSplatData === undefined ||
      options.optimizeSplatData === null
    ) {
      options.optimizeSplatData = true;
    }
    this.optimizeSplatData = options.optimizeSplatData;

    // When true, the intermediate splat data that is the result of decompressing splat bufffer(s) and is used to
    // populate the data textures will be freed. This will reduces memory usage, but if that data needs to be modified
    // it will need to be re-populated from the splat buffer(s). Default is false.
    if (
      options.freeIntermediateSplatData === undefined ||
      options.freeIntermediateSplatData === null
    ) {
      options.freeIntermediateSplatData = false;
    }
    this.freeIntermediateSplatData = options.freeIntermediateSplatData;

    // It appears that for certain iOS versions, special actions need to be taken with the
    // usage of SIMD instructions and shared memory
    if (isIOS()) {
      const semver = getIOSSemever();
      if (semver.major < 17) {
        this.enableSIMDInSort = false;
      }
      if (semver.major < 16) {
        this.sharedMemoryForWorkers = false;
      }
    }

    // Tell the viewer how to render the splats
    if (
      options.splatRenderMode === undefined ||
      options.splatRenderMode === null
    ) {
      options.splatRenderMode = SplatRenderMode.ThreeD;
    }
    this.splatRenderMode = options.splatRenderMode;

    // Customize the speed at which the scene is revealed
    this.sceneFadeInRateMultiplier = options.sceneFadeInRateMultiplier || 1.0;

    // Set the range for the depth map for the counting sort used to sort the splats
    this.splatSortDistanceMapPrecision =
      options.splatSortDistanceMapPrecision ||
      Constants$1.DefaultSplatSortDistanceMapPrecision;
    const maxPrecision = this.integerBasedSort ? 20 : 24;
    this.splatSortDistanceMapPrecision = clamp(
      this.splatSortDistanceMapPrecision,
      10,
      maxPrecision
    );

    this.onSplatMeshChangedCallback = null;
    this.createSplatMesh();

    this.controls = null;
    this.perspectiveControls = null;
    this.orthographicControls = null;

    this.orthographicCamera = null;
    this.perspectiveCamera = null;

    this.showMeshCursor = false;
    this.showControlPlane = false;
    this.showInfo = false;

    this.sceneHelper = null;

    this.sortWorker = null;
    this.sortRunning = false;
    this.splatRenderCount = 0;
    this.splatSortCount = 0;
    this.lastSplatSortCount = 0;
    this.sortWorkerIndexesToSort = null;
    this.sortWorkerSortedIndexes = null;
    this.sortWorkerPrecomputedDistances = null;
    this.sortWorkerTransforms = null;
    this.preSortMessages = [];
    this.runAfterNextSort = [];

    this.selfDrivenModeRunning = false;
    this.splatRenderReady = false;

    this.raycaster = new Raycaster();

    this.infoPanel = null;

    this.startInOrthographicMode = false;

    this.currentFPS = 0;
    this.lastSortTime = 0;
    this.consecutiveRenderFrames = 0;

    this.previousCameraTarget = new THREE.Vector3();
    this.nextCameraTarget = new THREE.Vector3();

    this.mousePosition = new THREE.Vector2();
    this.mouseDownPosition = new THREE.Vector2();
    this.mouseDownTime = null;

    this.resizeObserver = null;
    this.mouseMoveListener = null;
    this.mouseDownListener = null;
    this.mouseUpListener = null;
    this.keyDownListener = null;

    this.sortPromise = null;
    this.sortPromiseResolver = null;
    this.splatSceneDownloadControllers = [];
    this.splatSceneDownloadPromises = {};
    this.splatSceneDownloadAndBuildPromise = null;
    this.splatSceneRemovalPromise = null;

    this.loadingSpinner = new LoadingSpinner(
      null,
      this.rootElement || document.body
    );
    this.loadingSpinner.hide();
    this.loadingProgressBar = new LoadingProgressBar(
      this.rootElement || document.body
    );
    this.loadingProgressBar.hide();
    // this.infoPanel = new InfoPanel(this.rootElement || document.body)
    // this.infoPanel.hide()

    this.usingExternalCamera = this.dropInMode || this.camera ? true : false;
    this.usingExternalRenderer = this.dropInMode || this.renderer ? true : false;

    this.initialized = false;
    this.disposing = false;
    this.disposed = false;
    this.disposePromise = null;

    this.lastTime = 0;
    this.gaussianSplatCount = 0;
    this.totalFrames = 0; 
    this.flame_params = null;
    this.bone_tree = null;
    this.lbs_weight_80k = null;
    this.frame = 0;
  
    this.useFlame = true;
    this.bones = null;
    this.skeleton = null;
    this. avatarMesh = null;
    this.skinModel = null;
    this.boneRoot = null;
    this.baseMesh = null;
    this.setSkinAttibutes = false;

    if (!this.dropInMode) this.init();
  }

  createSplatMesh() {
    this.splatMesh = new SplatMesh(
      this.splatRenderMode,
      this.dynamicScene,
      this.enableOptionalEffects,
      this.halfPrecisionCovariancesOnGPU,
      this.devicePixelRatio,
      this.gpuAcceleratedSort,
      this.integerBasedSort,
      this.antialiased,
      this.maxScreenSpaceSplatSize,
      this.logLevel,
      this.sphericalHarmonicsDegree,
      this.sceneFadeInRateMultiplier,
      this.kernel2DSize
    );
    this.splatMesh.frustumCulled = false;
    if (this.onSplatMeshChangedCallback) this.onSplatMeshChangedCallback();
  }

  init() {
    if (this.initialized) return

    if (!this.rootElement) {
      if (!this.usingExternalRenderer) {
        this.rootElement = document.createElement('div');
        this.rootElement.style.width = '100%';
        this.rootElement.style.height = '100%';
        this.rootElement.style.position = 'absolute';
        document.body.appendChild(this.rootElement);
      } else {
        this.rootElement = this.renderer.domElement || document.body;
      }
    }

    this.setupCamera();
    this.setupRenderer();
    // 暂时去掉控制器
    // this.setupControls()
    this.setupEventHandlers();

    this.threeScene = this.threeScene || new THREE.Scene();
    this.sceneHelper = new SceneHelper(this.threeScene);
    this.sceneHelper.setupMeshCursor();
    this.sceneHelper.setupFocusMarker();
    this.sceneHelper.setupControlPlane();

    this.loadingProgressBar.setContainer(this.rootElement);
    this.loadingSpinner.setContainer(this.rootElement);
    // this.infoPanel.setContainer(this.rootElement)

    this.initialized = true;
  }

  setupCamera() {
    if (!this.usingExternalCamera) {
      const renderDimensions = new THREE.Vector2();
      this.getRenderDimensions(renderDimensions);

      this.perspectiveCamera = new THREE.PerspectiveCamera(
        THREE_CAMERA_FOV,
        renderDimensions.x / renderDimensions.y,
        0.1,
        1000
      );
      this.orthographicCamera = new THREE.OrthographicCamera(
        renderDimensions.x / -2,
        renderDimensions.x / 2,
        renderDimensions.y / 2,
        renderDimensions.y / -2,
        0.1,
        1000
      );
      this.camera = this.startInOrthographicMode
        ? this.orthographicCamera
        : this.perspectiveCamera;
      this.camera.position.copy(this.initialCameraPosition);
      // this.camera.up.copy(this.cameraUp).normalize()
      // this.camera.lookAt(this.initialCameraLookAt)
      this.camera.rotateX(THREE.MathUtils.degToRad(this.initialCameraRotation.x));
      this.camera.rotateY(THREE.MathUtils.degToRad(this.initialCameraRotation.y));
      this.camera.rotateZ(THREE.MathUtils.degToRad(this.initialCameraRotation.z));
    }
  }

  setupRenderer() {
    if (!this.usingExternalRenderer) {
      const renderDimensions = new THREE.Vector2();
      this.getRenderDimensions(renderDimensions);

      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        precision: 'highp',
        canvas: this.canvas
      });
      this.renderer.setPixelRatio(this.devicePixelRatio);
      this.renderer.autoClear = true;
      this.renderer.setClearColor(this.backgroundColor, 1.0); // set background color according to the config

      this.renderer.setSize(renderDimensions.x, renderDimensions.y);

      this.resizeObserver = new ResizeObserver(() => {
        this.getRenderDimensions(renderDimensions);
        this.renderer.setSize(renderDimensions.x, renderDimensions.y);
        this.forceRenderNextFrame();
      });
      this.resizeObserver.observe(this.rootElement);
      this.rootElement.appendChild(this.renderer.domElement);
    }
  }

  setupControls() {
    if (this.useBuiltInControls) {
      if (!this.usingExternalCamera) {
        this.perspectiveControls = new OrbitControls_js.OrbitControls(
          this.perspectiveCamera,
          this.renderer.domElement
        );
        this.orthographicControls = new OrbitControls_js.OrbitControls(
          this.orthographicCamera,
          this.renderer.domElement
        );
      } else {
        if (this.camera.isOrthographicCamera) {
          this.orthographicControls = new OrbitControls_js.OrbitControls(
            this.camera,
            this.renderer.domElement
          );
        } else {
          this.perspectiveControls = new OrbitControls_js.OrbitControls(
            this.camera,
            this.renderer.domElement
          );
        }
      }
      for (let controls of [
        this.orthographicControls,
        this.perspectiveControls
      ]) {
        if (controls) {
          controls.listenToKeyEvents(window);
          controls.rotateSpeed = 0.5;
          controls.maxPolarAngle = Math.PI * 0.5;// + Math.PI / 24
          controls.minPolarAngle = Math.PI * 0.5;// - Math.PI / 24
          controls.minAzimuthAngle = -Math.PI / 72;
          controls.maxAzimuthAngle = Math.PI / 72;
          controls.enableDamping = true;
          controls.dampingFactor = 0.05;
          controls.target.copy(this.initialCameraLookAt);
          controls.update();
        }
      }
      this.controls = this.camera.isOrthographicCamera
        ? this.orthographicControls
        : this.perspectiveControls;
      this.controls.update();
    }
  }

  setupEventHandlers() {
    if (this.useBuiltInControls) {
      this.mouseMoveListener = this.onMouseMove.bind(this);
      this.renderer.domElement.addEventListener(
        'pointermove',
        this.mouseMoveListener,
        false
      );
      this.mouseDownListener = this.onMouseDown.bind(this);
      this.renderer.domElement.addEventListener(
        'pointerdown',
        this.mouseDownListener,
        false
      );
      this.mouseUpListener = this.onMouseUp.bind(this);
      this.renderer.domElement.addEventListener(
        'pointerup',
        this.mouseUpListener,
        false
      );
      this.keyDownListener = this.onKeyDown.bind(this);
      // 暂时去掉键盘事件的监听
      // window.addEventListener('keydown', this.keyDownListener, false)
    }
  }

  removeEventHandlers() {
    if (this.useBuiltInControls) {
      this.renderer.domElement.removeEventListener(
        'pointermove',
        this.mouseMoveListener
      );
      this.mouseMoveListener = null;
      this.renderer.domElement.removeEventListener(
        'pointerdown',
        this.mouseDownListener
      );
      this.mouseDownListener = null;
      this.renderer.domElement.removeEventListener(
        'pointerup',
        this.mouseUpListener
      );
      this.mouseUpListener = null;
      window.removeEventListener('keydown', this.keyDownListener);
      this.keyDownListener = null;
    }
  }

  setRenderMode(renderMode) {
    this.renderMode = renderMode;
  }

  setActiveSphericalHarmonicsDegrees(activeSphericalHarmonicsDegrees) {
    this.splatMesh.material.uniforms.sphericalHarmonicsDegree.value =
      activeSphericalHarmonicsDegrees;
    this.splatMesh.material.uniformsNeedUpdate = true;
  }

  onSplatMeshChanged(callback) {
    this.onSplatMeshChangedCallback = callback;
  }

  tempForward = new THREE.Vector3()
  tempMatrixLeft = new THREE.Matrix4()
  tempMatrixRight = new THREE.Matrix4()
  onKeyDown = (e) => {
    this.tempForward.set(0, 0, -1);
    this.tempForward.transformDirection(this.camera.matrixWorld);
    this.tempMatrixLeft.makeRotationAxis(this.tempForward, Math.PI / 128);
    this.tempMatrixRight.makeRotationAxis(this.tempForward, -Math.PI / 128);
    switch (e.code) {
      case 'KeyG':
        this.focalAdjustment += 0.02;
        this.forceRenderNextFrame();
        break
      case 'KeyF':
        this.focalAdjustment -= 0.02;
        this.forceRenderNextFrame();
        break
      case 'ArrowLeft':
        this.camera.up.transformDirection(this.tempMatrixLeft);
        break
      case 'ArrowRight':
        this.camera.up.transformDirection(this.tempMatrixRight);
        break
      case 'KeyC':
        this.showMeshCursor = !this.showMeshCursor;
        break
      case 'KeyU':
        this.showControlPlane = !this.showControlPlane;
        break
      case 'KeyI':
        this.showInfo = !this.showInfo;
        if (this.showInfo) ;
        break
      case 'KeyO':
        if (!this.usingExternalCamera) {
          this.setOrthographicMode(!this.camera.isOrthographicCamera);
        }
        break
      case 'KeyP':
        if (!this.usingExternalCamera) {
          this.splatMesh.setPointCloudModeEnabled(
            !this.splatMesh.getPointCloudModeEnabled()
          );
        }
        break
      case 'Equal':
        if (!this.usingExternalCamera) {
          this.splatMesh.setSplatScale(this.splatMesh.getSplatScale() + 0.05);
        }
        break
      case 'Minus':
        if (!this.usingExternalCamera) {
          this.splatMesh.setSplatScale(
            Math.max(this.splatMesh.getSplatScale() - 0.05, 0.0)
          );
        }
        break
    }
  }

  onMouseMove(mouse) {
    this.mousePosition.set(mouse.offsetX, mouse.offsetY);
  }

  onMouseDown() {
    this.mouseDownPosition.copy(this.mousePosition);
    this.mouseDownTime = getCurrentTime();
  }

  onMouseUp = (function () {
    const clickOffset = new THREE.Vector2();

    return function (mouse) {
      clickOffset.copy(this.mousePosition).sub(this.mouseDownPosition);
      const mouseUpTime = getCurrentTime();
      const wasClick =
        mouseUpTime - this.mouseDownTime < 0.5 && clickOffset.length() < 2;
      if (wasClick) {
        this.onMouseClick(mouse);
      }
    }
  })()

  onMouseClick(mouse) {
    this.mousePosition.set(mouse.offsetX, mouse.offsetY);
    this.checkForFocalPointChange();
  }

  checkPointRenderDimensions = new THREE.Vector2()
  checkPointToNewFocalPoint = new THREE.Vector3()
  checkPointOutHits = []
  checkForFocalPointChange = () => {
    if (!this.transitioningCameraTarget) {
      this.getRenderDimensions(this.checkPointRenderDimensions);
      this.checkPointOutHits.length = 0;
      this.raycaster.setFromCameraAndScreenPosition(
        this.camera,
        this.mousePosition,
        this.checkPointRenderDimensions
      );
      this.raycaster.intersectSplatMesh(this.splatMesh, this.checkPointOutHits);
      if (this.checkPointOutHits.length > 0) {
        const hit = this.checkPointOutHits[0];
        const intersectionPoint = hit.origin;
        this.checkPointToNewFocalPoint
          .copy(intersectionPoint)
          .sub(this.camera.position);
        if (
          this.checkPointToNewFocalPoint.length() >
          MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT
        ) {
          this.previousCameraTarget.copy(this.controls.target);
          this.nextCameraTarget.copy(intersectionPoint);
          this.transitioningCameraTarget = true;
          this.transitioningCameraTargetStartTime = getCurrentTime();
        }
      }
    }
  }

  getRenderDimensions(outDimensions) {
    if (this.rootElement) {
      outDimensions.x = this.rootElement.offsetWidth;
      outDimensions.y = this.rootElement.offsetHeight;
    } else {
      this.renderer.getSize(outDimensions);
    }
  }

  setOrthographicMode(orthographicMode) {
    if (orthographicMode === this.camera.isOrthographicCamera) return
    const fromCamera = this.camera;
    const toCamera = orthographicMode
      ? this.orthographicCamera
      : this.perspectiveCamera;
    toCamera.position.copy(fromCamera.position);
    toCamera.up.copy(fromCamera.up);
    toCamera.rotation.copy(fromCamera.rotation);
    toCamera.quaternion.copy(fromCamera.quaternion);
    toCamera.matrix.copy(fromCamera.matrix);
    this.camera = toCamera;

    if (this.controls) {
      const resetControls = (controls) => {
        controls.saveState();
        controls.reset();
      };

      const fromControls = this.controls;
      const toControls = orthographicMode
        ? this.orthographicControls
        : this.perspectiveControls;

      resetControls(toControls);
      resetControls(fromControls);

      toControls.target.copy(fromControls.target);
      if (orthographicMode) {
        Viewer.setCameraZoomFromPosition(toCamera, fromCamera, fromControls);
      } else {
        Viewer.setCameraPositionFromZoom(toCamera, fromCamera, toControls);
      }
      this.controls = toControls;
      this.camera.lookAt(this.controls.target);
    }
  }

  static setCameraPositionFromZoom = (function () {
    const tempVector = new THREE.Vector3();

    return function (positionCamera, zoomedCamera, controls) {
      const toLookAtDistance = 1 / (zoomedCamera.zoom * 0.001);
      tempVector
        .copy(controls.target)
        .sub(positionCamera.position)
        .normalize()
        .multiplyScalar(toLookAtDistance)
        .negate();
      positionCamera.position.copy(controls.target).add(tempVector);
    }
  })()

  static setCameraZoomFromPosition = (function () {
    const tempVector = new THREE.Vector3();

    return function (zoomCamera, positionZamera, controls) {
      const toLookAtDistance = tempVector
        .copy(controls.target)
        .sub(positionZamera.position)
        .length();
      zoomCamera.zoom = 1 / (toLookAtDistance * 0.001);
    }
  })()

  updateSplatMesh = (function () {
    const renderDimensions = new THREE.Vector2();

    return function () {
      if (!this.splatMesh) return
      const splatCount = this.splatMesh.getSplatCount();
      if (splatCount > 0) {
        this.splatMesh.updateVisibleRegionFadeDistance(this.sceneRevealMode);
        this.splatMesh.updateTransforms();
        this.getRenderDimensions(renderDimensions);
        const focalLengthX =
          this.camera.projectionMatrix.elements[0] *
          0.5 *
          this.devicePixelRatio *
          renderDimensions.x;
        const focalLengthY =
          this.camera.projectionMatrix.elements[5] *
          0.5 *
          this.devicePixelRatio *
          renderDimensions.y;

        const focalMultiplier = this.camera.isOrthographicCamera
          ? 1.0 / this.devicePixelRatio
          : 1.0;
        const focalAdjustment = this.focalAdjustment * focalMultiplier;
        const inverseFocalAdjustment = 1.0 / focalAdjustment;

        this.adjustForWebXRStereo(renderDimensions);
        this.splatMesh.updateUniforms(
          renderDimensions,
          focalLengthX * focalAdjustment,
          focalLengthY * focalAdjustment,
          this.camera.isOrthographicCamera,
          this.camera.zoom || 1.0,
          inverseFocalAdjustment
        );
      }
    }
  })()

  adjustForWebXRStereo(renderDimensions) {
    // TODO: Figure out a less hacky way to determine if stereo rendering is active
    if (this.camera && this.webXRActive) {
      const xrCamera = this.renderer.xr.getCamera();
      const xrCameraProj00 = xrCamera.projectionMatrix.elements[0];
      const cameraProj00 = this.camera.projectionMatrix.elements[0];
      renderDimensions.x *= cameraProj00 / xrCameraProj00;
    }
  }

  isLoadingOrUnloading() {
    return (
      Object.keys(this.splatSceneDownloadPromises).length > 0 ||
      this.splatSceneDownloadAndBuildPromise !== null ||
      this.splatSceneRemovalPromise !== null
    )
  }

  isDisposingOrDisposed() {
    return this.disposing || this.disposed
  }

  addSplatSceneDownloadController(controller) {
    this.splatSceneDownloadControllers.push(controller);
  }

  removeSplatSceneDownloadController(controller) {
    const index = this.splatSceneDownloadControllers.indexOf(controller);
    if (index > -1) {
        this.splatSceneDownloadControllers.splice(index, 1);
    }
  }

  addSplatSceneDownloadPromise(promise) {
    this.splatSceneDownloadPromises[promise.id] = promise;
  }

  removeSplatSceneDownloadPromise(promise) {
    delete this.splatSceneDownloadPromises[promise.id];
  }

  setSplatSceneDownloadAndBuildPromise(promise) {
    this.splatSceneDownloadAndBuildPromise = promise;
  }

  clearSplatSceneDownloadAndBuildPromise() {
    this.splatSceneDownloadAndBuildPromise = null;
  }

  /**
   * Add a splat scene to the viewer and display any loading UI if appropriate.
   * @param {string} path Path to splat scene to be loaded
   * @param {object} options {
   *
   *         splatAlphaRemovalThreshold: Ignore any splats with an alpha less than the specified
   *                                     value (valid range: 0 - 255), defaults to 1
   *
   *         showLoadingUI:         Display a loading spinner while the scene is loading, defaults to true
   *
   *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
   *
   *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
   *
   *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
   *
   *         onProgress:                 Function to be called as file data are received, or other processing occurs
   *
   *         headers:                    Optional HTTP headers to be sent along with splat requests
   * }
   * @return {Promise}
   */
  addSplatScene(path, options = {}) {
    if (this.isLoadingOrUnloading()) {
      throw new Error(
        'Cannot add splat scene while another load or unload is already in progress.'
      )
    }

    if (this.isDisposingOrDisposed()) {
      throw new Error('Cannot add splat scene after dispose() is called.')
    }

    if (
      options.progressiveLoad &&
      this.splatMesh.scenes &&
      this.splatMesh.scenes.length > 0
    ) {
      console.log(
        'addSplatScene(): "progressiveLoad" option ignore because there are multiple splat scenes'
      );
      options.progressiveLoad = false;
    }

    const format =
      options.format !== undefined && options.format !== null
        ? options.format
        : sceneFormatFromPath(path);
    const progressiveLoad =
      Viewer.isProgressivelyLoadable(format) && options.progressiveLoad;
    const showLoadingUI =
      options.showLoadingUI !== undefined && options.showLoadingUI !== null
        ? options.showLoadingUI
        : true;

    let loadingUITaskId = null;
    if (showLoadingUI) {
      this.loadingSpinner.removeAllTasks();
      loadingUITaskId = this.loadingSpinner.addTask('Downloading...');
    }
    const hideLoadingUI = () => {
      this.loadingProgressBar.hide();
      this.loadingSpinner.removeAllTasks();
    };

    const onProgressUIUpdate = (
      percentComplete,
      percentCompleteLabel,
      loaderStatus
    ) => {
      if (showLoadingUI) {
        if (loaderStatus === LoaderStatus.Downloading) {
          if (percentComplete == 100) {
            this.loadingSpinner.setMessageForTask(
              loadingUITaskId,
              'Download complete!'
            );
          } else {
            if (progressiveLoad) {
              this.loadingSpinner.setMessageForTask(
                loadingUITaskId,
                'Downloading splats...'
              );
            } else {
              const suffix = percentCompleteLabel
                ? `: ${percentCompleteLabel}`
                : `...`;
              this.loadingSpinner.setMessageForTask(
                loadingUITaskId,
                `Downloading${suffix}`
              );
            }
          }
        } else if (loaderStatus === LoaderStatus.Processing) {
          console.log('loaderStatus === LoaderStatus.Processing');
          this.loadingSpinner.setMessageForTask(
            loadingUITaskId,
            'Processing splats...'
          );
        }
      }
    };

    let downloadDone = false;
    let downloadedPercentage = 0;
    const splatBuffersAddedUIUpdate = (firstBuild, finalBuild) => {
      if (showLoadingUI) {
        if (
          (firstBuild && progressiveLoad) ||
          (finalBuild && !progressiveLoad)
        ) {
          this.loadingSpinner.removeTask(loadingUITaskId);
          if (!finalBuild && !downloadDone) this.loadingProgressBar.show();
        }
        if (progressiveLoad) {
          if (finalBuild) {
            downloadDone = true;
            this.loadingProgressBar.hide();
          } else {
            this.loadingProgressBar.setProgress(downloadedPercentage);
          }
        }
      }
    };

    const onProgress = (
      percentComplete,
      percentCompleteLabel,
      loaderStatus
    ) => {
      downloadedPercentage = percentComplete;
      onProgressUIUpdate(percentComplete, percentCompleteLabel, loaderStatus);
      if (options.onProgress)
        options.onProgress(percentComplete, percentCompleteLabel, loaderStatus);
    };

    const buildSection = (splatBuffer, firstBuild, finalBuild) => {
      if (!progressiveLoad && options.onProgress)
        options.onProgress(0, '0%', LoaderStatus.Processing);
      const addSplatBufferOptions = {
        rotation: options.rotation || options.orientation,
        position: options.position,
        scale: options.scale,
        splatAlphaRemovalThreshold: options.splatAlphaRemovalThreshold
      };
      return this.addSplatBuffers(
        [splatBuffer],
        [addSplatBufferOptions],
        finalBuild,
        firstBuild && showLoadingUI,
        showLoadingUI,
        progressiveLoad,
        progressiveLoad
      ).then(() => {
        if (!progressiveLoad && options.onProgress)
          options.onProgress(100, '100%', LoaderStatus.Processing);
        splatBuffersAddedUIUpdate(firstBuild, finalBuild);
      })
    };

    const loadFunc = progressiveLoad
      ? this.downloadAndBuildSingleSplatSceneProgressiveLoad.bind(this)
      : this.downloadAndBuildSingleSplatSceneStandardLoad.bind(this);
    return loadFunc(
      path,
      format,
      options.splatAlphaRemovalThreshold,
      buildSection.bind(this),
      onProgress,
      hideLoadingUI.bind(this),
      options.headers
    )
  }

  /**
   * Download a single splat scene, convert to splat buffer and then rebuild the viewer's splat mesh
   * by calling 'buildFunc' -- all before displaying the scene. Also sets/clears relevant instance synchronization objects,
   * and calls appropriate functions on success or failure.
   * @param {string} path Path to splat scene to be loaded
   * @param {SceneFormat} format Format of the splat scene file
   * @param {number} splatAlphaRemovalThreshold Ignore any splats with an alpha less than the specified value (valid range: 0 - 255)
   * @param {function} buildFunc Function to build the viewer's splat mesh with the downloaded splat buffer
   * @param {function} onProgress Function to be called as file data are received, or other processing occurs
   * @param {function} onException Function to be called when exception occurs
   * @param {object} headers Optional HTTP headers to pass to use for downloading splat scene
   * @return {Promise}
   */
  downloadAndBuildSingleSplatSceneStandardLoad(
    path,
    format,
    splatAlphaRemovalThreshold,
    buildFunc,
    onProgress,
    onException,
    headers
  ) {
    const downloadPromise = this.downloadSplatSceneToSplatBuffer(
      path,
      splatAlphaRemovalThreshold,
      onProgress,
      false,
      undefined,
      format,
      headers
    );

    // Create a promise that can be resolved/rejected externally, with abort capability
    const downloadAndBuildPromise = abortablePromiseWithExtractedComponents(
      downloadPromise.abort ? downloadPromise.abort.bind(downloadPromise) : undefined
    );

    downloadPromise
      .then((splatBuffer) => {
        this.removeSplatSceneDownloadPromise(downloadPromise);
        return buildFunc(splatBuffer, true, true).then(() => {
          downloadAndBuildPromise.resolve();
          this.clearSplatSceneDownloadAndBuildPromise();
        })
      })
      .catch((e) => {
        if (onException) onException();
        this.clearSplatSceneDownloadAndBuildPromise();
        this.removeSplatSceneDownloadPromise(downloadPromise);
        const error =
          (e instanceof AbortedPromiseError || e.name === 'AbortError')
            ? e
            : new Error(`Viewer::addSplatScene -> Could not load file ${path}`);
        downloadAndBuildPromise.reject(error);
      });

    this.addSplatSceneDownloadPromise(downloadPromise);
    this.setSplatSceneDownloadAndBuildPromise(downloadAndBuildPromise.promise);

    return downloadAndBuildPromise.promise
  }

  /**
   * Download a single splat scene and convert to splat buffer in a progressive manner, allowing rendering as the file downloads.
   * As each section is downloaded, the viewer's splat mesh is rebuilt by calling 'buildFunc'
   * Also sets/clears relevant instance synchronization objects, and calls appropriate functions on success or failure.
   * @param {string} path Path to splat scene to be loaded
   * @param {SceneFormat} format Format of the splat scene file
   * @param {number} splatAlphaRemovalThreshold Ignore any splats with an alpha less than the specified value (valid range: 0 - 255)
   * @param {function} buildFunc Function to rebuild the viewer's splat mesh after a new splat buffer section is downloaded
   * @param {function} onDownloadProgress Function to be called as file data are received
   * @param {function} onDownloadException Function to be called when exception occurs at any point during the full download
   * @param {object} headers Optional HTTP headers to pass to use for downloading splat scene
   * @return {Promise}
   */
  downloadAndBuildSingleSplatSceneProgressiveLoad(
    path,
    format,
    splatAlphaRemovalThreshold,
    buildFunc,
    onDownloadProgress,
    onDownloadException,
    headers
  ) {
    let progressiveLoadedSectionBuildCount = 0;
    let progressiveLoadedSectionBuilding = false;
    const queuedProgressiveLoadSectionBuilds = [];

    const checkAndBuildProgressiveLoadSections = () => {
      if (
        queuedProgressiveLoadSectionBuilds.length > 0 &&
        !progressiveLoadedSectionBuilding &&
        !this.isDisposingOrDisposed()
      ) {
        progressiveLoadedSectionBuilding = true;
        const queuedBuild = queuedProgressiveLoadSectionBuilds.shift();
        buildFunc(
          queuedBuild.splatBuffer,
          queuedBuild.firstBuild,
          queuedBuild.finalBuild
        ).then(() => {
          progressiveLoadedSectionBuilding = false;
          if (queuedBuild.firstBuild) {
            progressiveLoadFirstSectionBuildPromise.resolve();
          } else if (queuedBuild.finalBuild) {
            splatSceneDownloadAndBuildPromise.resolve();
            this.clearSplatSceneDownloadAndBuildPromise();
          }
          if (queuedProgressiveLoadSectionBuilds.length > 0) {
            delayedExecute(() => checkAndBuildProgressiveLoadSections());
          }
        });
      }
    };

    const onProgressiveLoadSectionProgress = (splatBuffer, finalBuild) => {
      if (!this.isDisposingOrDisposed()) {
        if (
          finalBuild ||
          queuedProgressiveLoadSectionBuilds.length === 0 ||
          splatBuffer.getSplatCount() >
            queuedProgressiveLoadSectionBuilds[0].splatBuffer.getSplatCount()
        ) {
          queuedProgressiveLoadSectionBuilds.push({
            splatBuffer,
            firstBuild: progressiveLoadedSectionBuildCount === 0,
            finalBuild
          });
          progressiveLoadedSectionBuildCount++;
          checkAndBuildProgressiveLoadSections();
        }
      }
    };

    const splatSceneDownloadPromise = this.downloadSplatSceneToSplatBuffer(
      path,
      splatAlphaRemovalThreshold,
      onDownloadProgress,
      true,
      onProgressiveLoadSectionProgress,
      format,
      headers
    );

    // Get abort handler from download promise
    const abortHandler = splatSceneDownloadPromise.abort 
      ? splatSceneDownloadPromise.abort.bind(splatSceneDownloadPromise) 
      : undefined;

    const progressiveLoadFirstSectionBuildPromise =
      abortablePromiseWithExtractedComponents(abortHandler);

    const splatSceneDownloadAndBuildPromise =
      abortablePromiseWithExtractedComponents(abortHandler);

    this.addSplatSceneDownloadPromise(splatSceneDownloadPromise);
    this.setSplatSceneDownloadAndBuildPromise(
      splatSceneDownloadAndBuildPromise.promise
    );

    splatSceneDownloadPromise
      .then(() => {
        this.removeSplatSceneDownloadPromise(splatSceneDownloadPromise);
      })
      .catch((e) => {
        console.error('Viewer::addSplatScene actual error:', e);
        this.clearSplatSceneDownloadAndBuildPromise();
        this.removeSplatSceneDownloadPromise(splatSceneDownloadPromise);
        const error =
          (e instanceof AbortedPromiseError || e.name === 'AbortError')
            ? e
            : new Error(
                `Viewer::addSplatScene -> Could not load one or more scenes: ${e.message}`
              );
        progressiveLoadFirstSectionBuildPromise.reject(error);
        if (onDownloadException) onDownloadException(error);
      });

    return progressiveLoadFirstSectionBuildPromise.promise
  }

  /**
   * Add multiple splat scenes to the viewer and display any loading UI if appropriate.
   * @param {Array<object>} sceneOptions Array of per-scene options: {
   *
   *         path: Path to splat scene to be loaded
   *
   *         splatAlphaRemovalThreshold: Ignore any splats with an alpha less than the specified
   *                                     value (valid range: 0 - 255), defaults to 1
   *
   *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
   *
   *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
   *
   *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
   *
   *         headers:                    Optional HTTP headers to be sent along with splat requests
   *
   *         format (SceneFormat)        Optional, the format of the scene data (.ply, .ksplat, .splat). If not present, the
   *                                     file extension in 'path' will be used to determine the format (if it is present)
   * }
   * @param {boolean} showLoadingUI Display a loading spinner while the scene is loading, defaults to true
   * @param {function} onProgress Function to be called as file data are received
   * @return {Promise}
   */
  addSplatScenes(sceneOptions, showLoadingUI = true, onProgress = undefined) {
    if (this.isLoadingOrUnloading()) {
      throw new Error(
        'Cannot add splat scene while another load or unload is already in progress.'
      )
    }

    if (this.isDisposingOrDisposed()) {
      throw new Error('Cannot add splat scene after dispose() is called.')
    }

    const fileCount = sceneOptions.length;
    const percentComplete = [];

    let loadingUITaskId;
    if (showLoadingUI) {
      this.loadingSpinner.removeAllTasks();
      loadingUITaskId = this.loadingSpinner.addTask('Downloading...');
    }

    const onLoadProgress = (fileIndex, percent, percentLabel, loaderStatus) => {
      percentComplete[fileIndex] = percent;
      let totalPercent = 0;
      for (let i = 0; i < fileCount; i++)
        totalPercent += percentComplete[i] || 0;
      totalPercent = totalPercent / fileCount;
      percentLabel = `${totalPercent.toFixed(2)}%`;
      if (showLoadingUI) {
        if (loaderStatus === LoaderStatus.Downloading) {
          this.loadingSpinner.setMessageForTask(
            loadingUITaskId,
            totalPercent == 100
              ? `Download complete!`
              : `Downloading: ${percentLabel}`
          );
        }
      }
      if (onProgress) onProgress(totalPercent, percentLabel, loaderStatus);
    };

    const abortController = new AbortController();
    const signal = abortController.signal;
    this.addSplatSceneDownloadController(abortController);

    const downloadPromises = [];
    for (let i = 0; i < sceneOptions.length; i++) {
      const options = sceneOptions[i];
      const format =
        options.format !== undefined && options.format !== null
          ? options.format
          : sceneFormatFromPath(options.path);
      const downloadPromise = this.downloadSplatSceneToSplatBuffer(
        options.path,
        options.splatAlphaRemovalThreshold,
        onLoadProgress.bind(this, i),
        false,
        undefined,
        format,
        options.headers,
        signal
      );
      downloadPromises.push(downloadPromise);
    }

    const downloadAndBuildPromise = Promise.all(downloadPromises)
      .then((splatBuffers) => {
        if (showLoadingUI) this.loadingSpinner.removeTask(loadingUITaskId);
        if (onProgress) onProgress(0, '0%', LoaderStatus.Processing);
        return this.addSplatBuffers(
          splatBuffers,
          sceneOptions,
          true,
          showLoadingUI,
          showLoadingUI,
          false,
          false
        ).then(() => {
          if (onProgress) onProgress(100, '100%', LoaderStatus.Processing);
          this.clearSplatSceneDownloadAndBuildPromise();
        });
      })
      .catch((e) => {
        if (showLoadingUI) this.loadingSpinner.removeTask(loadingUITaskId);
        this.clearSplatSceneDownloadAndBuildPromise();
        const error =
          e.name === 'AbortError'
            ? e
            : new Error(
                `Viewer::addSplatScenes -> Could not load one or more splat scenes.`
              );
        throw error;
      })
      .finally(() => {
        this.removeSplatSceneDownloadController(abortController);
      });

    this.setSplatSceneDownloadAndBuildPromise(downloadAndBuildPromise);
    return downloadAndBuildPromise
  }

  /**
   * Download a splat scene and convert to SplatBuffer instance.
   * @param {string} path Path to splat scene to be loaded
   * @param {number} splatAlphaRemovalThreshold Ignore any splats with an alpha less than the specified
   *                                            value (valid range: 0 - 255), defaults to 1
   *
   * @param {function} onProgress Function to be called as file data are received
   * @param {boolean} progressiveBuild Construct file sections into splat buffers as they are downloaded
   * @param {function} onSectionBuilt Function to be called when new section is added to the file
   * @param {string} format File format of the scene
   * @param {object} headers Optional HTTP headers to pass to use for downloading splat scene
   * @param {AbortSignal} signal Optional AbortSignal to cancel the download
   * @return {AbortablePromise}
   */
  downloadSplatSceneToSplatBuffer(
    path,
    splatAlphaRemovalThreshold = 1,
    onProgress = undefined,
    progressiveBuild = false,
    onSectionBuilt = undefined,
    format,
    headers
  ) {
    const optimizeSplatData = progressiveBuild ? false : this.optimizeSplatData;
    try {
      if (format === SceneFormat.Ply) {
        return PlyLoader.loadFromURL(
          path,
          onProgress,
          progressiveBuild,
          onSectionBuilt,
          splatAlphaRemovalThreshold,
          this.inMemoryCompressionLevel,
          optimizeSplatData,
          this.sphericalHarmonicsDegree,
          headers
        )
      }
    } catch (e) {
      if (e instanceof DirectLoadError) {
        throw new Error(
          'File type or server does not support progressive loading.'
        )
      } else {
        throw e
      }
    }

    throw new Error(
      `Viewer::downloadSplatSceneToSplatBuffer -> File format not supported: ${path}`
    )
  }

  static isProgressivelyLoadable(format) {
    return format === SceneFormat.Ply
  }

  /**
   * Add one or more instances of SplatBuffer to the SplatMesh instance managed by the viewer and set up the sorting web worker.
   * This function will terminate the existing sort worker (if there is one).
   */
  addSplatBuffers = (
    splatBuffers,
    splatBufferOptions = [],
    finalBuild = true,
    showLoadingUI = true,
    showLoadingUIForSplatTreeBuild = true,
    replaceExisting = false,
    enableRenderBeforeFirstSort = false,
    preserveVisibleRegion = true
  ) => {
    if (this.isDisposingOrDisposed()) return Promise.resolve()

    let splatProcessingTaskId = null;
    const removeSplatProcessingTask = () => {
      if (splatProcessingTaskId !== null) {
        this.loadingSpinner.removeTask(splatProcessingTaskId);
        splatProcessingTaskId = null;
      }
    };

    this.splatRenderReady = false;
    return new Promise((resolve) => {
      if (showLoadingUI) {
        splatProcessingTaskId = this.loadingSpinner.addTask(
          'Processing splats...'
        );
      }
      delayedExecute(() => {
        if (this.isDisposingOrDisposed()) {
          resolve();
        } else {
          const buildResults = this.addSplatBuffersToMesh(
            splatBuffers,
            splatBufferOptions,
            finalBuild,
            showLoadingUIForSplatTreeBuild,
            replaceExisting,
            preserveVisibleRegion
          );

          const maxSplatCount = this.splatMesh.getMaxSplatCount();
          if (
            this.sortWorker &&
            this.sortWorker.maxSplatCount !== maxSplatCount
          )
            this.disposeSortWorker();
          // If we aren't calculating the splat distances from the center on the GPU, the sorting worker needs
          // splat centers and transform indexes so that it can calculate those distance values.
          if (!this.gpuAcceleratedSort) {
            this.preSortMessages.push({
              centers: buildResults.centers.buffer,
              sceneIndexes: buildResults.sceneIndexes.buffer,
              range: {
                from: buildResults.from,
                to: buildResults.to,
                count: buildResults.count
              }
            });
          }
          const sortWorkerSetupPromise =
            !this.sortWorker && maxSplatCount > 0
              ? this.setupSortWorker(this.splatMesh)
              : Promise.resolve();
          sortWorkerSetupPromise.then(() => {
            if (this.isDisposingOrDisposed()) return
            this.runSplatSort(true, true).then((sortRunning) => {
              if (!this.sortWorker || !sortRunning) {
                this.splatRenderReady = true;
                removeSplatProcessingTask();
                resolve();
              } else {
                if (enableRenderBeforeFirstSort) {
                  this.splatRenderReady = true;
                } else {
                  this.runAfterNextSort.push(() => {
                    this.splatRenderReady = true;
                  });
                }
                this.runAfterNextSort.push(() => {
                  removeSplatProcessingTask();
                  resolve();
                });
              }
            });
          });
        }
      }, true);
    })
  }

  /**
   * Add one or more instances of SplatBuffer to the SplatMesh instance managed by the viewer. By default, this function is additive;
   * all splat buffers contained by the viewer's splat mesh before calling this function will be preserved. This behavior can be
   * changed by passing 'true' for 'replaceExisting'.
   * @param {Array<SplatBuffer>} splatBuffers SplatBuffer instances
   * @param {Array<object>} splatBufferOptions Array of options objects: {
   *
   *         splatAlphaRemovalThreshold: Ignore any splats with an alpha less than the specified
   *                                     value (valid range: 0 - 255), defaults to 1
   *
   *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
   *
   *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
   *
   *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
   * }
   * @param {boolean} finalBuild Will the splat mesh be in its final state after this build?
   * @param {boolean} showLoadingUIForSplatTreeBuild Whether or not to show the loading spinner during construction of the splat tree.
   * @return {object} Object containing info about the splats that are updated
   */
  addSplatBuffersToMesh = (function () {
    let splatOptimizingTaskId;

    return function (
      splatBuffers,
      splatBufferOptions,
      finalBuild = true,
      showLoadingUIForSplatTreeBuild = false,
      replaceExisting = false,
      preserveVisibleRegion = true
    ) {
      if (this.isDisposingOrDisposed()) return
      let allSplatBuffers = [];
      let allSplatBufferOptions = [];
      if (!replaceExisting) {
        allSplatBuffers =
          this.splatMesh.scenes.map((scene) => scene.splatBuffer) || [];
        allSplatBufferOptions = this.splatMesh.sceneOptions
          ? this.splatMesh.sceneOptions.map((sceneOptions) => sceneOptions)
          : [];
      }
      allSplatBuffers.push(...splatBuffers);
      allSplatBufferOptions.push(...splatBufferOptions);
      if (this.renderer) this.splatMesh.setRenderer(this.renderer);
      const onSplatTreeIndexesUpload = (finished) => {
        if (this.isDisposingOrDisposed()) return
        const splatCount = this.splatMesh.getSplatCount();
        if (
          showLoadingUIForSplatTreeBuild &&
          splatCount >= MIN_SPLAT_COUNT_TO_SHOW_SPLAT_TREE_LOADING_SPINNER
        ) {
          if (!finished && !splatOptimizingTaskId) {
            this.loadingSpinner.setMinimized(true, true);
            splatOptimizingTaskId = this.loadingSpinner.addTask(
              'Optimizing data structures...'
            );
          }
        }
      };
      const onSplatTreeReady = (finished) => {
        if (this.isDisposingOrDisposed()) return
        if (finished && splatOptimizingTaskId) {
          this.loadingSpinner.removeTask(splatOptimizingTaskId);
          splatOptimizingTaskId = null;
        }
      };
      const buildResults = this.splatMesh.build(
        allSplatBuffers,
        allSplatBufferOptions,
        true,
        finalBuild,
        onSplatTreeIndexesUpload,
        onSplatTreeReady,
        preserveVisibleRegion
      );
      if (finalBuild && this.freeIntermediateSplatData)
        this.splatMesh.freeIntermediateSplatData();
      return buildResults
    }
  })()

  /**
   * Set up the splat sorting web worker.
   * @param {SplatMesh} splatMesh SplatMesh instance that contains the splats to be sorted
   * @return {Promise}
   */
  async setupSortWorker(splatMesh) {
    if (this.isDisposingOrDisposed()) return
    const DistancesArrayType = this.integerBasedSort
      ? Int32Array
      : Float32Array;
    const splatCount = splatMesh.getSplatCount();
    const maxSplatCount = splatMesh.getMaxSplatCount();
    this.sortWorker = await createSortWorker(
      maxSplatCount,
      this.sharedMemoryForWorkers,
      this.enableSIMDInSort,
      this.integerBasedSort,
      this.splatMesh.dynamicMode,
      this.splatSortDistanceMapPrecision
    );
    return new Promise((resolve) => {
      this.sortWorker.onmessage = (e) => {
        if (e.data.sortDone) {
          this.sortRunning = false;
          Array.from(
            { length: this.gaussianSplatCount },
            (_, i) => i
          );
          if (this.sharedMemoryForWorkers) {
            this.splatMesh.updateRenderIndexes(
              this.sortWorkerSortedIndexes,
              e.data.splatRenderCount
            );
          } else {
            const sortedIndexes = new Uint32Array(
              e.data.sortedIndexes.buffer,
              0,
              e.data.splatRenderCount
            );
            // console.log(sortedIndexes);
            this.splatMesh.updateRenderIndexes(
              sortedIndexes,
              e.data.splatRenderCount
            );
          }

          this.lastSplatSortCount = this.splatSortCount;

          this.lastSortTime = e.data.sortTime;
          this.sortPromiseResolver();
          this.sortPromiseResolver = null;
          this.forceRenderNextFrame();
          if (this.runAfterNextSort.length > 0) {
            this.runAfterNextSort.forEach((func) => {
              func();
            });
            this.runAfterNextSort.length = 0;
          }
        } else if (e.data.sortCanceled) {
          this.sortRunning = false;
        } else if (e.data.sortSetupPhase1Complete) {
          if (this.logLevel >= LogLevel.Info)
            console.log('Sorting web worker WASM setup complete.');
          if (this.sharedMemoryForWorkers) {
            this.sortWorkerSortedIndexes = new Uint32Array(
              e.data.sortedIndexesBuffer,
              e.data.sortedIndexesOffset,
              maxSplatCount
            );
            this.sortWorkerIndexesToSort = new Uint32Array(
              e.data.indexesToSortBuffer,
              e.data.indexesToSortOffset,
              maxSplatCount
            );
            this.sortWorkerPrecomputedDistances = new DistancesArrayType(
              e.data.precomputedDistancesBuffer,
              e.data.precomputedDistancesOffset,
              maxSplatCount
            );
            this.sortWorkerTransforms = new Float32Array(
              e.data.transformsBuffer,
              e.data.transformsOffset,
              Constants$1.MaxScenes * 16
            );
          } else {
            this.sortWorkerIndexesToSort = new Uint32Array(maxSplatCount);
            this.sortWorkerPrecomputedDistances = new DistancesArrayType(
              maxSplatCount
            );
            this.sortWorkerTransforms = new Float32Array(
              Constants$1.MaxScenes * 16
            );
          }
          for (let i = 0; i < splatCount; i++)
            this.sortWorkerIndexesToSort[i] = i;
          this.sortWorker.maxSplatCount = maxSplatCount;

          if (this.logLevel >= LogLevel.Info) {
            console.log('Sorting web worker ready.');
            const splatDataTextures = this.splatMesh.getSplatDataTextures();
            const covariancesTextureSize = splatDataTextures.covariances.size;
            const centersColorsTextureSize = splatDataTextures.centerColors.size;
            console.log(
              'Covariances texture size: ' +
                covariancesTextureSize.x +
                ' x ' +
                covariancesTextureSize.y
            );
            console.log(
              'Centers/colors texture size: ' +
                centersColorsTextureSize.x +
                ' x ' +
                centersColorsTextureSize.y
            );
          }

          resolve();
        }
      };
    })
  }

  disposeSortWorker() {
    if (this.sortWorker) this.sortWorker.terminate();
    this.sortWorker = null;
    this.sortPromise = null;
    if (this.sortPromiseResolver) {
      this.sortPromiseResolver();
      this.sortPromiseResolver = null;
    }
    this.preSortMessages = [];
    this.sortRunning = false;
  }

  removeSplatScene(indexToRemove, showLoadingUI = true) {
    return this.removeSplatScenes([indexToRemove], showLoadingUI)
  }

  removeSplatScenes(indexesToRemove, showLoadingUI = true) {
    if (this.isLoadingOrUnloading()) {
      throw new Error(
        'Cannot remove splat scene while another load or unload is already in progress.'
      )
    }

    if (this.isDisposingOrDisposed()) {
      throw new Error('Cannot remove splat scene after dispose() is called.')
    }

    let sortPromise;

    this.splatSceneRemovalPromise = new Promise((resolve, reject) => {
      let revmovalTaskId;

      if (showLoadingUI) {
        this.loadingSpinner.removeAllTasks();
        this.loadingSpinner.show();
        revmovalTaskId = this.loadingSpinner.addTask('Removing splat scene...');
      }

      const checkAndHideLoadingUI = () => {
        if (showLoadingUI) {
          this.loadingSpinner.hide();
          this.loadingSpinner.removeTask(revmovalTaskId);
        }
      };

      const onDone = (error) => {
        checkAndHideLoadingUI();
        this.splatSceneRemovalPromise = null;
        if (!error) resolve();
        else reject(error);
      };

      const checkForEarlyExit = () => {
        if (this.isDisposingOrDisposed()) {
          onDone();
          return true
        }
        return false
      };

      sortPromise = this.sortPromise || Promise.resolve();
      sortPromise.then(() => {
        if (checkForEarlyExit()) return
        const savedSplatBuffers = [];
        const savedSceneOptions = [];
        const savedSceneTransformComponents = [];
        for (let i = 0; i < this.splatMesh.scenes.length; i++) {
          let shouldRemove = false;
          for (let indexToRemove of indexesToRemove) {
            if (indexToRemove === i) {
              shouldRemove = true;
              break
            }
          }
          if (!shouldRemove) {
            const scene = this.splatMesh.scenes[i];
            savedSplatBuffers.push(scene.splatBuffer);
            savedSceneOptions.push(this.splatMesh.sceneOptions[i]);
            savedSceneTransformComponents.push({
              position: scene.position.clone(),
              quaternion: scene.quaternion.clone(),
              scale: scene.scale.clone()
            });
          }
        }
        this.disposeSortWorker();
        this.splatMesh.dispose();
        this.sceneRevealMode = SceneRevealMode.Instant;
        this.createSplatMesh();
        this.addSplatBuffers(
          savedSplatBuffers,
          savedSceneOptions,
          true,
          false,
          true
        )
          .then(() => {
            if (checkForEarlyExit()) return
            checkAndHideLoadingUI();
            this.splatMesh.scenes.forEach((scene, index) => {
              scene.position.copy(savedSceneTransformComponents[index].position);
              scene.quaternion.copy(
                savedSceneTransformComponents[index].quaternion
              );
              scene.scale.copy(savedSceneTransformComponents[index].scale);
            });
            this.splatMesh.updateTransforms();
            this.splatRenderReady = false;

            this.runSplatSort(true).then(() => {
              if (checkForEarlyExit()) {
                this.splatRenderReady = true;
                return
              }
              sortPromise = this.sortPromise || Promise.resolve();
              sortPromise.then(() => {
                this.splatRenderReady = true;
                onDone();
              });
            });
          })
          .catch((e) => {
            onDone(e);
          });
      });
    });

    return this.splatSceneRemovalPromise
  }

  /**
   * Start self-driven mode
   */
  start() {
    if (this.selfDrivenMode) {
      this.requestFrameId = requestAnimationFrame(this.selfDrivenUpdateFunc);
      this.selfDrivenModeRunning = true;
    } else {
      throw new Error('Cannot start viewer unless it is in self driven mode.')
    }
  }

  /**
   * Stop self-driven mode
   */
  stop() {
    if (this.selfDrivenMode && this.selfDrivenModeRunning) {
      cancelAnimationFrame(this.requestFrameId);
      this.selfDrivenModeRunning = false;
    }
  }

  /**
   * Dispose of all resources held directly and indirectly by this viewer.
   */
  async dispose() {
    if (this.isDisposingOrDisposed()) return this.disposePromise

    for (let controller of this.splatSceneDownloadControllers) {
        controller.abort();
    }

    let waitPromises = [];
    if (this.sortPromise) {
      waitPromises.push(this.sortPromise);
    }

    this.disposing = true;
    this.disposePromise = Promise.all(waitPromises).finally(() => {
      this.stop();
      if (this.orthographicControls) {
        this.orthographicControls.dispose();
        this.orthographicControls = null;
      }
      if (this.perspectiveControls) {
        this.perspectiveControls.dispose();
        this.perspectiveControls = null;
      }
      this.controls = null;
      if (this.splatMesh) {
        this.splatMesh.dispose();
        this.splatMesh = null;
      }
      if (this.avatarMesh) {
        disposeAllMeshes(this.avatarMesh);
        this.avatarMesh = null;
      }
      if (this.sceneHelper) {
        this.sceneHelper.dispose();
        this.sceneHelper = null;
      }
      if (this.resizeObserver) {
        this.resizeObserver.unobserve(this.rootElement);
        this.resizeObserver = null;
      }
      this.disposeSortWorker();
      this.removeEventHandlers();

      this.loadingSpinner.removeAllTasks();
      this.loadingSpinner.setContainer(null);
      this.loadingProgressBar.hide();
      this.loadingProgressBar.setContainer(null);
      // this.infoPanel.setContainer(null)

      this.camera = null;
      this.threeScene = null;
      this.splatRenderReady = false;
      this.initialized = false;
      if (this.renderer) {
        if (!this.usingExternalRenderer) {
          this.rootElement.removeChild(this.renderer.domElement);
          this.renderer.dispose();
        }
        this.renderer = null;
      }

      if (!this.usingExternalRenderer) ;

      this.sortWorkerSortedIndexes = null;
      this.sortWorkerIndexesToSort = null;
      this.sortWorkerPrecomputedDistances = null;
      this.sortWorkerTransforms = null;
      this.disposed = true;
      this.disposing = false;
      this.disposePromise = null;
    });
    return this.disposePromise
  }
  vsyncNum = 4
  selfDrivenUpdate() {
    if (this.selfDrivenMode) {
        this.requestFrameId = requestAnimationFrame(this.selfDrivenUpdateFunc);

        // const currentTime = getCurrentTime();
        // const calcDelta = currentTime - this.lastTime;
        // if (calcDelta >= 1.0 / 30.0) {
        //     this.lastTime = currentTime;
        // } else {
        //     return
        // }
    }
    this.vsyncCount++;

    if (this.vsyncCount < this.vsyncNum) {
      return
    }

    this.vsyncCount = 0;

    this.update();
    if (this.shouldRender()) {
      //add expression

      this.render();
      this.consecutiveRenderFrames++;
    } else {
      this.consecutiveRenderFrames = 0;
    }
    this.renderNextFrame = false;
  }

  forceRenderNextFrame() {
    this.renderNextFrame = true;
  }

  shouldRender = (function () {
    let renderCount = 0;
    const lastCameraPosition = new THREE.Vector3();
    const lastCameraOrientation = new THREE.Quaternion();
    const changeEpsilon = 0.0001;

    return function () {
      if (
        !this.initialized ||
        !this.splatRenderReady ||
        this.isDisposingOrDisposed()
      )
        return false

      let shouldRender = false;
      let cameraChanged = false;
      if (this.camera) {
        const cp = this.camera.position;
        const co = this.camera.quaternion;
        cameraChanged =
          Math.abs(cp.x - lastCameraPosition.x) > changeEpsilon ||
          Math.abs(cp.y - lastCameraPosition.y) > changeEpsilon ||
          Math.abs(cp.z - lastCameraPosition.z) > changeEpsilon ||
          Math.abs(co.x - lastCameraOrientation.x) > changeEpsilon ||
          Math.abs(co.y - lastCameraOrientation.y) > changeEpsilon ||
          Math.abs(co.z - lastCameraOrientation.z) > changeEpsilon ||
          Math.abs(co.w - lastCameraOrientation.w) > changeEpsilon;
      }

      shouldRender =
        this.renderMode !== RenderMode.Never &&
        (renderCount === 0 ||
          this.splatMesh.visibleRegionChanging ||
          cameraChanged ||
          this.renderMode === RenderMode.Always ||
          this.dynamicMode === true ||
          this.renderNextFrame);

      if (this.camera) {
        lastCameraPosition.copy(this.camera.position);
        lastCameraOrientation.copy(this.camera.quaternion);
      }

      renderCount++;
      return shouldRender
    }
  })()

  render = (function () {
    return function () {
      if (
        !this.initialized ||
        !this.splatRenderReady ||
        this.isDisposingOrDisposed()
      )
        return

      const hasRenderables = (threeScene) => {
        for (let child of threeScene.children) {
          if (child.visible) return true
        }
        return false
      };

      const savedAuoClear = this.renderer.autoClear;
      if (hasRenderables(this.threeScene)) {
        this.renderer.render(this.threeScene, this.camera);
        this.renderer.autoClear = false;
      }
      this.renderer.render(this.splatMesh, this.camera);
      this.renderer.autoClear = false;
      if (this.sceneHelper.getFocusMarkerOpacity() > 0.0)
        this.renderer.render(this.sceneHelper.focusMarker, this.camera);
      if (this.showControlPlane)
        this.renderer.render(this.sceneHelper.controlPlane, this.camera);
      this.renderer.autoClear = savedAuoClear;
    }
  })()


  update(renderer, camera) {
    // this.frame++
    const fpsDiv = document.getElementById('fps');
    if (fpsDiv) {
      fpsDiv.textContent = `FPS: ${this.currentFPS}`;
    }

    if(this.frame >= this.totalFrames) 
        this.frame = 0;
    
    if (this.dropInMode) this.updateForDropInMode(renderer, camera);

    if (
      !this.initialized ||
      !this.splatRenderReady ||
      this.isDisposingOrDisposed()
    )
      return

    if (this.controls) {
      this.controls.update();
      if (this.camera.isOrthographicCamera && !this.usingExternalCamera) {
        Viewer.setCameraPositionFromZoom(
          this.camera,
          this.camera,
          this.controls
        );
      }
    }
    this.runMorphUpdate();
    this.runSplatSort(true,true);

    this.updateForRendererSizeChanges();
    this.updateSplatMesh();
    this.updateMeshCursor();
    this.updateFPS();
    this.timingSensitiveUpdates();
    // this.updateInfoPanel()
    this.updateControlPlane();
  }

  sortedIndexes
  updateForDropInMode(renderer, camera) {
    this.renderer = renderer;
    if (this.splatMesh) this.splatMesh.setRenderer(this.renderer);
    this.camera = camera;
    if (this.controls) this.controls.object = camera;
    this.init();
  }

  lastCalcTime = getCurrentTime()
  fpsFrameCount = 0
  updateFPS = () => {
    if (
      this.consecutiveRenderFrames >
      CONSECUTIVE_RENDERED_FRAMES_FOR_FPS_CALCULATION
    ) {
      const currentTime = getCurrentTime();
      const calcDelta = currentTime - this.lastCalcTime;
      if (calcDelta >= 1.0) {
        this.currentFPS = this.fpsFrameCount;
        this.fpsFrameCount = 0;
        this.lastCalcTime = currentTime;
      } else {
        this.fpsFrameCount++;
      }
    } else {
      this.currentFPS = null;
    }
  }

  updateForRendererSizeChanges = (function () {
    const lastRendererSize = new THREE.Vector2();
    const currentRendererSize = new THREE.Vector2();
    let lastCameraOrthographic;

    return function () {
      if (!this.usingExternalCamera) {
        this.renderer.getSize(currentRendererSize);
        if (
          lastCameraOrthographic === undefined ||
          lastCameraOrthographic !== this.camera.isOrthographicCamera ||
          currentRendererSize.x !== lastRendererSize.x ||
          currentRendererSize.y !== lastRendererSize.y
        ) {
          if (this.camera.isOrthographicCamera) {
            this.camera.left = -currentRendererSize.x / 2.0;
            this.camera.right = currentRendererSize.x / 2.0;
            this.camera.top = currentRendererSize.y / 2.0;
            this.camera.bottom = -currentRendererSize.y / 2.0;
          } else {
            this.camera.aspect = currentRendererSize.x / currentRendererSize.y;
          }
          this.camera.updateProjectionMatrix();
          lastRendererSize.copy(currentRendererSize);
          lastCameraOrthographic = this.camera.isOrthographicCamera;
        }
      }
    }
  })()

  timingSensitiveUpdates = (function () {
    let lastUpdateTime;

    return function () {
      const currentTime = getCurrentTime();
      if (!lastUpdateTime) lastUpdateTime = currentTime;
      const timeDelta = currentTime - lastUpdateTime;

      this.updateCameraTransition(currentTime);
      this.updateFocusMarker(timeDelta);

      lastUpdateTime = currentTime;
    }
  })()

  tempCameraTarget = new THREE.Vector3()
  toPreviousTarget = new THREE.Vector3()
  toNextTarget = new THREE.Vector3()
  updateCameraTransition = (currentTime) => {
    if (this.transitioningCameraTarget) {
      this.toPreviousTarget
        .copy(this.previousCameraTarget)
        .sub(this.camera.position)
        .normalize();
      this.toNextTarget
        .copy(this.nextCameraTarget)
        .sub(this.camera.position)
        .normalize();
      const rotationAngle = Math.acos(
        this.toPreviousTarget.dot(this.toNextTarget)
      );
      const rotationSpeed = (rotationAngle / (Math.PI / 3)) * 0.65 + 0.3;
      const t =
        (rotationSpeed / rotationAngle) *
        (currentTime - this.transitioningCameraTargetStartTime);
      this.tempCameraTarget
        .copy(this.previousCameraTarget)
        .lerp(this.nextCameraTarget, t);
      this.camera.lookAt(this.tempCameraTarget);
      this.controls.target.copy(this.tempCameraTarget);
      if (t >= 1.0) {
        this.transitioningCameraTarget = false;
      }
    }
  }

  updateFocusMarker = (function () {
    const renderDimensions = new THREE.Vector2();
    let wasTransitioning = false;

    return function (timeDelta) {
      this.getRenderDimensions(renderDimensions);
      if (this.transitioningCameraTarget) {
        this.sceneHelper.setFocusMarkerVisibility(true);
        const currentFocusMarkerOpacity = Math.max(
          this.sceneHelper.getFocusMarkerOpacity(),
          0.0
        );
        let newFocusMarkerOpacity = Math.min(
          currentFocusMarkerOpacity + FOCUS_MARKER_FADE_IN_SPEED * timeDelta,
          1.0
        );
        this.sceneHelper.setFocusMarkerOpacity(newFocusMarkerOpacity);
        this.sceneHelper.updateFocusMarker(
          this.nextCameraTarget,
          this.camera,
          renderDimensions
        );
        wasTransitioning = true;
        this.forceRenderNextFrame();
      } else {
        let currentFocusMarkerOpacity;
        if (wasTransitioning) currentFocusMarkerOpacity = 1.0;
        else
          currentFocusMarkerOpacity = Math.min(
            this.sceneHelper.getFocusMarkerOpacity(),
            1.0
          );
        if (currentFocusMarkerOpacity > 0) {
          this.sceneHelper.updateFocusMarker(
            this.nextCameraTarget,
            this.camera,
            renderDimensions
          );
          let newFocusMarkerOpacity = Math.max(
            currentFocusMarkerOpacity - FOCUS_MARKER_FADE_OUT_SPEED * timeDelta,
            0.0
          );
          this.sceneHelper.setFocusMarkerOpacity(newFocusMarkerOpacity);
          if (newFocusMarkerOpacity === 0.0)
            this.sceneHelper.setFocusMarkerVisibility(false);
        }
        if (currentFocusMarkerOpacity > 0.0) this.forceRenderNextFrame();
        wasTransitioning = false;
      }
    }
  })()

  updateMeshCursor = (function () {
    const outHits = [];
    const renderDimensions = new THREE.Vector2();

    return function () {
      if (this.showMeshCursor) {
        this.forceRenderNextFrame();
        this.getRenderDimensions(renderDimensions);
        outHits.length = 0;
        this.raycaster.setFromCameraAndScreenPosition(
          this.camera,
          this.mousePosition,
          renderDimensions
        );
        this.raycaster.intersectSplatMesh(this.splatMesh, outHits);
        if (outHits.length > 0) {
          this.sceneHelper.setMeshCursorVisibility(true);
          this.sceneHelper.positionAndOrientMeshCursor(
            outHits[0].origin,
            this.camera
          );
        } else {
          this.sceneHelper.setMeshCursorVisibility(false);
        }
      } else {
        if (this.sceneHelper.getMeschCursorVisibility())
          this.forceRenderNextFrame();
        this.sceneHelper.setMeshCursorVisibility(false);
      }
    }
  })()

  updateInfoPanel = (function () {
    const renderDimensions = new THREE.Vector2();

    return function () {
      if (!this.showInfo) return
      const splatCount = this.splatMesh.getSplatCount();
      this.getRenderDimensions(renderDimensions);
      this.controls ? this.controls.target : null;
      this.showMeshCursor
        ? this.sceneHelper.meshCursor.position
        : null;
      splatCount > 0 ? (this.splatRenderCount / splatCount) * 100 : 0;
      // this.infoPanel.update(
      //   renderDimensions,
      //   this.camera.position,
      //   cameraLookAtPosition,
      //   this.camera.up,
      //   this.camera.isOrthographicCamera,
      //   meshCursorPosition,
      //   this.currentFPS || 'N/A',
      //   splatCount,
      //   this.splatRenderCount,
      //   splatRenderCountPct,
      //   this.lastSortTime,
      //   this.focalAdjustment,
      //   this.splatMesh.getSplatScale(),
      //   this.splatMesh.getPointCloudModeEnabled()
      // )
    }
  })()

  updateControlPlane() {
    if (this.showControlPlane) {
      this.sceneHelper.setControlPlaneVisibility(true);
      this.sceneHelper.positionAndOrientControlPlane(
        this.controls.target,
        this.camera.up
      );
    } else {
      this.sceneHelper.setControlPlaneVisibility(false);
    }
  }

  mvpMatrix = new THREE.Matrix4()
  cameraPositionArray = []
  lastSortViewDir = new THREE.Vector3(0, 0, -1)
  sortViewDir = new THREE.Vector3(0, 0, -1)
  lastSortViewPos = new THREE.Vector3()
  sortViewOffset = new THREE.Vector3()
  queuedSorts = []

  partialSorts = [
    {
      angleThreshold: 0.55,
      sortFractions: [0.125, 0.33333, 0.75]
    },
    {
      angleThreshold: 0.65,
      sortFractions: [0.33333, 0.66667]
    },
    {
      angleThreshold: 0.8,
      sortFractions: [0.5]
    }
  ]
  runSplatSort = (force = false, forceSortAll = false) => {
    if (!this.initialized) return Promise.resolve(false)
    if (this.sortRunning) return Promise.resolve(true)
    if (this.splatMesh.getSplatCount() <= 0) {
      this.splatRenderCount = 0;
      return Promise.resolve(false)
    }

    let angleDiff = 0;
    let positionDiff = 0;
    let needsRefreshForRotation = false;
    let needsRefreshForPosition = false;

    this.sortViewDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    angleDiff = this.sortViewDir.dot(this.lastSortViewDir);
    positionDiff = this.sortViewOffset
      .copy(this.camera.position)
      .sub(this.lastSortViewPos)
      .length();

    if (!force) {
      if (!this.splatMesh.dynamicMode && this.queuedSorts.length === 0) {
        if (angleDiff <= 0.99) needsRefreshForRotation = true;
        if (positionDiff >= 1.0) needsRefreshForPosition = true;
        if (!needsRefreshForRotation && !needsRefreshForPosition)
          return Promise.resolve(false)
      }
    }

    this.sortRunning = true;
    let { splatRenderCount, shouldSortAll } = this.gatherSceneNodesForSort();
    shouldSortAll = shouldSortAll || forceSortAll;
    this.splatRenderCount = splatRenderCount;

    this.mvpMatrix.copy(this.camera.matrixWorld).invert();
    const mvpCamera = this.perspectiveCamera || this.camera;
    this.mvpMatrix.premultiply(mvpCamera.projectionMatrix);
    if (!this.splatMesh.dynamicMode)
      this.mvpMatrix.multiply(this.splatMesh.matrixWorld);

    let gpuAcceleratedSortPromise = Promise.resolve(true);
    if (
      this.gpuAcceleratedSort &&
      (this.queuedSorts.length <= 1 || this.queuedSorts.length % 2 === 0)
    ) {
      gpuAcceleratedSortPromise = this.splatMesh.computeDistancesOnGPU(
        this.mvpMatrix,
        this.sortWorkerPrecomputedDistances
      );
    }

    gpuAcceleratedSortPromise.then(() => {
      if (this.queuedSorts.length === 0) {
        if (this.splatMesh.dynamicMode || shouldSortAll) {
          this.queuedSorts.push(this.splatRenderCount);
        } else {
          for (let partialSort of this.partialSorts) {
            if (angleDiff < partialSort.angleThreshold) {
              for (let sortFraction of partialSort.sortFractions) {
                this.queuedSorts.push(
                  Math.floor(this.splatRenderCount * sortFraction)
                );
              }
              break
            }
          }
          this.queuedSorts.push(this.splatRenderCount);
        }
      }
      let sortCount = Math.min(this.queuedSorts.shift(), this.splatRenderCount);
      this.splatSortCount = sortCount;

      this.cameraPositionArray[0] = this.camera.position.x;
      this.cameraPositionArray[1] = this.camera.position.y;
      this.cameraPositionArray[2] = this.camera.position.z;

      const sortMessage = {
        modelViewProj: this.mvpMatrix.elements,
        cameraPosition: this.cameraPositionArray,
        splatRenderCount: this.splatRenderCount,
        splatSortCount: sortCount,
        usePrecomputedDistances: this.gpuAcceleratedSort
      };
      if (this.splatMesh.dynamicMode) {
        this.splatMesh.fillTransformsArray(this.sortWorkerTransforms);
      }
      if (!this.sharedMemoryForWorkers) {
        sortMessage.indexesToSort = this.sortWorkerIndexesToSort;
        sortMessage.transforms = this.sortWorkerTransforms;
        if (this.gpuAcceleratedSort) {
          sortMessage.precomputedDistances = this.sortWorkerPrecomputedDistances;
        }
      }

      this.sortPromise = new Promise((resolve) => {
        this.sortPromiseResolver = resolve;
      });

      if (this.preSortMessages.length > 0) {
        this.preSortMessages.forEach((message) => {
          this.sortWorker.postMessage(message);
        });
        this.preSortMessages = [];
      }
      this.sortWorker.postMessage({
        sort: sortMessage
      });

      if (this.queuedSorts.length === 0) {
        this.lastSortViewPos.copy(this.camera.position);
        this.lastSortViewDir.copy(this.sortViewDir);
      }

      return true
    });

    return gpuAcceleratedSortPromise
  }

  /**
   * Determine which splats to render by checking which are inside or close to the view frustum
   */
  gatherSceneNodesForSort = (function () {
    const nodeRenderList = [];
    let allSplatsSortBuffer = null;
    const tempVectorYZ = new THREE.Vector3();
    const tempVectorXZ = new THREE.Vector3();
    const tempVector = new THREE.Vector3();
    const modelView = new THREE.Matrix4();
    const baseModelView = new THREE.Matrix4();
    const sceneTransform = new THREE.Matrix4();
    const renderDimensions = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1);

    const tempMax = new THREE.Vector3();
    const nodeSize = (node) => {
      return tempMax.copy(node.max).sub(node.min).length()
    };

    return function (gatherAllNodes = false) {
      this.getRenderDimensions(renderDimensions);
      const cameraFocalLength =
        renderDimensions.y /
        2.0 /
        Math.tan((this.camera.fov / 2.0) * THREE.MathUtils.DEG2RAD);
      const fovXOver2 = Math.atan(renderDimensions.x / 2.0 / cameraFocalLength);
      const fovYOver2 = Math.atan(renderDimensions.y / 2.0 / cameraFocalLength);
      const cosFovXOver2 = Math.cos(fovXOver2);
      const cosFovYOver2 = Math.cos(fovYOver2);

      const splatTree = this.splatMesh.getSplatTree();

      if (splatTree) {
        baseModelView.copy(this.camera.matrixWorld).invert();
        if (!this.splatMesh.dynamicMode)
          baseModelView.multiply(this.splatMesh.matrixWorld);

        let nodeRenderCount = 0;
        let splatRenderCount = 0;

        for (let s = 0; s < splatTree.subTrees.length; s++) {
          const subTree = splatTree.subTrees[s];
          modelView.copy(baseModelView);
          if (this.splatMesh.dynamicMode) {
            this.splatMesh.getSceneTransform(s, sceneTransform);
            modelView.multiply(sceneTransform);
          }
          const nodeCount = subTree.nodesWithIndexes.length;
          for (let i = 0; i < nodeCount; i++) {
            const node = subTree.nodesWithIndexes[i];
            if (
              !node.data ||
              !node.data.indexes ||
              node.data.indexes.length === 0
            )
              continue
            tempVector.copy(node.center).applyMatrix4(modelView);

            const distanceToNode = tempVector.length();
            tempVector.normalize();

            tempVectorYZ.copy(tempVector).setX(0).normalize();
            tempVectorXZ.copy(tempVector).setY(0).normalize();

            const cameraAngleXZDot = forward.dot(tempVectorXZ);
            const cameraAngleYZDot = forward.dot(tempVectorYZ);

            const ns = nodeSize(node);
            const outOfFovY = cameraAngleYZDot < cosFovYOver2 - 0.6;
            const outOfFovX = cameraAngleXZDot < cosFovXOver2 - 0.6;
            if (
              !gatherAllNodes &&
              (outOfFovX || outOfFovY) &&
              distanceToNode > ns
            ) {
              continue
            }
            splatRenderCount += node.data.indexes.length;
            nodeRenderList[nodeRenderCount] = node;
            node.data.distanceToNode = distanceToNode;
            nodeRenderCount++;
          }
        }

        nodeRenderList.length = nodeRenderCount;
        nodeRenderList.sort((a, b) => {
          if (a.data.distanceToNode < b.data.distanceToNode) return -1
          else return 1
        });

        let currentByteOffset = splatRenderCount * Constants$1.BytesPerInt;
        for (let i = 0; i < nodeRenderCount; i++) {
          const node = nodeRenderList[i];
          const windowSizeInts = node.data.indexes.length;
          const windowSizeBytes = windowSizeInts * Constants$1.BytesPerInt;
          let destView = new Uint32Array(
            this.sortWorkerIndexesToSort.buffer,
            currentByteOffset - windowSizeBytes,
            windowSizeInts
          );
          destView.set(node.data.indexes);
          currentByteOffset -= windowSizeBytes;
        }

        return {
          splatRenderCount: splatRenderCount,
          shouldSortAll: false
        }
      } else {
        const totalSplatCount = this.splatMesh.getSplatCount();
        if (
          !allSplatsSortBuffer ||
          allSplatsSortBuffer.length !== totalSplatCount
        ) {
          allSplatsSortBuffer = new Uint32Array(totalSplatCount);
          for (let i = 0; i < totalSplatCount; i++) {
            allSplatsSortBuffer[i] = i;
          }
        }
        this.sortWorkerIndexesToSort.set(allSplatsSortBuffer);
        return {
          splatRenderCount: totalSplatCount,
          shouldSortAll: true
        }
      }
    }
  })()

  getSplatMesh() {
    return this.splatMesh
  }

  /**
   * Get a reference to a splat scene.
   * @param {number} sceneIndex The index of the scene to which the reference will be returned
   * @return {SplatScene}
   */
  getSplatScene(sceneIndex) {
    return this.splatMesh.getScene(sceneIndex)
  }

  getSceneCount() {
    return this.splatMesh.getSceneCount()
  }

  isMobile() {
    return navigator.userAgent.includes('Mobi')
  }

  createBonesFromJson(bonesJson) {
    const bones = [];

    function createBoneRecursive(jsonBone, parent = null) {
      const bone = new THREE.Bone();
      bone.name = jsonBone.name;
      if (parent) {
        parent.add(bone);
      }
      bone.position.set(...jsonBone.position);
      bones.push(bone);

      if (jsonBone.children) {
        jsonBone.children.forEach((childJsonBone) =>
          createBoneRecursive(childJsonBone, bone)
        );
      }
      return bone
    }

    bonesJson.forEach((boneJson) => createBoneRecursive(boneJson));

    return bones
  }

  updateMorphTarget(inputMesh) {
    this.avatarMesh = inputMesh;
    this.splatMesh.flameModel = inputMesh;
    this.splatMesh.useFlameModel = this.useFlame;
    if(this.useFlame == true) {
        // const skinData = {
        //     bones: [
        //         {
        //         "name": "root",
        //         "position": [-1.7149e-04, -1.4252e-01, -8.2541e-02],
        //         "children": [
        //             {
        //             "name": "neck",
        //             "position": [-5.6988e-05, -1.6069e-02, -5.7859e-02],
                    
        //             "children": [
        //                 {
        //                 "name": "jaw",
        //                     "position": [7.4429e-04, -8.7249e-03, -5.3760e-02]

        //                 },
        //                 {
        //                 "name": "leftEye",
        //                 "position": [  3.0240e-02,  2.3092e-02,  2.2900e-02]
        //                 },
        //                 {
        //                 "name": "rightEye",
        //                 "position": [-3.0296e-02,  2.3675e-02,  2.1837e-02]
        //                 }
        //             ]
        //             }
        //         ]
        //         }
        //     ] 
        // };

        // this.bones = this.createBonesFromJson(skinData.bones);
        this.bones = this.createBonesFromJson(this.bone_tree["bones"]);

        const bonesPosReserve = [new THREE.Vector3(this.bones[0].position.x, this.bones[0].position.y, this.bones[0].position.z),
        new THREE.Vector3(this.bones[1].position.x, this.bones[1].position.y, this.bones[1].position.z),
        new THREE.Vector3(this.bones[2].position.x, this.bones[2].position.y, this.bones[2].position.z),
        new THREE.Vector3(this.bones[3].position.x, this.bones[3].position.y, this.bones[3].position.z),
        new THREE.Vector3(this.bones[4].position.x, this.bones[4].position.y, this.bones[4].position.z)
        ];
        this.bones[1].position.copy(new THREE.Vector3(bonesPosReserve[1].x - bonesPosReserve[0].x, bonesPosReserve[1].y - bonesPosReserve[0].y, bonesPosReserve[1].z - bonesPosReserve[0].z));
        this.bones[2].position.copy(new THREE.Vector3(bonesPosReserve[2].x - bonesPosReserve[1].x, bonesPosReserve[2].y - bonesPosReserve[1].y, bonesPosReserve[2].z - bonesPosReserve[1].z));
        this.bones[3].position.copy(new THREE.Vector3(bonesPosReserve[3].x - bonesPosReserve[1].x, bonesPosReserve[3].y - bonesPosReserve[1].y, bonesPosReserve[3].z - bonesPosReserve[1].z));
        this.bones[4].position.copy(new THREE.Vector3(bonesPosReserve[4].x - bonesPosReserve[1].x, bonesPosReserve[4].y - bonesPosReserve[1].y, bonesPosReserve[4].z - bonesPosReserve[1].z));
        
        this.bones[0].updateMatrixWorld(true);
        const boneInverses = [this.bones[0].matrixWorld.clone().invert(),
                                this.bones[1].matrixWorld.clone().invert(),
                                this.bones[2].matrixWorld.clone().invert(),
                                this.bones[3].matrixWorld.clone().invert(),
                                this.bones[4].matrixWorld.clone().invert()];

        this.skeleton = new THREE.Skeleton(this.bones, boneInverses);
    }

    this.runMorphUpdate();
    this.splatMesh.gaussianSplatCount = this.gaussianSplatCount;
  }

  updatedBoneMatrices(boneNum){
    let updatedBoneMatrices = [];
    for (let j = 0; j < boneNum; j++) { 
        let boneMatrix;
        boneMatrix =  this.skeleton.bones[j].matrixWorld.clone().multiply(this.skeleton.boneInverses[j].clone());

        function addMatrixToArray(matrix, array) {
            let elements = matrix.elements; 
            for (let i = 0; i < elements.length; i++) {
                array.push(elements[i]);
            }
        }
        
        addMatrixToArray(boneMatrix, updatedBoneMatrices);
    }
    let bonesMatrix = new Float32Array(updatedBoneMatrices);
    return bonesMatrix;
}
  runMorphUpdate() {
    this.gaussianSplatCount = this.avatarMesh.geometry.attributes.position.count;
    var morphedMesh = new Float32Array(
      this.avatarMesh.geometry.attributes.position.array
    );
    const numBones = 5;
    this.splatMesh.bonesNum = numBones;
    if (this.useFlame == false) 
    {
        this.skinModel.skeleton.update();
        this.boneRoot.updateMatrixWorld(true);
        if (this.splatMesh.geometry.getAttribute('splatIndex') && this.setSkinAttibutes === false) {

          this.setSkinAttibutes = true;
          const geometry = this.splatMesh.geometry;

          const skinIndexSource = this.skinModel.geometry.attributes.skinIndex;
          const skinWeightSource = this.skinModel.geometry.attributes.skinWeight;

          const newSkinIndex = new THREE.InstancedBufferAttribute(
              new skinIndexSource.array.constructor(skinIndexSource.array), 
              4,
              skinIndexSource.normalized,
              1
          );
          
          const newSkinWeight = new THREE.InstancedBufferAttribute(
              new skinWeightSource.array.constructor(skinWeightSource.array), 
              4,
              skinWeightSource.normalized,
              1
          );
          newSkinIndex.setUsage(THREE.DynamicDrawUsage);
          newSkinWeight.setUsage(THREE.DynamicDrawUsage);
          geometry.setAttribute('skinIndex', newSkinIndex);
          geometry.setAttribute('skinWeight', newSkinWeight);
      }
    } else {
        this.updateFlameBones();
    }
    
    this.splatMesh.morphedMesh = morphedMesh;

    let splatNum = this.splatMesh.morphedMesh.length / 3;
    if (this.splatMesh.splatDataTextures['flameModel'] != undefined) {
      this.splatMesh.updateTetureAfterBSAndSkeleton(0, splatNum - 1, this.useFlame);
    }
  }

  updateFlameBones(){
    this.splatMesh.bsWeight = this.flame_params['expr'][this.frame];

    function setBoneRotationAndMatrix(bone, angles, isQuat = false) {
        let quaternion;
        if(isQuat == true) {
            quaternion = new THREE.Quaternion(angles[0], angles[1], angles[2], angles[3]);
        } else {
            const value = new THREE.Vector3(angles[0], angles[1], angles[2]);
            const angleInRadians = value.length();
            const axis = value.normalize();
            quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angleInRadians);
        }
        bone.quaternion.copy(quaternion);
        bone.updateMatrixWorld(true);
    }

    let angle = this.flame_params['rotation'][this.frame];

    setBoneRotationAndMatrix(this.skeleton.bones[0], angle);

    angle = this.flame_params['neck_pose'][this.frame];
    setBoneRotationAndMatrix(this.skeleton.bones[1], angle);

    angle = this.flame_params['jaw_pose'][this.frame];
    setBoneRotationAndMatrix(this.skeleton.bones[2], angle);

    angle = this.flame_params['eyes_pose'][this.frame];
    setBoneRotationAndMatrix(this.skeleton.bones[3], angle);

    setBoneRotationAndMatrix(this.skeleton.bones[4], [angle[3], angle[4], angle[5]]);

    // update skeleton
    this.skeleton.update();

    const numBones = 5;
    const bonesMatrix = this.updatedBoneMatrices(numBones);
    this.splatMesh.bonesMatrix = bonesMatrix;
    this.splatMesh.bonesNum = numBones;
    this.splatMesh.bonesWeight = this.lbs_weight_80k;
  }
}

/**
 * GaussianSplatRenderer
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * 
 * High-level orchestration class that:
 * - Loads ZIP assets via fetch
 * - Unpacks with JSZip
 * - Creates Viewer instance
 * - Loads FLAME/skin models
 * - Runs the render loop
 */


// Configuration objects - these would normally be loaded from the ZIP
const charactorConfig = {
    camPos: { x: 0, y: 1.8, z: 1 },
    camRot: { x: -10, y: 0, z: 0 },
    backgroundColor: 'ffffff',
    useFlame: 'false'  // Match compact file default - use non-FLAME mode
};

const motionConfig = {
    offset: {},
    scale: {}
};

// Animation configuration - defines how animation clips are distributed to states
// The animation.glb contains clips in order: hello(2), idle(1), listen(0), speak(6), think(3)
const animationConfig = {
    hello: { size: 2, isGroup: false },
    idle: { size: 1, isGroup: false },
    listen: { size: 0, isGroup: false },
    speak: { size: 6, isGroup: false },
    think: { size: 3, isGroup: true },
    other: []
};

/**
 * GaussianSplatRenderer - Main rendering class
 */
class GaussianSplatRenderer {
    // Static canvas element shared across instances
    static _canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    
    // Singleton instance
    static instance = undefined;

    /**
     * Factory method to create/get renderer instance
     * @param {HTMLElement} container - DOM container for canvas
     * @param {string} assetPath - URL to character ZIP file
     * @param {object} options - Configuration options
     * @returns {Promise<GaussianSplatRenderer>}
     */
    static async getInstance(container, assetPath, options = {}) {
        if (this.instance !== undefined) {
            return this.instance;
        }

        try {
            const characterPath = assetPath;
            
            // Parse character name from path
            const url = new URL(characterPath, window.location.href);
            const pathname = url.pathname;
            const matches = pathname.match(/\/([^/]+?)\.zip/);
            const characterName = matches && matches[1];
            
            if (!characterName) {
                throw new Error('character model is not found');
            }

            // Show progress
            if (typeof NProgress !== 'undefined') {
                NProgress.start();
            }

            // Download ZIP file
            const characterZipResponse = await fetch(characterPath);
            if (!characterZipResponse.ok) {
                throw new Error(`Failed to download: ${characterZipResponse.statusText}`);
            }

            // Report download progress
            if (options.downloadProgress) {
                options.downloadProgress(1.0);
            }

            if (options.loadProgress) {
                options.loadProgress(0.1);
            }

            if (typeof NProgress !== 'undefined') {
                NProgress.done();
            }

            const arrayBuffer = await characterZipResponse.arrayBuffer();
            
            // Load ZIP with imported JSZip
            const zipData = await JSZip.loadAsync(arrayBuffer);

            // Find folder name in ZIP
            let fileName = '';
            Object.values(zipData.files).forEach(file => {
                if (file.dir) {
                    fileName = file.name?.slice(0, file.name?.length - 1); // Remove trailing '/'
                }
            });

            if (!fileName) {
                throw new Error('file folder is not found');
            }

            // Create renderer instance
            const renderer = new GaussianSplatRenderer(container, zipData);

            // Setup camera position
            const cameraPos = new THREE.Vector3();
            cameraPos.x = charactorConfig.camPos?.x || 0;
            cameraPos.y = charactorConfig.camPos?.y || 0;
            cameraPos.z = charactorConfig.camPos?.z || 1;

            const cameraRotation = new THREE.Vector3();
            cameraRotation.x = charactorConfig.camRot?.x || 0;
            cameraRotation.y = charactorConfig.camRot?.y || 0;
            cameraRotation.z = charactorConfig.camRot?.z || 0;

            // Background color
            let backgroundColor = 0xffffff;
            if (charactorConfig.backgroundColor) {
                backgroundColor = parseInt(charactorConfig.backgroundColor, 16);
            }
            if (options?.backgroundColor && renderer.isHexColorStrict(options.backgroundColor)) {
                backgroundColor = parseInt(options.backgroundColor, 16);
            }

            // Store callbacks
            renderer.getChatState = options?.getChatState;
            renderer.getExpressionData = options?.getExpressionData;

            // FLAME mode flag
            if (charactorConfig.useFlame) {
                renderer.useFlame = (charactorConfig.useFlame === 'false') ? false : true;
            }

            // Create Viewer with imported class
            renderer.viewer = new Viewer({
                rootElement: container,
                threejsCanvas: GaussianSplatRenderer._canvas,
                cameraUp: [0, 1, 0],
                initialCameraPosition: [cameraPos.x, cameraPos.y, cameraPos.z],
                initialCameraRotation: [cameraRotation.x, cameraRotation.y, cameraRotation.z],
                sphericalHarmonicsDegree: 0,
                backgroundColor: backgroundColor
            });

            renderer.viewer.useFlame = renderer.useFlame;

            // Load model based on mode
            if (renderer.viewer.useFlame === true) {
                await renderer.loadFlameModel(fileName, motionConfig);
            } else {
                await renderer.loadModel(fileName, animationConfig, motionConfig);
            }

            if (options.loadProgress) {
                options.loadProgress(0.2);
            }

            // Load offset PLY
            const offsetFileUrl = await renderer.unpackFileAsBlob(fileName + '/offset.ply');

            if (options.loadProgress) {
                options.loadProgress(0.3);
            }

            // Add splat scene
            await renderer.viewer.addSplatScene(offsetFileUrl, {
                progressiveLoad: true,
                sharedMemoryForWorkers: false,
                showLoadingUI: false,
                format: SceneFormat.Ply
            });
            renderer.render();

            if (options.loadProgress) {
                options.loadProgress(1);
            }

            this.instance = renderer;
            return renderer;

        } catch (error) {
            console.error('GaussianSplatRenderer.getInstance error:', error);
            throw error;
        }
    }

    /**
     * Constructor
     * @param {HTMLElement} _container - DOM container
     * @param {JSZip} zipData - Loaded ZIP data
     */
    constructor(_container, zipData) {
        // ZIP file cache
        this.zipUrls = {
            urls: new Map(),
            zip: zipData
        };

        // State
        this.useFlame = false;
        this.lastTime = 0;
        this.startTime = 0;
        this.expressionData = {};
        this.chatState = TYVoiceChatState.Idle;

        // Setup canvas
        if (GaussianSplatRenderer._canvas && _container) {
            const { width, height } = _container.getBoundingClientRect();
            GaussianSplatRenderer._canvas.style.visibility = 'visible';
            GaussianSplatRenderer._canvas.width = width;
            GaussianSplatRenderer._canvas.height = height;
            _container.appendChild(GaussianSplatRenderer._canvas);
        }

        // Animation timing
        this.clock = new THREE.Clock();
        this.startTime = performance.now() / 1000.0;

        // These will be set during loading
        this.viewer = null;
        this.mixer = null;
        this.animManager = null;
        this.model = null;
        this.motioncfg = null;
        this.getChatState = null;
        this.getExpressionData = null;
    }

    /**
     * Dispose renderer and free resources
     */
    dispose() {
        if (GaussianSplatRenderer._canvas) {
            GaussianSplatRenderer._canvas.style.visibility = 'hidden';
        }
        
        this.disposeModel();
        
        // Revoke all blob URLs
        this.zipUrls.urls.forEach((value) => {
            URL.revokeObjectURL(value);
        });

        GaussianSplatRenderer.instance = undefined;
    }

    /**
     * Dispose model-specific resources
     */
    disposeModel() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            if (this.viewer?.avatarMesh) {
                this.mixer.uncacheRoot(this.viewer.avatarMesh);
            }
            this.mixer = undefined;
            this.animManager?.dispose();
        }
        this.viewer?.dispose();
    }

    /**
     * Get the Three.js camera
     * @returns {THREE.Camera}
     */
    getCamera() {
        return this.viewer?.camera;
    }

    /**
     * Update blendshape weights from action data
     * @param {object} actionData - Blendshape weights
     * @returns {object} Processed influence values
     */
    updateBS(actionData) {
        // Default influence values - all 52 ARKit blendshapes
        let influence = {
            browDownLeft: 0.0,
            browDownRight: 0.0,
            browInnerUp: 0.0,
            browOuterUpLeft: 0.0,
            browOuterUpRight: 0.0,
            mouthCheekPuff: 0.0,
            cheekSquintLeft: 0.0,
            cheekSquintRight: 0.0,
            eyeBlinkLeft: 0.0,
            eyeBlinkRight: 0.0,
            eyeLookDownLeft: 0.0,
            eyeLookDownRight: 0.0,
            eyeLookInLeft: 0.0,
            eyeLookInRight: 0.0,
            eyeLookOutLeft: 0.0,
            eyeLookOutRight: 0.0,
            eyeLookUpLeft: 0.0,
            eyeLookUpRight: 0.0,
            eyeSquintLeft: 0.0,
            eyeSquintRight: 0.0,
            eyeWideLeft: 0.0,
            eyeWideRight: 0.0,
            jawForward: 0.0,
            jawLeft: 0.0,
            jawOpen: 0.0,
            jawRight: 0.0,
            mouthClose: 0.0,
            mouthDimpleLeft: 0.0,
            mouthDimpleRight: 0.0,
            mouthFrownLeft: 0.0,
            mouthFrownRight: 0.0,
            mouthFunnel: 0.0,
            mouthLeft: 0.0,
            mouthLowerDownLeft: 0.0,
            mouthLowerDownRight: 0.0,
            mouthPressLeft: 0.0,
            mouthPressRight: 0.0,
            mouthPucker: 0.0,
            mouthRight: 0.0,
            mouthRollLower: 0.0,
            mouthRollUpper: 0.0,
            mouthShrugLower: 0.0,
            mouthShrugUpper: 0.0,
            mouthSmileLeft: 0.0,
            mouthSmileRight: 0.0,
            mouthStretchLeft: 0.0,
            mouthStretchRight: 0.0,
            mouthUpperUpLeft: 0.0,
            mouthUpperUpRight: 0.0,
            noseSneerLeft: 0.0,
            noseSneerRight: 0.0,
            tongueOut: 0.0
        };

        if (actionData != null) {
            influence = actionData;
        }

        return influence;
    }

    /**
     * Main render loop
     */
    render() {
        if (this.viewer && this.viewer.selfDrivenMode) {
            this.viewer.requestFrameId = requestAnimationFrame(() => this.render());

            const frameInfoInternal = 1.0 / 30.0;
            const currentTime = performance.now() / 1000;
            
            // Prevent division by zero if totalFrames is 0 or not set
            const totalFrames = this.viewer.totalFrames || 1;
            const calcDelta = (currentTime - this.startTime) % (totalFrames * frameInfoInternal);
            const frameIndex = Math.floor(calcDelta / frameInfoInternal);
            this.viewer.frame = frameIndex;

            // Update chat state
            if (this.getChatState) {
                this.chatState = this.getChatState();
                // DEBUG: Log state transitions
                if (!this._lastLoggedState || this._lastLoggedState !== this.chatState) {
                    console.log('[ANIM] Chat state changed to:', this.chatState, 'animManager exists:', !!this.animManager);
                    this._lastLoggedState = this.chatState;
                }
                this.animManager?.update(this.chatState);
            }

            // Update expression data
            if (this.getExpressionData) {
                this.expressionData = this.updateBS(this.getExpressionData());
            }

            // Non-FLAME mode: animation mixer
            if (this.viewer.useFlame === false) {
                if (!this.mixer || !this.animManager) {
                    if (!this._warnedOnce) {
                        console.warn('render: mixer or animManager not initialized, skipping animation update');
                        console.log('[ANIM] useFlame:', this.viewer.useFlame, 'mixer:', !!this.mixer, 'animManager:', !!this.animManager);
                        this._warnedOnce = true;
                    }
                } else {
                    const mixerUpdateDelta = this.clock.getDelta();
                    this.mixer.update(mixerUpdateDelta);

                    // Apply motion config offsets/scales
                    if (this.motioncfg) {
                        for (const morphTarget in this.expressionData) {
                            const offset = this.motioncfg.offset?.[morphTarget];
                            const scale = this.motioncfg.scale?.[morphTarget];
                            if (offset !== undefined && scale !== undefined) {
                                this.expressionData[morphTarget] = 
                                    this.expressionData[morphTarget] * scale + offset;
                            }
                        }
                    }

                    this.setExpression();
                }
            }

            // Update viewer
            this.viewer.update(this.viewer.renderer, this.viewer.camera);

            // Render if needed
            const shouldRender = this.viewer.shouldRender();
            if (this._renderLogCount <= 3) {
                console.log('[GS-DEBUG] shouldRender:', shouldRender);
            }
            if (shouldRender) {
                this.viewer.render();
                this.viewer.consecutiveRenderFrames++;
            } else {
                this.viewer.consecutiveRenderFrames = 0;
            }

            this.viewer.renderNextFrame = false;
            this.viewer.selfDrivenModeRunning = true;
        } else {
            throw new Error('Cannot start viewer unless it is in self driven mode.');
        }
    }

    /**
     * Validate hex color string
     * @param {string} value - Color string to validate
     * @returns {boolean}
     */
    isHexColorStrict(value) {
        if (typeof value !== 'string') return false;
        const hexColorRegex = /^(#|0x)[0-9A-Fa-f]{6}$/i;
        return hexColorRegex.test(value);
    }

    /**
     * Apply expression data to mesh
     */
    setExpression() {
        // Update splat mesh blendshapes
        if (this.viewer?.splatMesh) {
            this.viewer.splatMesh.bsWeight = this.expressionData;
        }

        // Update morph targets on avatar model
        if (this.model) {
            this.model.traverse((object) => {
                if (object.isMesh || object.isSkinnedMesh) {
                    const morphAttributes = object.geometry?.morphAttributes;
                    const hasMorphTargets = morphAttributes && Object.keys(morphAttributes).length > 0;
                    
                    if (hasMorphTargets) {
                        const morphTargetDictionary = object.morphTargetDictionary;
                        for (const morphTarget in morphTargetDictionary) {
                            const target = morphTargetDictionary[morphTarget];
                            const data = this.expressionData[morphTarget];
                            if (data !== undefined) {
                                object.morphTargetInfluences[target] = Math.max(0.0, Math.min(1.0, data));
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Load FLAME model from ZIP
     * @param {string} pathName - Path within ZIP
     * @param {object} motionConfig - Motion configuration
     */
    async loadFlameModel(pathName, motionConfig) {
        // Load all required files in parallel
        const [skinModel, lbs_weight_80k, flame_params, indexes, bone_tree] = await Promise.all([
            this.unpackAndLoadGlb(pathName + '/skin.glb'),
            this.unpackAndLoadJson(pathName + '/lbs_weight_20k.json'),
            this.unpackAndLoadJson(pathName + '/flame_params.json'),
            this.unpackAndLoadJson(pathName + '/vertex_order.json'),
            this.unpackAndLoadJson(pathName + '/bone_tree.json')
        ]);

        if (!this.viewer) {
            throw new Error('render viewer is not initialized');
        }

        // Find skinned mesh and bone root
        let skinModelSkinnedMesh;
        let boneRoot;
        
        skinModel.traverse((object) => {
            if (object.isSkinnedMesh) {
                skinModelSkinnedMesh = object;
            }
            if (object instanceof THREE.Bone && object.name === 'hip') {
                boneRoot = object;
            }
        });

        // Set viewer properties
        this.viewer.sortedIndexes = indexes;
        this.viewer.flame_params = flame_params;
        this.viewer.lbs_weight_80k = lbs_weight_80k;
        this.viewer.bone_tree = bone_tree;
        this.viewer.totalFrames = flame_params['expr']?.length || 1;

        if (skinModelSkinnedMesh) {
            this.viewer.gaussianSplatCount = skinModelSkinnedMesh.geometry.attributes.position.count;
        }

        this.viewer.avatarMesh = skinModel;
        this.viewer.skinModel = skinModelSkinnedMesh;
        this.viewer.boneRoot = boneRoot;
        this.motioncfg = motionConfig;

        // Update morph targets
        if (skinModelSkinnedMesh) {
            this.viewer.updateMorphTarget(skinModelSkinnedMesh);
        }

        // Add to scene (hidden)
        this.viewer.threeScene.add(skinModel);
        skinModel.visible = false;

        // Compute bone texture
        if (skinModelSkinnedMesh) {
            skinModelSkinnedMesh.skeleton.computeBoneTexture();
        }
    }

    /**
     * Load non-FLAME model with animation
     * @param {string} pathName - Path within ZIP
     * @param {object} animationConfig - Animation configuration
     * @param {object} motionConfig - Motion configuration
     */
    async loadModel(pathName, animationConfig, motionConfig) {
        const [skinModel, aniclip, indexes] = await Promise.all([
            this.unpackAndLoadGlb(pathName + '/skin.glb'),
            this.unpackAndLoadGlb(pathName + '/animation.glb'),
            this.unpackAndLoadJson(pathName + '/vertex_order.json')
        ]);

        if (!this.viewer) {
            throw new Error('render viewer is not initialized');
        }

        let skinModelSkinnedMesh;
        let boneRoot;

        skinModel.traverse((object) => {
            if (object.isSkinnedMesh) {
                skinModelSkinnedMesh = object;
            }
            if (object instanceof THREE.Bone && object.name === 'hip') {
                boneRoot = object;
            }
        });

        this.viewer.sortedIndexes = indexes;

        if (skinModelSkinnedMesh) {
            this.viewer.gaussianSplatCount = skinModelSkinnedMesh.geometry.attributes.position.count;
        }

        this.viewer.avatarMesh = skinModel;
        this.viewer.skinModel = skinModelSkinnedMesh;
        this.viewer.boneRoot = boneRoot;

        // Setup animation
        this.mixer = new THREE.AnimationMixer(skinModel);
        this.animManager = new AnimationManager(this.mixer, aniclip, animationConfig);
        this.motioncfg = motionConfig;

        // Set totalFrames from animation clips or default to 1
        if (Array.isArray(aniclip) && aniclip.length > 0 && aniclip[0].duration) {
            this.viewer.totalFrames = Math.floor(aniclip[0].duration * 30); // 30 fps
        } else {
            this.viewer.totalFrames = 1;
        }
        console.log('loadModel: totalFrames set to', this.viewer.totalFrames);

        if (skinModelSkinnedMesh) {
            this.viewer.updateMorphTarget(skinModelSkinnedMesh);
        }

        this.viewer.threeScene.add(skinModel);
        skinModel.visible = false;

        if (skinModelSkinnedMesh) {
            skinModelSkinnedMesh.skeleton.computeBoneTexture();
        }
    }

    /**
     * Unpack file from ZIP as blob URL
     * @param {string} path - Path within ZIP
     * @returns {Promise<string>} Blob URL
     */
    async unpackFileAsBlob(path) {
        if (!this.zipUrls.urls.has(path)) {
            const modelFile = await this.zipUrls.zip?.file(path)?.async('blob');
            if (modelFile) {
                const modelUrl = URL.createObjectURL(modelFile);
                this.zipUrls.urls.set(path, modelUrl);
            }
        }
        return this.zipUrls.urls.get(path);
    }

    /**
     * Unpack and load GLB file
     * @param {string} path - Path within ZIP
     * @returns {Promise<THREE.Group|THREE.AnimationClip[]>}
     */
    async unpackAndLoadGlb(path) {
        if (!this.zipUrls.urls.has(path)) {
            const modelFile = await this.zipUrls.zip?.file(path)?.async('arraybuffer');
            if (modelFile) {
                const blob = new Blob([modelFile], { type: 'model/gltf-binary' });
                const modelUrl = URL.createObjectURL(blob);
                this.zipUrls.urls.set(path, modelUrl);
            }
        }
        return this.LoadGLTF(this.zipUrls.urls.get(path));
    }

    /**
     * Unpack and parse JSON file
     * @param {string} path - Path within ZIP
     * @returns {Promise<object>}
     */
    async unpackAndLoadJson(path) {
        const file = this.zipUrls.zip?.file(path);
        if (!file) {
            throw new Error(`File not found in ZIP: ${path}`);
        }
        const jsonFile = await file.async('string');
        if (!jsonFile) {
            throw new Error(`Failed to read file from ZIP: ${path}`);
        }
        return JSON.parse(jsonFile);
    }

    /**
     * Load GLTF file
     * @param {string} url - URL to GLTF/GLB file
     * @returns {Promise<THREE.Group|THREE.AnimationClip[]>}
     */
    async LoadGLTF(url) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader_js.GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    if (gltf.animations.length > 0) {
                        resolve(gltf.animations);
                    } else {
                        resolve(gltf.scene);
                    }
                },
                undefined,
                (error) => {
                    reject(error);
                }
            );
        });
    }
}

/**
 * FlameConstants
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * FLAME-specific constants for parametric head model.
 * 
 * Note: General engine constants (MaxScenes, etc.) are in enums/EngineConstants.js
 */

const Constants = {
    // FLAME model constants
    FlameBonesCount: 5,  // root, neck, jaw, leftEye, rightEye
    DefaultBlendshapeCount: 52,  // ARKit blendshapes
    
    // Texture sizes for FLAME data
    FlameModelTextureSize: { width: 4096, height: 2048 },
    BoneTextureSize: { width: 4, height: 32 },
    BoneWeightTextureSize: { width: 512, height: 512 }
};

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
const uintEncodedFloat = (function() {
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function(f) {
        floatView[0] = f;
        return int32View[0];
    };
})();

/**
 * Constants for texture data layout
 */
const TextureConstants = {
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

/**
 * FlameTextureManager
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * 
 * Manages GPU textures for FLAME parametric head model:
 * - Blendshape morph target data textures
 * - Bone matrix textures for skeleton animation
 * - LBS weight textures for skinning
 */


/**
 * Build the FLAME model texture containing blendshape positions
 * @param {THREE.SkinnedMesh} flameModel - The FLAME mesh with morph targets
 * @param {THREE.ShaderMaterial} material - The splat material to update uniforms
 * @param {number} gaussianSplatCount - Number of gaussian splats
 * @returns {object} Texture data object
 */
function buildModelTexture(flameModel, material, gaussianSplatCount) {
    const flameModelTexSize = new THREE.Vector2(4096, 2048);

    const shapedMesh = flameModel.geometry.attributes.position.array;
    let shapedMeshArray = [];
    const pointNum = shapedMesh.length / 3;
    const bsLength = flameModel.geometry.morphAttributes.position.length;

    // Sort morph targets by dictionary order
    const morphTargetNames = Object.keys(flameModel.morphTargetDictionary);
    morphTargetNames.forEach((name) => {
        const originalIndex = flameModel.morphTargetDictionary[name];
        const bsMesh = flameModel.geometry.morphAttributes.position[originalIndex];
        shapedMeshArray = shapedMeshArray.concat(Array.from(bsMesh.array));
    });
    
    // Add base mesh positions
    shapedMeshArray = shapedMeshArray.concat(Array.from(shapedMesh));

    // Create texture data
    const flameModelData = new Float32Array(flameModelTexSize.x * flameModelTexSize.y * 4);
    const flameModelDataInt = new Uint32Array(flameModelTexSize.x * flameModelTexSize.y * 4);
    
    for (let c = 0; c < pointNum * (bsLength + 1); c++) {
        flameModelData[c * 4 + 0] = shapedMeshArray[c * 3 + 0];
        flameModelData[c * 4 + 1] = shapedMeshArray[c * 3 + 1];
        flameModelData[c * 4 + 2] = shapedMeshArray[c * 3 + 2];

        flameModelDataInt[c * 4 + 0] = uintEncodedFloat(flameModelData[c * 4 + 0]);
        flameModelDataInt[c * 4 + 1] = uintEncodedFloat(flameModelData[c * 4 + 1]);
        flameModelDataInt[c * 4 + 2] = uintEncodedFloat(flameModelData[c * 4 + 2]);
    }

    const flameModelTex = new THREE.DataTexture(
        flameModelDataInt,
        flameModelTexSize.x,
        flameModelTexSize.y,
        THREE.RGBAIntegerFormat,
        THREE.UnsignedIntType
    );
    flameModelTex.internalFormat = 'RGBA32UI';
    flameModelTex.needsUpdate = true;

    // Update material uniforms
    material.uniforms.flameModelTexture.value = flameModelTex;
    material.uniforms.flameModelTextureSize.value.copy(flameModelTexSize);
    material.uniforms.gaussianSplatCount.value = gaussianSplatCount;
    material.uniformsNeedUpdate = true;

    return {
        data: flameModelDataInt,
        texture: flameModelTex,
        size: flameModelTexSize,
        baseData: { flameModelPos: flameModelData }
    };
}

/**
 * Build bone matrix texture for skeleton animation
 * @param {Float32Array} bonesMatrix - Flattened bone matrices
 * @param {number} bonesNum - Number of bones
 * @param {object} bsWeight - Blendshape weights object
 * @param {object} morphTargetDictionary - Maps blendshape names to indices
 * @param {THREE.SkinnedMesh} flameModel - The FLAME mesh
 * @param {THREE.ShaderMaterial} material - The splat material
 * @param {boolean} useFlameModel - Use FLAME mode
 * @returns {object} Texture data object
 */
function buildBoneMatrixTexture(
    bonesMatrix,
    bonesNum,
    bsWeight,
    morphTargetDictionary,
    flameModel,
    material,
    useFlameModel
) {
    if (!bsWeight) return null;

    // bonesNum + expressionBSNum / 4 = 30, so texture height is 32
    const boneTextureSize = new THREE.Vector2(4, 32);
    const boneMatrixTextureData = new Float32Array(bonesMatrix);
    const boneMatrixTextureDataInt = new Uint32Array(boneTextureSize.x * boneTextureSize.y * 4);

    if (useFlameModel) {
        // Encode bone matrices
        for (let c = 0; c < bonesNum * 16; c++) {
            boneMatrixTextureDataInt[c] = uintEncodedFloat(boneMatrixTextureData[c]);
        }
        
        // Set skeleton uniforms
        if (flameModel && flameModel.skeleton) {
            material.uniforms.boneTexture0.value = flameModel.skeleton.boneTexture;
            material.uniforms.bindMatrix.value = flameModel.bindMatrix;
            material.uniforms.bindMatrixInverse.value = flameModel.bindMatrixInverse;
        }
    }

    // Encode blendshape weights
    for (const key in bsWeight) {
        if (Object.hasOwn(bsWeight, key)) {
            const value = bsWeight[key];
            const idx = morphTargetDictionary[key];
            boneMatrixTextureDataInt[idx + bonesNum * 16] = uintEncodedFloat(value);
        }
    }

    const boneMatrixTex = new THREE.DataTexture(
        boneMatrixTextureDataInt,
        boneTextureSize.x,
        boneTextureSize.y,
        THREE.RGBAIntegerFormat,
        THREE.UnsignedIntType
    );
    boneMatrixTex.internalFormat = 'RGBA32UI';
    boneMatrixTex.needsUpdate = true;

    material.uniforms.boneTexture.value = boneMatrixTex;
    material.uniforms.boneTextureSize.value.copy(boneTextureSize);
    material.uniformsNeedUpdate = true;

    return {
        data: boneMatrixTextureDataInt,
        texture: boneMatrixTex,
        size: boneTextureSize,
        baseData: { boneMatrix: boneMatrixTextureDataInt }
    };
}

/**
 * Update bone matrix texture with new animation data
 * @param {object} splatDataTextures - Texture data storage
 * @param {Float32Array} bonesMatrix - Updated bone matrices
 * @param {number} bonesNum - Number of bones
 * @param {object} bsWeight - Updated blendshape weights
 * @param {object} morphTargetDictionary - Blendshape name to index map
 * @param {THREE.SkinnedMesh} flameModel - The FLAME mesh
 * @param {THREE.ShaderMaterial} material - The splat material
 * @param {boolean} updateFlameBoneMatrix - Whether to update bone matrices
 */
function updateBoneMatrixTexture(
    splatDataTextures,
    bonesMatrix,
    bonesNum,
    bsWeight,
    morphTargetDictionary,
    flameModel,
    material,
    updateFlameBoneMatrix = false
) {
    if (!bsWeight || !morphTargetDictionary) return;

    if (updateFlameBoneMatrix) {
        const boneMatrixTextureData = new Float32Array(bonesMatrix);
        for (let c = 0; c < bonesNum * 16; c++) {
            splatDataTextures.baseData['boneMatrix'][c] = uintEncodedFloat(boneMatrixTextureData[c]);
        }
    }

    // Update blendshape weights
    for (const key in bsWeight) {
        if (Object.hasOwn(bsWeight, key)) {
            const value = bsWeight[key];
            const idx = morphTargetDictionary[key];
            splatDataTextures.baseData['boneMatrix'][idx + bonesNum * 16] = uintEncodedFloat(value);
        }
    }

    // Update texture data
    splatDataTextures['boneMatrix']['texture'].data = splatDataTextures.baseData['boneMatrix'];
    splatDataTextures['boneMatrix']['texture'].needsUpdate = true;
    material.uniforms.boneTexture.value = splatDataTextures['boneMatrix']['texture'];

    // Update skeleton uniforms
    if (flameModel.skeleton) {
        material.uniforms.boneTexture0.value = flameModel.skeleton.boneTexture;
        material.uniforms.bindMatrix.value = flameModel.bindMatrix;
        material.uniforms.bindMatrixInverse.value = flameModel.bindMatrixInverse;
    }

    material.uniformsNeedUpdate = true;
}

/**
 * Build LBS weight texture for skin deformation
 * @param {THREE.SkinnedMesh} flameModel - The FLAME mesh
 * @param {Array} bonesWeight - Per-vertex bone weights array
 * @param {THREE.ShaderMaterial} material - The splat material
 * @returns {object} Texture data object
 */
function buildBoneWeightTexture(flameModel, bonesWeight, material) {
    const shapedMesh = flameModel.geometry.attributes.position.array;
    const pointNum = shapedMesh.length / 3;
    
    const boneWeightTextureSize = new THREE.Vector2(512, 512);
    const boneWeightTextureData = new Float32Array(boneWeightTextureSize.x * boneWeightTextureSize.y * 4);
    const boneWeightTextureDataInt = new Uint32Array(boneWeightTextureSize.x * boneWeightTextureSize.y * 4);

    for (let i = 0; i < pointNum; i++) {
        // Store 5 bone weights per vertex (2 texels)
        boneWeightTextureData[i * 8 + 0] = bonesWeight[i][0];
        boneWeightTextureData[i * 8 + 1] = bonesWeight[i][1];
        boneWeightTextureData[i * 8 + 2] = bonesWeight[i][2];
        boneWeightTextureData[i * 8 + 3] = bonesWeight[i][3];
        boneWeightTextureData[i * 8 + 4] = bonesWeight[i][4];

        boneWeightTextureDataInt[i * 8 + 0] = uintEncodedFloat(bonesWeight[i][0]);
        boneWeightTextureDataInt[i * 8 + 1] = uintEncodedFloat(bonesWeight[i][1]);
        boneWeightTextureDataInt[i * 8 + 2] = uintEncodedFloat(bonesWeight[i][2]);
        boneWeightTextureDataInt[i * 8 + 3] = uintEncodedFloat(bonesWeight[i][3]);
        boneWeightTextureDataInt[i * 8 + 4] = uintEncodedFloat(bonesWeight[i][4]);
    }

    const boneWeightTex = new THREE.DataTexture(
        boneWeightTextureDataInt,
        boneWeightTextureSize.x,
        boneWeightTextureSize.y,
        THREE.RGBAIntegerFormat,
        THREE.UnsignedIntType
    );
    boneWeightTex.internalFormat = 'RGBA32UI';
    boneWeightTex.needsUpdate = true;

    material.uniforms.boneWeightTexture.value = boneWeightTex;
    material.uniforms.boneWeightTextureSize.value.copy(boneWeightTextureSize);
    material.uniformsNeedUpdate = true;

    return {
        data: boneWeightTextureDataInt,
        texture: boneWeightTex,
        size: boneWeightTextureSize,
        baseData: { boneWeight: boneWeightTextureDataInt }
    };
}

/**
 * Get updated bone matrices from skeleton
 * @param {THREE.Skeleton} skeleton - The skeleton to read matrices from
 * @param {number} boneNum - Number of bones
 * @returns {Float32Array} Flattened bone matrices
 */
function getUpdatedBoneMatrices(skeleton, boneNum) {
    const updatedBoneMatrices = [];
    
    for (let j = 0; j < boneNum; j++) {
        const boneMatrix = skeleton.bones[j].matrixWorld.clone()
            .multiply(skeleton.boneInverses[j].clone());

        const elements = boneMatrix.elements;
        for (let i = 0; i < elements.length; i++) {
            updatedBoneMatrices.push(elements[i]);
        }
    }
    
    return new Float32Array(updatedBoneMatrices);
}

const FlameTextureManager = {
    buildModelTexture,
    buildBoneMatrixTexture,
    updateBoneMatrixTexture,
    buildBoneWeightTexture,
    getUpdatedBoneMatrices
};

/**
 * FlameAnimator
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * 
 * Handles FLAME model animation and skeleton updates:
 * - Bone rotation from FLAME parameters
 * - Blendshape weight updates
 * - Skeleton synchronization with gaussian splat mesh
 */


/**
 * FlameAnimator - Manages FLAME parametric head model animation
 */
class FlameAnimator {
    constructor() {
        this.skeleton = null;
        this.bones = null;
        this.flameParams = null;
        this.lbsWeight = null;
        this.frame = 0;
        this.totalFrames = 0;
        this.useFlame = true;
        this.avatarMesh = null;
        this.gaussianSplatCount = 0;
    }

    /**
     * Initialize with FLAME parameters and LBS weights
     * @param {object} flameParams - FLAME animation parameters
     * @param {object} boneTree - Skeleton hierarchy data
     * @param {Array} lbsWeight - LBS weights for each vertex
     * @param {THREE.SkinnedMesh} avatarMesh - The FLAME avatar mesh
     */
    initialize(flameParams, boneTree, lbsWeight, avatarMesh) {
        this.flameParams = flameParams;
        this.lbsWeight = lbsWeight;
        this.avatarMesh = avatarMesh;
        
        if (flameParams && flameParams.rotation) {
            this.totalFrames = flameParams.rotation.length;
        }

        this.gaussianSplatCount = avatarMesh.geometry.attributes.position.count;
        
        // Build skeleton from bone tree
        this.buildSkeleton(boneTree);
    }

    /**
     * Build skeleton from bone tree data
     * @param {object} boneTree - Skeleton hierarchy definition
     */
    buildSkeleton(boneTree) {
        if (!boneTree) return;

        this.bones = [];
        const boneInverses = [];

        // Create bones from tree structure
        const createBone = (boneData, parentBone = null) => {
            const bone = new THREE.Bone();
            bone.name = boneData.name || `bone_${this.bones.length}`;

            if (boneData.position) {
                bone.position.fromArray(boneData.position);
            }
            if (boneData.rotation) {
                bone.rotation.fromArray(boneData.rotation);
            }
            if (boneData.scale) {
                bone.scale.fromArray(boneData.scale);
            }

            if (parentBone) {
                parentBone.add(bone);
            }

            this.bones.push(bone);

            // Create inverse bind matrix
            const inverseMatrix = new THREE.Matrix4();
            if (boneData.inverseBindMatrix) {
                inverseMatrix.fromArray(boneData.inverseBindMatrix);
            } else {
                bone.updateMatrixWorld(true);
                inverseMatrix.copy(bone.matrixWorld).invert();
            }
            boneInverses.push(inverseMatrix);

            // Process children
            if (boneData.children) {
                boneData.children.forEach(child => createBone(child, bone));
            }
        };

        // If boneTree is array, create bones directly
        if (Array.isArray(boneTree)) {
            boneTree.forEach((boneData, index) => {
                const bone = new THREE.Bone();
                bone.name = boneData.name || `bone_${index}`;
                
                if (boneData.position) {
                    bone.position.fromArray(boneData.position);
                }
                
                this.bones.push(bone);
                
                const inverseMatrix = new THREE.Matrix4();
                if (boneData.inverseBindMatrix) {
                    inverseMatrix.fromArray(boneData.inverseBindMatrix);
                }
                boneInverses.push(inverseMatrix);
            });

            // Set up hierarchy (FLAME: root -> neck -> jaw, eyes)
            if (this.bones.length >= 5) {
                this.bones[0].add(this.bones[1]); // root -> neck
                this.bones[1].add(this.bones[2]); // neck -> jaw
                this.bones[1].add(this.bones[3]); // neck -> leftEye
                this.bones[1].add(this.bones[4]); // neck -> rightEye
            }
        } else if (boneTree.root) {
            createBone(boneTree.root);
        }

        // Create skeleton
        this.skeleton = new THREE.Skeleton(this.bones, boneInverses);
    }

    /**
     * Set bone rotation from axis-angle or quaternion
     * @param {THREE.Bone} bone - Target bone
     * @param {Array} angles - Rotation values
     * @param {boolean} isQuat - Whether angles are quaternion
     */
    setBoneRotation(bone, angles, isQuat = false) {
        let quaternion;
        
        if (isQuat) {
            quaternion = new THREE.Quaternion(angles[0], angles[1], angles[2], angles[3]);
        } else {
            // Axis-angle representation
            const value = new THREE.Vector3(angles[0], angles[1], angles[2]);
            const angleInRadians = value.length();
            const axis = value.normalize();
            quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angleInRadians);
        }
        
        bone.quaternion.copy(quaternion);
        bone.updateMatrixWorld(true);
    }

    /**
     * Update FLAME bones from current frame parameters
     */
    updateFlameBones() {
        if (!this.flameParams || !this.skeleton) return {};

        const frame = this.frame;
        const bsWeight = this.flameParams['expr'][frame];

        // Root bone rotation
        const rootAngle = this.flameParams['rotation'][frame];
        this.setBoneRotation(this.skeleton.bones[0], rootAngle);

        // Neck rotation
        const neckAngle = this.flameParams['neck_pose'][frame];
        this.setBoneRotation(this.skeleton.bones[1], neckAngle);

        // Jaw rotation
        const jawAngle = this.flameParams['jaw_pose'][frame];
        this.setBoneRotation(this.skeleton.bones[2], jawAngle);

        // Eyes rotation (combined in eyes_pose array)
        const eyesAngle = this.flameParams['eyes_pose'][frame];
        this.setBoneRotation(this.skeleton.bones[3], eyesAngle);
        this.setBoneRotation(this.skeleton.bones[4], [eyesAngle[3], eyesAngle[4], eyesAngle[5]]);

        // Update skeleton matrices
        this.skeleton.update();

        // Get updated bone matrices
        const numBones = 5;
        const bonesMatrix = FlameTextureManager.getUpdatedBoneMatrices(this.skeleton, numBones);

        return {
            bsWeight,
            bonesMatrix,
            bonesNum: numBones,
            bonesWeight: this.lbsWeight
        };
    }

    /**
     * Run morph update - main animation loop function
     * @param {SplatMesh} splatMesh - The gaussian splat mesh to update
     */
    runMorphUpdate(splatMesh) {
        const morphedMesh = new Float32Array(
            this.avatarMesh.geometry.attributes.position.array
        );

        splatMesh.gaussianSplatCount = this.gaussianSplatCount;
        splatMesh.bonesNum = 5;

        if (this.useFlame) {
            const updateData = this.updateFlameBones();
            splatMesh.bsWeight = updateData.bsWeight;
            splatMesh.bonesMatrix = updateData.bonesMatrix;
            splatMesh.bonesNum = updateData.bonesNum;
            splatMesh.bonesWeight = updateData.bonesWeight;
        }

        splatMesh.morphedMesh = morphedMesh;

        // Update textures
        const splatNum = splatMesh.morphedMesh.length / 3;
        if (splatMesh.splatDataTextures && splatMesh.splatDataTextures['flameModel']) {
            splatMesh.updateTextureAfterBSAndSkeleton(0, splatNum - 1, this.useFlame);
        }
    }

    /**
     * Set current animation frame
     * @param {number} frame - Frame number
     */
    setFrame(frame) {
        this.frame = frame % this.totalFrames;
    }

    /**
     * Advance to next frame
     */
    nextFrame() {
        this.frame = (this.frame + 1) % this.totalFrames;
    }

    /**
     * Get skeleton for external use
     */
    getSkeleton() {
        return this.skeleton;
    }

    /**
     * Get current frame number
     */
    getFrame() {
        return this.frame;
    }

    /**
     * Get total frame count
     */
    getTotalFrames() {
        return this.totalFrames;
    }
}

exports.ARKIT_BLENDSHAPES_COUNT = ARKIT_BLENDSHAPES_COUNT;
exports.ARKitBlendshapes = ARKitBlendshapes;
exports.AbortedPromiseError = AbortedPromiseError;
exports.AnimationManager = AnimationManager;
exports.BASE_COMPONENT_COUNT = BASE_COMPONENT_COUNT$1;
exports.CENTER_COLORS_ELEMENTS_PER_SPLAT = CENTER_COLORS_ELEMENTS_PER_SPLAT$1;
exports.CENTER_COLORS_ELEMENTS_PER_TEXEL = CENTER_COLORS_ELEMENTS_PER_TEXEL$1;
exports.CONSECUTIVE_RENDERED_FRAMES_FOR_FPS_CALCULATION = CONSECUTIVE_RENDERED_FRAMES_FOR_FPS_CALCULATION;
exports.COVARIANCES_ELEMENTS_PER_SPLAT = COVARIANCES_ELEMENTS_PER_SPLAT$1;
exports.COVARIANCES_ELEMENTS_PER_TEXEL_ALLOCATED = COVARIANCES_ELEMENTS_PER_TEXEL_ALLOCATED$1;
exports.COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_ALLOCATED = COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_ALLOCATED$1;
exports.COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_STORED = COVARIANCES_ELEMENTS_PER_TEXEL_COMPRESSED_STORED$1;
exports.COVARIANCES_ELEMENTS_PER_TEXEL_STORED = COVARIANCES_ELEMENTS_PER_TEXEL_STORED$1;
exports.Constants = Constants$1;
exports.DefaultSphericalHarmonics8BitCompressionHalfRange = DefaultSphericalHarmonics8BitCompressionHalfRange;
exports.DefaultSphericalHarmonics8BitCompressionRange = DefaultSphericalHarmonics8BitCompressionRange;
exports.DirectLoadError = DirectLoadError;
exports.FLAME_BONES_COUNT = FLAME_BONES_COUNT;
exports.FOCUS_MARKER_FADE_IN_SPEED = FOCUS_MARKER_FADE_IN_SPEED;
exports.FOCUS_MARKER_FADE_OUT_SPEED = FOCUS_MARKER_FADE_OUT_SPEED;
exports.FieldSize = FieldSize;
exports.FieldSizeStringMap = FieldSizeStringMap;
exports.FlameAnimator = FlameAnimator;
exports.FlameBoneNames = FlameBoneNames;
exports.FlameConstants = Constants;
exports.FlameTextureManager = FlameTextureManager;
exports.GaussianSplatRenderer = GaussianSplatRenderer;
exports.Hello = Hello;
exports.Hit = Hit;
exports.INRIAV1PlyParser = INRIAV1PlyParser;
exports.Idle = Idle;
exports.InternalLoadType = InternalLoadType;
exports.Listen = Listen;
exports.LoaderStatus = LoaderStatus;
exports.LoaderUtils = LoaderUtils;
exports.LogLevel = LogLevel;
exports.MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT = MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT;
exports.MIN_SPLAT_COUNT_TO_SHOW_SPLAT_TREE_LOADING_SPINNER = MIN_SPLAT_COUNT_TO_SHOW_SPLAT_TREE_LOADING_SPINNER;
exports.PlyFormat = PlyFormat;
exports.PlyLoader = PlyLoader;
exports.PlyParser = PlyParser;
exports.PlyParserUtils = PlyParserUtils;
exports.Ray = Ray;
exports.Raycaster = Raycaster;
exports.RenderMode = RenderMode;
exports.SCALES_ROTATIONS_ELEMENTS_PER_TEXEL = SCALES_ROTATIONS_ELEMENTS_PER_TEXEL$1;
exports.SCENE_FADEIN_RATE_FAST = SCENE_FADEIN_RATE_FAST$1;
exports.SCENE_FADEIN_RATE_GRADUAL = SCENE_FADEIN_RATE_GRADUAL$1;
exports.SCENE_INDEXES_ELEMENTS_PER_TEXEL = SCENE_INDEXES_ELEMENTS_PER_TEXEL$1;
exports.SceneFormat = SceneFormat;
exports.SceneRevealMode = SceneRevealMode;
exports.Semver = Semver;
exports.Speak = Speak;
exports.SplatBuffer = SplatBuffer;
exports.SplatBufferGenerator = SplatBufferGenerator;
exports.SplatGeometry = SplatGeometry;
exports.SplatMaterial = SplatMaterial;
exports.SplatMaterial2D = SplatMaterial2D;
exports.SplatMaterial3D = SplatMaterial3D;
exports.SplatMesh = SplatMesh;
exports.SplatPartitioner = SplatPartitioner;
exports.SplatRenderMode = SplatRenderMode;
exports.SplatScene = SplatScene;
exports.SplatTree = SplatTree;
exports.State = State;
exports.THREE_CAMERA_FOV = THREE_CAMERA_FOV;
exports.TYVoiceChatState = TYVoiceChatState;
exports.TextureConstants = TextureConstants;
exports.Think = Think;
exports.UncompressedSplatArray = UncompressedSplatArray;
exports.Viewer = Viewer;
exports.abortablePromiseWithExtractedComponents = abortablePromiseWithExtractedComponents;
exports.buildBoneMatrixTexture = buildBoneMatrixTexture;
exports.buildBoneWeightTexture = buildBoneWeightTexture;
exports.buildModelTexture = buildModelTexture;
exports.clamp = clamp;
exports.convertBetweenCompressionLevels = convertBetweenCompressionLevels;
exports.copyBetweenBuffers = copyBetweenBuffers$1;
exports.dataViewFloatForCompressionLevel = dataViewFloatForCompressionLevel$1;
exports.delayedExecute = delayedExecute;
exports.disposeAllMeshes = disposeAllMeshes;
exports.fetchWithProgress = fetchWithProgress;
exports.floatToHalf = floatToHalf;
exports.fromHalfFloat = fromHalfFloat$1;
exports.fromHalfFloatToUint8 = fromHalfFloatToUint8$1;
exports.fromUint8 = fromUint8$1;
exports.fromUint8ToHalfFloat = fromUint8ToHalfFloat;
exports.getCurrentTime = getCurrentTime;
exports.getIOSSemever = getIOSSemever;
exports.getSphericalHarmonicsComponentCountForDegree = getSphericalHarmonicsComponentCountForDegree;
exports.getUpdatedBoneMatrices = getUpdatedBoneMatrices;
exports.isIOS = isIOS;
exports.nativePromiseWithExtractedComponents = nativePromiseWithExtractedComponents;
exports.rgbaArrayToInteger = rgbaArrayToInteger;
exports.rgbaToInteger = rgbaToInteger;
exports.sceneFormatFromPath = sceneFormatFromPath;
exports.toHalfFloat = toHalfFloat$1;
exports.toUint8 = toUint8$1;
exports.toUncompressedFloat = toUncompressedFloat$1;
exports.uintEncodedFloat = uintEncodedFloat$1;
exports.updateBoneMatrixTexture = updateBoneMatrixTexture;
//# sourceMappingURL=gsplat-flame-avatar-renderer.cjs.js.map
