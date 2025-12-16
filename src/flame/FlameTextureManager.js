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

import {
    Vector2,
    DataTexture,
    RGBAIntegerFormat,
    UnsignedIntType
} from 'three';

import { uintEncodedFloat } from './utils.js';

/**
 * Build the FLAME model texture containing blendshape positions
 * @param {THREE.SkinnedMesh} flameModel - The FLAME mesh with morph targets
 * @param {THREE.ShaderMaterial} material - The splat material to update uniforms
 * @param {number} gaussianSplatCount - Number of gaussian splats
 * @returns {object} Texture data object
 */
export function buildModelTexture(flameModel, material, gaussianSplatCount) {
    const flameModelTexSize = new Vector2(4096, 2048);

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

    const flameModelTex = new DataTexture(
        flameModelDataInt,
        flameModelTexSize.x,
        flameModelTexSize.y,
        RGBAIntegerFormat,
        UnsignedIntType
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
export function buildBoneMatrixTexture(
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
    const boneTextureSize = new Vector2(4, 32);
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

    const boneMatrixTex = new DataTexture(
        boneMatrixTextureDataInt,
        boneTextureSize.x,
        boneTextureSize.y,
        RGBAIntegerFormat,
        UnsignedIntType
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
export function updateBoneMatrixTexture(
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
export function buildBoneWeightTexture(flameModel, bonesWeight, material) {
    const shapedMesh = flameModel.geometry.attributes.position.array;
    const pointNum = shapedMesh.length / 3;
    
    const boneWeightTextureSize = new Vector2(512, 512);
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

    const boneWeightTex = new DataTexture(
        boneWeightTextureDataInt,
        boneWeightTextureSize.x,
        boneWeightTextureSize.y,
        RGBAIntegerFormat,
        UnsignedIntType
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
export function getUpdatedBoneMatrices(skeleton, boneNum) {
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

export const FlameTextureManager = {
    buildModelTexture,
    buildBoneMatrixTexture,
    updateBoneMatrixTexture,
    buildBoneWeightTexture,
    getUpdatedBoneMatrices
};

export default FlameTextureManager;
