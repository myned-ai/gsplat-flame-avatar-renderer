/**
 * PlyLoader - Loads and parses PLY format Gaussian Splat files
 *
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 *
 * Simplified for FLAME avatar - only supports INRIAV1 PLY format.
 * Provides both progressive streaming and file-based loading.
 */

import { Vector3 } from 'three';
import { SplatBuffer } from '../buffers/SplatBuffer.js';
import { UncompressedSplatArray } from '../buffers/UncompressedSplatArray.js';
import { SplatBufferGenerator } from '../buffers/SplatBufferGenerator.js';
import { PlyParser } from './PlyParser.js';
import { PlyParserUtils } from './PlyParserUtils.js';
import { INRIAV1PlyParser } from './INRIAV1PlyParser.js';
import { Constants, InternalLoadType, LoaderStatus } from '../enums/EngineConstants.js';
import { fetchWithProgress, delayedExecute, nativePromiseWithExtractedComponents } from '../utils/Util.js';
import { getLogger } from '../utils/Logger.js';
import { ValidationError, NetworkError, ParseError, AssetLoadError } from '../errors/index.js';
import { validateUrl, validateCallback, validateArrayBuffer } from '../utils/ValidationUtils.js';

const logger = getLogger('PlyLoader');

/**
 * Store data chunks into a single ArrayBuffer
 *
 * Combines multiple downloaded chunks into a contiguous buffer for parsing.
 * Reallocates buffer if needed to fit all chunks.
 *
 * @private
 * @param {Array<{data: Uint8Array, sizeBytes: number}>} chunks - Array of data chunks
 * @param {ArrayBuffer} [buffer] - Existing buffer to reuse (will reallocate if too small)
 * @returns {ArrayBuffer} Buffer containing all chunk data
 */
function storeChunksInBuffer(chunks, buffer) {
    let inBytes = 0;
    for (let chunk of chunks) {
        inBytes += chunk.sizeBytes;
    }

    // Reallocate if buffer doesn't exist or is too small
    if (!buffer || buffer.byteLength < inBytes) {
        buffer = new ArrayBuffer(inBytes);
    }

    // Copy all chunks into buffer sequentially
    let offset = 0;
    for (let chunk of chunks) {
        new Uint8Array(buffer, offset, chunk.sizeBytes).set(chunk.data);
        offset += chunk.sizeBytes;
    }

    return buffer;
}

/**
 * Finalize splat data into a SplatBuffer
 *
 * Converts UncompressedSplatArray into final optimized SplatBuffer format.
 * Applies compression and optimization if requested.
 *
 * @private
 * @param {UncompressedSplatArray} splatData - Parsed splat data
 * @param {boolean} optimizeSplatData - Whether to optimize/compress the data
 * @param {number} minimumAlpha - Minimum alpha threshold for splat culling
 * @param {number} compressionLevel - Compression level (0-2)
 * @param {number} sectionSize - Section size for partitioning
 * @param {Vector3} sceneCenter - Center point of the scene
 * @param {number} blockSize - Block size for spatial partitioning
 * @param {number} bucketSize - Bucket size for sorting
 * @returns {SplatBuffer} Finalized splat buffer ready for rendering
 * @throws {ParseError} If splat data is invalid or finalization fails
 */
function finalizeSplatData(splatData, optimizeSplatData, minimumAlpha, compressionLevel, sectionSize, sceneCenter, blockSize, bucketSize) {
    try {
        if (optimizeSplatData) {
            const splatBufferGenerator = SplatBufferGenerator.getStandardGenerator(
                minimumAlpha,
                compressionLevel,
                sectionSize,
                sceneCenter,
                blockSize,
                bucketSize
            );
            return splatBufferGenerator.generateFromUncompressedSplatArray(splatData);
        } else {
            return SplatBuffer.generateFromUncompressedSplatArrays([splatData], minimumAlpha, 0, new Vector3());
        }
    } catch (error) {
        throw new ParseError(
            `Failed to finalize splat data: ${error.message}`,
            'splatData',
            error
        );
    }
}

/**
 * PlyLoader - Loads and parses PLY format Gaussian Splat files
 *
 * Supports both progressive streaming and complete file loading.
 * Optimized for INRIAV1 PLY format used in FLAME avatars.
 */
export class PlyLoader {

