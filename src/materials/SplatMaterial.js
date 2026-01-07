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

import { Color, DoubleSide, Matrix4, NormalBlending, ShaderMaterial, Vector2, Vector3 } from 'three';
import { Constants } from '../enums/EngineConstants.js';

export class SplatMaterial {

    static buildVertexShaderBase(dynamicMode = false, enableOptionalEffects = false, maxSphericalHarmonicsDegree = 0, customVars = '') {
        let vertexShaderSource = `#define USE_SKINNING

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
            uniform float sceneOpacity[${Constants.MaxScenes}];
            uniform int sceneVisibility[${Constants.MaxScenes}];
        `;
    }

    if (dynamicMode) {
        vertexShaderSource += `
            uniform highp mat4 transforms[${Constants.MaxScenes}];
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
        uniform float sphericalHarmonics8BitCompressionRangeMin[${Constants.MaxScenes}];
        uniform float sphericalHarmonics8BitCompressionRangeMax[${Constants.MaxScenes}];

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
                'value': new Vector3()
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
                'value': new Matrix4()
            },
            'bindMatrixInverse': {
                'type': 'm4',
                'value': new Matrix4()
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
                'value': new Vector2()
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
                'value': new Vector2()
            },
            'basisViewport': {
                'type': 'v2',
                'value': new Vector2()
            },
            'debugColor': {
                'type': 'v3',
                'value': new Color()
            },
            'centersColorsTextureSize': {
                'type': 'v2',
                'value': new Vector2(1024, 1024)
            },
            'flameModelTextureSize': {
                'type': 'v2',
                'value': new Vector2(4096, 2048)
            },
            'boneTextureSize': {
                'type': 'v2',
                'value': new Vector2(4, 32)
            },
            'boneWeightTextureSize': {
                'type': 'v2',
                'value': new Vector2(512, 512)
            },
            
            'sphericalHarmonicsDegree': {
                'type': 'i',
                'value': maxSphericalHarmonicsDegree
            },
            'sphericalHarmonicsTextureSize': {
                'type': 'v2',
                'value': new Vector2(1024, 1024)
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
                'value': new Vector2(1024, 1024)
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
                'value': -1.0
            },
            'eyeBlinkLeft': {
                'type': 'f',
                'value': 0.0
            },
            'eyeBlinkRight': {
                'type': 'f',
                'value': 0.0
            }
        };
        for (let i = 0; i < Constants.MaxScenes; i++) {
            uniforms.sphericalHarmonics8BitCompressionRangeMin.value.push(-Constants.SphericalHarmonics8BitCompressionRange / 2.0);
            uniforms.sphericalHarmonics8BitCompressionRangeMax.value.push(Constants.SphericalHarmonics8BitCompressionRange / 2.0);
        }

        if (enableOptionalEffects) {
            const sceneOpacity = [];
            for (let i = 0; i < Constants.MaxScenes; i++) {
                sceneOpacity.push(1.0);
            }
            uniforms['sceneOpacity'] ={
                'type': 'f',
                'value': sceneOpacity
            };

            const sceneVisibility = [];
            for (let i = 0; i < Constants.MaxScenes; i++) {
                sceneVisibility.push(1);
            }
            uniforms['sceneVisibility'] ={
                'type': 'i',
                'value': sceneVisibility
            };
        }

        if (dynamicMode) {
            const transformMatrices = [];
            for (let i = 0; i < Constants.MaxScenes; i++) {
                transformMatrices.push(new Matrix4());
            }
            uniforms['transforms'] = {
                'type': 'mat4',
                'value': transformMatrices
            };
        }

        return uniforms;
    }

}

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
                 splatScale = 1.0, pointCloudModeEnabled = false, maxSphericalHarmonicsDegree = 0, kernel2DSize = 0.3) {

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
                                                                     maxSphericalHarmonicsDegree, customVertexVars);
        vertexShaderSource += SplatMaterial3D.buildVertexShaderProjection(antialiased, enableOptionalEffects,
                                                                          maxScreenSpaceSplatSize, kernel2DSize);
        const fragmentShaderSource = SplatMaterial3D.buildFragmentShader();

        const uniforms = SplatMaterial.getUniforms(dynamicMode, enableOptionalEffects,
                                                   maxSphericalHarmonicsDegree, splatScale, pointCloudModeEnabled);

        uniforms['covariancesTextureSize'] = {
            'type': 'v2',
            'value': new Vector2(1024, 1024)
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

        const material = new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShaderSource,
            fragmentShader: fragmentShaderSource,
            transparent: true,
            alphaTest: 1.0,
            blending: NormalBlending,
            depthTest: true,
            depthWrite: false,
            side: DoubleSide
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