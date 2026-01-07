/**
 * FlameAnimator - FLAME Parametric Head Model Animation Controller
 *
 * Derived from gaussian-splat-renderer-for-lam
 *
 * Manages FLAME (Faces Learned with an Articulated Model and Expressions) model animation:
 * - Skeletal bone rotation from FLAME parameters
 * - Blendshape weight updates for facial expressions
 * - Skeleton-mesh synchronization for gaussian splat rendering
 * - Linear blend skinning (LBS) with bone weights
 *
 * FLAME uses 5 bones: root, neck, jaw, left eye, right eye
 */

import {
    Matrix4,
    Bone,
    Skeleton
} from 'three';

import { FlameTextureManager } from './FlameTextureManager.js';
import { getLogger } from '../utils/Logger.js';
import { ValidationError, ResourceDisposedError } from '../errors/index.js';
import { validateRequiredProperties } from '../utils/ValidationUtils.js';
import { vector3Pool, quaternionPool } from '../utils/ObjectPool.js';

const logger = getLogger('FlameAnimator');

/**
 * FlameAnimator - Manages FLAME parametric head model animation
 *
 * Provides skeletal animation, blendshape morphing, and mesh deformation
 * for FLAME-based avatar heads with gaussian splatting rendering.
 */
export class FlameAnimator {
    /**
     * Create a FlameAnimator instance
     *
     * @constructor
     */
    constructor() {
        /** @type {THREE.Skeleton|null} FLAME skeleton with 5 bones */
        this.skeleton = null;

        /** @type {THREE.Bone[]|null} Array of skeleton bones */
        this.bones = null;

        /** @type {Object|null} FLAME animation parameters (rotation, expr, neck_pose, jaw_pose, eyes_pose) */
        this.flameParams = null;

        /** @type {Array|null} Linear blend skinning weights */
        this.lbsWeight = null;

        /** @type {number} Current animation frame */
        this.frame = 0;

        /** @type {number} Total frames in animation sequence */
        this.totalFrames = 0;

        /** @type {boolean} Whether FLAME mode is enabled */
        this.useFlame = true;

        /** @type {THREE.SkinnedMesh|null} The FLAME avatar mesh */
        this.avatarMesh = null;

        /** @type {number} Number of gaussian splats in the mesh */
        this.gaussianSplatCount = 0;

        /** @type {boolean} Whether animator has been disposed */
        this._disposed = false;

        logger.debug('FlameAnimator instance created');
    }

    /**
     * Assert animator is not disposed
     * @private
     * @throws {ResourceDisposedError} If animator has been disposed
     */
    _assertNotDisposed() {
        if (this._disposed) {
            throw new ResourceDisposedError('FlameAnimator has been disposed');
        }
    }

