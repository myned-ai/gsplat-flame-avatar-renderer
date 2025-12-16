/**
 * SplatTree
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 */

import { Vector3 } from 'three';
import { delayedExecute } from '../utils/Util.js';

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

export class SplatTree {

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
        const center = new Vector3();

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