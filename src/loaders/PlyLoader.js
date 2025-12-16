/**
 * PlyLoader
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Simplified for FLAME avatar - only supports INRIAV1 PLY format.
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
        return SplatBuffer.generateFromUncompressedSplatArrays([splatData], minimumAlpha, 0, new Vector3());
    }
}

export class PlyLoader {

    static loadFromURL(fileName, onProgress, loadDirectoToSplatBuffer, onProgressiveLoadSectionProgress,
                       minimumAlpha, compressionLevel, optimizeSplatData = true, outSphericalHarmonicsDegree = 0,
                       headers, sectionSize, sceneCenter, blockSize, bucketSize) {

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