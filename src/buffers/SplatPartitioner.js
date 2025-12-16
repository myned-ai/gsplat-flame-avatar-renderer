/**
 * SplatPartitioner
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 * Import paths adjusted for gsplat-flame-avatar package structure.
 */

import { Vector3 } from 'three';
import { SplatBuffer } from './SplatBuffer.js';
import { UncompressedSplatArray } from './UncompressedSplatArray.js';

export class SplatPartitioner {

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

    static getStandardPartitioner(partitionSize = 0, sceneCenter = new Vector3(),
                                  blockSize = SplatBuffer.BucketBlockSize, bucketSize = SplatBuffer.BucketSize) {

        const partitionGenerator = (splatArray) => {

            const OFFSET_X = UncompressedSplatArray.OFFSET.X;
            const OFFSET_Y = UncompressedSplatArray.OFFSET.Y;
            const OFFSET_Z = UncompressedSplatArray.OFFSET.Z;

            if (partitionSize <= 0) partitionSize = splatArray.splatCount;

            const center = new Vector3();
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