    /**
     * Load PLY file from URL with progressive streaming support
     *
     * Downloads and parses PLY data progressively, enabling render during load.
     * Supports both direct-to-buffer and array-based loading modes.
     *
     * @static
     * @param {string} fileName - URL to the PLY file
     * @param {Function} [onProgress] - Progress callback (percent, percentLabel, status)
     * @param {boolean} [loadDirectoToSplatBuffer=false] - Load directly to SplatBuffer (faster but less flexible)
     * @param {Function} [onProgressiveLoadSectionProgress] - Callback for progressive section updates
     * @param {number} [minimumAlpha=1] - Minimum alpha threshold for splat culling
     * @param {number} [compressionLevel=0] - Compression level (0=none, 1=medium, 2=high)
     * @param {boolean} [optimizeSplatData=true] - Whether to optimize/compress splat data
     * @param {number} [outSphericalHarmonicsDegree=0] - Spherical harmonics degree (0-3)
     * @param {Object} [headers] - HTTP headers for fetch request
     * @param {number} [sectionSize] - Section size for partitioning
     * @param {Vector3} [sceneCenter] - Center point of the scene
     * @param {number} [blockSize] - Block size for spatial partitioning
     * @param {number} [bucketSize] - Bucket size for sorting
     * @returns {Promise<SplatBuffer>} Loaded and parsed splat buffer
     * @throws {ValidationError} If parameters are invalid
     * @throws {NetworkError} If file download fails
     * @throws {ParseError} If PLY parsing fails
     * @throws {AssetLoadError} If asset loading fails
     */
    static loadFromURL(fileName, onProgress, loadDirectoToSplatBuffer, onProgressiveLoadSectionProgress,
                       minimumAlpha, compressionLevel, optimizeSplatData = true, outSphericalHarmonicsDegree = 0,
                       headers, sectionSize, sceneCenter, blockSize, bucketSize) {

        // Validate required parameters
        try {
            validateUrl(fileName);
        } catch (error) {
            logger.error('Invalid URL provided to loadFromURL', { fileName, error });
            throw error;
        }

        // Validate optional callbacks
        if (onProgress) {
            validateCallback(onProgress, 'onProgress', false);
        }
        if (onProgressiveLoadSectionProgress) {
            validateCallback(onProgressiveLoadSectionProgress, 'onProgressiveLoadSectionProgress', false);
        }

        logger.info('Loading PLY from URL', { fileName, optimizeSplatData, outSphericalHarmonicsDegree });

        let internalLoadType = loadDirectoToSplatBuffer ? InternalLoadType.DirectToSplatBuffer : InternalLoadType.DirectToSplatArray;
        if (optimizeSplatData) internalLoadType = InternalLoadType.DirectToSplatArray;

        const directLoadSectionSizeBytes = Constants.ProgressiveLoadSectionSize;
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
                        // FLAME avatars use INRIAV1 format - parse header
                        try {
                            header = inriaV1PlyParser.decodeHeaderText(headerText);
                            maxSplatCount = header.splatCount;
                            readyToLoadSplatData = true;

                            logger.debug('PLY header decoded', {
                                splatCount: maxSplatCount,
                                sphericalHarmonicsDegree: header.sphericalHarmonicsDegree
                            });

                            outSphericalHarmonicsDegree = Math.min(outSphericalHarmonicsDegree, header.sphericalHarmonicsDegree);
                        } catch (error) {
                            const parseError = new ParseError(
                                `Failed to decode PLY header: ${error.message}`,
                                'headerText',
                                error
                            );
                            logger.error('Header parsing failed', parseError);
                            loadPromise.reject(parseError);
                            return;
                        }

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
                                sceneCenter: new Vector3()
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

                            // Parse splat data with error handling
                            try {
                                if (internalLoadType === InternalLoadType.DirectToSplatBuffer) {
                                    inriaV1PlyParser.parseToUncompressedSplatBufferSection(
                                        header, 0, addedSplatCount - 1, dataToParse,
                                        0, directLoadBufferOut, outOffset,
                                        outSphericalHarmonicsDegree
                                    );
                                } else {
                                    inriaV1PlyParser.parseToUncompressedSplatArraySection(
                                        header, 0, addedSplatCount - 1, dataToParse,
                                        0, standardLoadUncompressedSplatArray,
                                        outSphericalHarmonicsDegree
                                    );
                                }
                            } catch (error) {
                                const parseError = new ParseError(
                                    `Failed to parse splat data section: ${error.message}`,
                                    'splatData',
                                    error
                                );
                                logger.error('Splat data parsing failed', { splatCount, addedSplatCount, error });
                                loadPromise.reject(parseError);
                                return;
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

            // Progress callback with error isolation
            if (onProgress) {
                try {
                    onProgress(percent, percentLabel, LoaderStatus.Downloading);
                } catch (error) {
                    logger.warn('Error in onProgress callback', error);
                }
            }
        };

        // Initial progress callback
        if (onProgress) {
            try {
                onProgress(0, '0%', LoaderStatus.Downloading);
            } catch (error) {
                logger.warn('Error in onProgress callback', error);
            }
        }

        // Fetch and process the PLY file
        return fetchWithProgress(fileName, localOnProgress, false, headers)
            .then(() => {
                if (onProgress) {
                    try {
                        onProgress(0, '0%', LoaderStatus.Processing);
                    } catch (error) {
                        logger.warn('Error in onProgress callback', error);
                    }
                }
                return loadPromise.promise;
            })
            .then((splatData) => {
                if (onProgress) {
                    try {
                        onProgress(100, '100%', LoaderStatus.Done);
                    } catch (error) {
                        logger.warn('Error in onProgress callback', error);
                    }
                }

                logger.debug('PLY data loaded successfully', {
                    internalLoadType,
                    splatCount: splatData?.splatCount || 'unknown'
                });

                // Process based on load type
                if (internalLoadType === InternalLoadType.DownloadBeforeProcessing) {
                    const chunkDatas = chunks.map((chunk) => chunk.data);
                    return new Blob(chunkDatas).arrayBuffer()
                        .then((plyFileData) => {
                            return PlyLoader.loadFromFileData(
                                plyFileData, minimumAlpha, compressionLevel, optimizeSplatData,
                                outSphericalHarmonicsDegree, sectionSize, sceneCenter, blockSize, bucketSize
                            );
                        })
                        .catch((error) => {
                            throw new AssetLoadError(
                                `Failed to process downloaded PLY data: ${error.message}`,
                                fileName,
                                error
                            );
                        });
                } else if (internalLoadType === InternalLoadType.DirectToSplatBuffer) {
                    return splatData;
                } else {
                    return delayedExecute(() => {
                        return finalizeSplatData(
                            splatData, optimizeSplatData, minimumAlpha, compressionLevel,
                            sectionSize, sceneCenter, blockSize, bucketSize
                        );
                    });
                }
            })
            .catch((error) => {
                // Re-throw custom errors as-is
                if (error instanceof ValidationError ||
                    error instanceof NetworkError ||
                    error instanceof ParseError ||
                    error instanceof AssetLoadError) {
                    logger.error('PLY loading failed', { fileName, errorCode: error.code });
                    throw error;
                }

                // Wrap unexpected errors
                logger.error('Unexpected error loading PLY', { fileName, error });
                throw new AssetLoadError(
                    `Unexpected error loading PLY file: ${error.message}`,
                    fileName,
                    error
                );
            });
    }