    /**
     * Initialize animator with FLAME parameters and skeleton data
     *
     * Sets up the FLAME animation system with parameters for bone rotations,
     * expressions, and linear blend skinning weights.
     *
     * @param {Object} flameParams - FLAME animation parameters
     * @param {Array} flameParams.rotation - Root bone rotations per frame (axis-angle)
     * @param {Array} flameParams.expr - Expression blendshape weights per frame
     * @param {Array} flameParams.neck_pose - Neck bone rotations per frame
     * @param {Array} flameParams.jaw_pose - Jaw bone rotations per frame
     * @param {Array} flameParams.eyes_pose - Eye bone rotations per frame (6 values: left 3, right 3)
     * @param {Object|Array} boneTree - Skeleton hierarchy definition
     * @param {Array} lbsWeight - Linear blend skinning weights for each vertex
     * @param {THREE.SkinnedMesh} avatarMesh - The FLAME avatar mesh
     * @throws {ValidationError} If required parameters are missing or invalid
     * @returns {void}
     */
    initialize(flameParams, boneTree, lbsWeight, avatarMesh) {
        this._assertNotDisposed();

        // Validate required parameters
        try {
            validateRequiredProperties(flameParams, ['rotation', 'expr', 'neck_pose', 'jaw_pose', 'eyes_pose'], 'flameParams');
        } catch (error) {
            logger.error('Invalid flameParams', error);
            throw error;
        }

        if (!avatarMesh || !avatarMesh.geometry || !avatarMesh.geometry.attributes || !avatarMesh.geometry.attributes.position) {
            const error = new ValidationError(
                'avatarMesh must have geometry with position attribute',
                'avatarMesh'
            );
            logger.error('Invalid avatarMesh', error);
            throw error;
        }

        logger.info('Initializing FlameAnimator', {
            frameCount: flameParams.rotation?.length,
            splatCount: avatarMesh.geometry.attributes.position.count
        });

        this.flameParams = flameParams;
        this.lbsWeight = lbsWeight;
        this.avatarMesh = avatarMesh;

        // Calculate total frames from rotation data
        if (flameParams.rotation && Array.isArray(flameParams.rotation)) {
            this.totalFrames = flameParams.rotation.length;
            logger.debug('Animation has frames', { totalFrames: this.totalFrames });
        } else {
            logger.warn('No rotation data found, totalFrames set to 0');
            this.totalFrames = 0;
        }

        this.gaussianSplatCount = avatarMesh.geometry.attributes.position.count;

        // Build skeleton from bone tree
        try {
            this.buildSkeleton(boneTree);
            logger.debug('Skeleton built successfully', { boneCount: this.bones?.length });
        } catch (error) {
            logger.error('Failed to build skeleton', error);
            throw new ValidationError(
                `Failed to build skeleton: ${error.message}`,
                'boneTree',
                error
            );
        }
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
     * Set bone rotation from axis-angle or quaternion representation
     *
     * Converts rotation data to quaternion and applies it to the bone.
     * Uses object pooling to avoid allocations in animation loop.
     *
     * @param {THREE.Bone} bone - Target bone to rotate
     * @param {Array<number>} angles - Rotation values (3 for axis-angle, 4 for quaternion)
     * @param {boolean} [isQuat=false] - Whether angles are quaternion [x, y, z, w]
     * @throws {ValidationError} If bone or angles are invalid
     * @returns {void}
     */
    setBoneRotation(bone, angles, isQuat = false) {
        this._assertNotDisposed();

        if (!bone || !angles || !Array.isArray(angles)) {
            throw new ValidationError(
                'bone and angles array are required',
                'bone/angles'
            );
        }

        // Use object pooling for temp objects
        const quaternion = quaternionPool.acquire();

        try {
            if (isQuat) {
                // Direct quaternion (XYZW format)
                if (angles.length < 4) {
                    throw new ValidationError('Quaternion requires 4 values', 'angles');
                }
                quaternion.set(angles[0], angles[1], angles[2], angles[3]);
            } else {
                // Axis-angle representation: [x, y, z] where magnitude is angle
                if (angles.length < 3) {
                    throw new ValidationError('Axis-angle requires 3 values', 'angles');
                }

                const axis = vector3Pool.acquire();
                try {
                    axis.set(angles[0], angles[1], angles[2]);
                    const angleInRadians = axis.length();
                    axis.normalize();
                    quaternion.setFromAxisAngle(axis, angleInRadians);
                } finally {
                    vector3Pool.release(axis);
                }
            }

            // Apply rotation to bone
            bone.quaternion.copy(quaternion);
            bone.updateMatrixWorld(true);
        } finally {
            quaternionPool.release(quaternion);
        }
    }

    /**
     * Update FLAME bones from current frame parameters
     *
     * Applies bone rotations for all 5 FLAME bones (root, neck, jaw, left eye, right eye)
     * from the current animation frame. Updates skeleton matrices and returns data
     * needed for mesh deformation.
     *
     * @returns {Object} Bone and blendshape data for rendering
     * @returns {Array} return.bsWeight - Expression blendshape weights for current frame
     * @returns {Float32Array} return.bonesMatrix - Updated bone transformation matrices
     * @returns {number} return.bonesNum - Number of bones (always 5 for FLAME)
     * @returns {Array} return.bonesWeight - LBS weights for vertices
     */
    updateFlameBones() {
        this._assertNotDisposed();

        if (!this.flameParams || !this.skeleton) {
            logger.warn('Cannot update bones: flameParams or skeleton not initialized');
            return {};
        }

        const frame = this.frame;

        // Get blendshape weights for this frame
        const bsWeight = this.flameParams['expr'][frame];

        // Apply bone rotations for current frame
        try {
            // Root bone rotation (global head orientation)
            const rootAngle = this.flameParams['rotation'][frame];
            this.setBoneRotation(this.skeleton.bones[0], rootAngle);

            // Neck rotation
            const neckAngle = this.flameParams['neck_pose'][frame];
            this.setBoneRotation(this.skeleton.bones[1], neckAngle);

            // Jaw rotation
            const jawAngle = this.flameParams['jaw_pose'][frame];
            this.setBoneRotation(this.skeleton.bones[2], jawAngle);

            // Eyes rotation (6 values: left eye xyz, right eye xyz)
            const eyesAngle = this.flameParams['eyes_pose'][frame];
            this.setBoneRotation(this.skeleton.bones[3], eyesAngle.slice(0, 3));          // Left eye
            this.setBoneRotation(this.skeleton.bones[4], eyesAngle.slice(3, 6));          // Right eye
        } catch (error) {
            logger.error('Error setting bone rotations', { frame, error });
            throw error;
        }

        // Update skeleton matrices after all rotations are set
        this.skeleton.update();

        // Get updated bone matrices for shader
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
     *
     * @param {number} frame - Frame number to set (will wrap if exceeds totalFrames)
     * @throws {ValidationError} If frame is not a valid number
     * @returns {void}
     */
    setFrame(frame) {
        this._assertNotDisposed();

        if (typeof frame !== 'number' || isNaN(frame)) {
            throw new ValidationError('frame must be a valid number', 'frame');
        }

        if (this.totalFrames > 0) {
            this.frame = ((frame % this.totalFrames) + this.totalFrames) % this.totalFrames; // Handle negative
        } else {
            this.frame = 0;
        }
    }

    /**
     * Advance to next frame in animation sequence
     *
     * Automatically wraps to frame 0 after reaching totalFrames.
     *
     * @returns {void}
     */
    nextFrame() {
        this._assertNotDisposed();

        if (this.totalFrames > 0) {
            this.frame = (this.frame + 1) % this.totalFrames;
        }
    }

    /**
     * Get skeleton for external use
     *
     * @returns {THREE.Skeleton|null} The FLAME skeleton or null if not initialized
     */
    getSkeleton() {
        this._assertNotDisposed();
        return this.skeleton;
    }

    /**
     * Get current frame number
     *
     * @returns {number} Current animation frame index
     */
    getFrame() {
        this._assertNotDisposed();
        return this.frame;
    }

    /**
     * Get total frame count
     *
     * @returns {number} Total number of animation frames
     */
    getTotalFrames() {
        this._assertNotDisposed();
        return this.totalFrames;
    }

    /**
     * Dispose animator and free resources
     *
     * Properly cleans up:
     * - Skeleton and bones
     * - References to meshes and parameters
     *
     * @returns {void}
     */
    dispose() {
        if (this._disposed) {
            logger.warn('FlameAnimator.dispose() called on already disposed instance');
            return;
        }

        logger.info('Disposing FlameAnimator');

        // Dispose skeleton (bones are part of skeleton)
        if (this.skeleton) {
            this.skeleton.dispose();
            this.skeleton = null;
        }

        // Nullify all references to aid GC
        this.bones = null;
        this.flameParams = null;
        this.lbsWeight = null;
        this.avatarMesh = null;

        // Reset state
        this.frame = 0;
        this.totalFrames = 0;
        this.gaussianSplatCount = 0;

        // Mark as disposed
        this._disposed = true;

        logger.debug('FlameAnimator disposed successfully');
    }
}

export default FlameAnimator;
