/**
 * PlyParser
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Simplified for FLAME avatar - only supports INRIAV1 PLY format.
 */

import { INRIAV1PlyParser } from './INRIAV1PlyParser.js';

export class PlyParser {

    static parseToUncompressedSplatArray(plyBuffer, outSphericalHarmonicsDegree = 0) {
        // FLAME avatars use INRIAV1 PLY format
        return new INRIAV1PlyParser().parseToUncompressedSplatArray(plyBuffer, outSphericalHarmonicsDegree);
    }

}