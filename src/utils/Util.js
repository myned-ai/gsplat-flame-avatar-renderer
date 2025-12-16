/**
 * Core utility functions for Gaussian Splat rendering
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */

import { DataUtils } from 'three';

/**
 * Custom error for aborted operations
 */
export class AbortedPromiseError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'AbortedPromiseError';
    }
}

/**
 * Fetch with progress tracking using standard AbortController
 * Returns a Promise with an attached `abort()` method and `abortController`
 */
export const fetchWithProgress = function(path, onProgress, saveChunks = true, headers) {

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
export const clamp = function(val, min, max) {
    return Math.max(Math.min(val, max), min);
};

// Get current time in seconds
export const getCurrentTime = function() {
    return performance.now() / 1000;
};

// Dispose all meshes in a scene graph
export const disposeAllMeshes = (object3D) => {
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
export const delayedExecute = (func, fast) => {
    return new Promise((resolve) => {
        window.setTimeout(() => {
            resolve(func());
        }, fast ? 1 : 50);
    });
};

// Get spherical harmonics component count for degree
export const getSphericalHarmonicsComponentCountForDegree = (sphericalHarmonicsDegree = 0) => {
    switch (sphericalHarmonicsDegree) {
        case 1:
            return 9;
        case 2:
            return 24;
    }
    return 0;
};

// Create native promise with extracted components
export const nativePromiseWithExtractedComponents = () => {
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
export const abortablePromiseWithExtractedComponents = (abortHandler) => {
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
export class Semver {
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
export function isIOS() {
    const ua = navigator.userAgent;
    return ua.indexOf('iPhone') > 0 || ua.indexOf('iPad') > 0;
}

export function getIOSSemever() {
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
export const toHalfFloat = DataUtils.toHalfFloat.bind(DataUtils);
export const fromHalfFloat = DataUtils.fromHalfFloat.bind(DataUtils);

// Default spherical harmonics compression range (imported from enums)
import { DefaultSphericalHarmonics8BitCompressionRange } from '../enums/EngineConstants.js';
export { DefaultSphericalHarmonics8BitCompressionRange };
export const DefaultSphericalHarmonics8BitCompressionHalfRange = DefaultSphericalHarmonics8BitCompressionRange / 2.0;

// Uncompress float based on compression level
export const toUncompressedFloat = (f, compressionLevel, isSH = false, range8BitMin, range8BitMax) => {
    if (compressionLevel === 0) {
        return f;
    } else if (compressionLevel === 1 || (compressionLevel === 2 && !isSH)) {
        return DataUtils.fromHalfFloat(f);
    } else if (compressionLevel === 2) {
        return fromUint8(f, range8BitMin, range8BitMax);
    }
};

// Convert to uint8
export const toUint8 = (v, rangeMin, rangeMax) => {
    v = clamp(v, rangeMin, rangeMax);
    const range = (rangeMax - rangeMin);
    return clamp(Math.floor((v - rangeMin) / range * 255), 0, 255);
};

// Convert from uint8
export const fromUint8 = (v, rangeMin, rangeMax) => {
    const range = (rangeMax - rangeMin);
    return (v / 255 * range + rangeMin);
};

// Half float to uint8
export const fromHalfFloatToUint8 = (v, rangeMin, rangeMax) => {
    return toUint8(fromHalfFloat(v), rangeMin, rangeMax);
};

// Uint8 to half float
export const fromUint8ToHalfFloat = (v, rangeMin, rangeMax) => {
    return toHalfFloat(fromUint8(v, rangeMin, rangeMax));
};

// Read float from DataView based on compression level
export const dataViewFloatForCompressionLevel = (dataView, floatIndex, compressionLevel, isSH = false) => {
    if (compressionLevel === 0) {
        return dataView.getFloat32(floatIndex * 4, true);
    } else if (compressionLevel === 1 || (compressionLevel === 2 && !isSH)) {
        return dataView.getUint16(floatIndex * 2, true);
    } else {
        return dataView.getUint8(floatIndex, true);
    }
};

// Convert between compression levels
export const convertBetweenCompressionLevels = function() {
    const noop = (v) => v;

    return function(val, fromLevel, toLevel, isSH = false) {
        if (fromLevel === toLevel) return val;
        let outputConversionFunc = noop;

        if (fromLevel === 2 && isSH) {
            if (toLevel === 1) outputConversionFunc = fromUint8ToHalfFloat;
            else if (toLevel === 0) {
                outputConversionFunc = fromUint8;
            }
        } else if (fromLevel === 2 || fromLevel === 1) {
            if (toLevel === 0) outputConversionFunc = fromHalfFloat;
            else if (toLevel === 2) {
                if (!isSH) outputConversionFunc = noop;
                else outputConversionFunc = fromHalfFloatToUint8;
            }
        } else if (fromLevel === 0) {
            if (toLevel === 1) outputConversionFunc = toHalfFloat;
            else if (toLevel === 2) {
                if (!isSH) outputConversionFunc = toHalfFloat;
                else outputConversionFunc = toUint8;
            }
        }

        return outputConversionFunc(val);
    };
}();

// Copy between buffers
export const copyBetweenBuffers = (srcBuffer, srcOffset, destBuffer, destOffset, byteCount = 0) => {
    const src = new Uint8Array(srcBuffer, srcOffset);
    const dest = new Uint8Array(destBuffer, destOffset);
    for (let i = 0; i < byteCount; i++) {
        dest[i] = src[i];
    }
};

// Float to half float conversion
export const floatToHalf = function() {
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
export const uintEncodedFloat = function() {
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    return function(f) {
        floatView[0] = f;
        return int32View[0];
    };
}();

// RGBA to integer
export const rgbaToInteger = function(r, g, b, a) {
    return r + (g << 8) + (b << 16) + (a << 24);
};

// RGBA array to integer
export const rgbaArrayToInteger = function(arr, offset) {
    return arr[offset] + (arr[offset + 1] << 8) + (arr[offset + 2] << 16) + (arr[offset + 3] << 24);
};

// BASE_COMPONENT_COUNT for UncompressedSplatArray
export const BASE_COMPONENT_COUNT = 14;