    /**
     * Load PLY file from raw ArrayBuffer data
     *
     * Parses PLY data that has already been downloaded. Useful for loading
     * from local files or when data is provided directly.
     *
     * @static
     * @param {ArrayBuffer} plyFileData - Raw PLY file data as ArrayBuffer
     * @param {number} [minimumAlpha=1] - Minimum alpha threshold for splat culling
     * @param {number} [compressionLevel=0] - Compression level (0=none, 1=medium, 2=high)
     * @param {boolean} [optimizeSplatData=true] - Whether to optimize/compress splat data
     * @param {number} [outSphericalHarmonicsDegree=0] - Spherical harmonics degree (0-3)
     * @param {number} [sectionSize] - Section size for partitioning
     * @param {Vector3} [sceneCenter] - Center point of the scene
     * @param {number} [blockSize] - Block size for spatial partitioning
     * @param {number} [bucketSize] - Bucket size for sorting
     * @returns {Promise<SplatBuffer>} Parsed and finalized splat buffer
     * @throws {ValidationError} If plyFileData is invalid
     * @throws {ParseError} If parsing fails
     */
    static loadFromFileData(plyFileData, minimumAlpha, compressionLevel, optimizeSplatData, outSphericalHarmonicsDegree = 0,
                            sectionSize, sceneCenter, blockSize, bucketSize) {
        // Validate input
        try {
            validateArrayBuffer(plyFileData, 'plyFileData');
        } catch (error) {
            logger.error('Invalid PLY file data', error);
            return Promise.reject(error);
        }

        logger.info('Loading PLY from file data', {
            sizeBytes: plyFileData.byteLength,
            optimizeSplatData,
            outSphericalHarmonicsDegree
        });

        return delayedExecute(() => {
            try {
                return PlyParser.parseToUncompressedSplatArray(plyFileData, outSphericalHarmonicsDegree);
            } catch (error) {
                throw new ParseError(
                    `Failed to parse PLY file data: ${error.message}`,
                    'plyFileData',
                    error
                );
            }
        })
        .then((splatArray) => {
            logger.debug('PLY parsed successfully', {
                splatCount: splatArray?.splatCount || 'unknown'
            });

            return finalizeSplatData(
                splatArray, optimizeSplatData, minimumAlpha, compressionLevel,
                sectionSize, sceneCenter, blockSize, bucketSize
            );
        })
        .catch((error) => {
            // Re-throw custom errors as-is
            if (error instanceof ValidationError || error instanceof ParseError) {
                logger.error('PLY file data loading failed', { errorCode: error.code });
                throw error;
            }

            // Wrap unexpected errors
            logger.error('Unexpected error loading PLY from file data', error);
            throw new ParseError(
                `Unexpected error parsing PLY data: ${error.message}`,
                'plyFileData',
                error
            );
        });
    }
}