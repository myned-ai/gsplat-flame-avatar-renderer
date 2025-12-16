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

import {
    Vector3,
    Quaternion,
    Matrix4,
    Bone,
    Skeleton
} from 'three';

import { FlameTextureManager } from './FlameTextureManager.js';

/**
 * FlameAnimator - Manages FLAME parametric head model animation
 */
export class FlameAnimator {
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
            const bone = new Bone();
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
            const inverseMatrix = new Matrix4();
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
                const bone = new Bone();
                bone.name = boneData.name || `bone_${index}`;
                
                if (boneData.position) {
                    bone.position.fromArray(boneData.position);
                }
                
                this.bones.push(bone);
                
                const inverseMatrix = new Matrix4();
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
        this.skeleton = new Skeleton(this.bones, boneInverses);
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
            quaternion = new Quaternion(angles[0], angles[1], angles[2], angles[3]);
        } else {
            // Axis-angle representation
            const value = new Vector3(angles[0], angles[1], angles[2]);
            const angleInRadians = value.length();
            const axis = value.normalize();
            quaternion = new Quaternion().setFromAxisAngle(axis, angleInRadians);
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

export default FlameAnimator;
