/**
 * SplatMaterial3D
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Modified for FLAME avatar support:
 * - Extended vertex shader for FLAME integration
 */

import { DoubleSide, NormalBlending, ShaderMaterial, Vector2 } from 'three';
import { SplatMaterial } from './SplatMaterial.js';

export class SplatMaterial3D {

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
                 splatScale = 1.0, pointCloudModeEnabled = false, maxSphericalHarmonicsDegree = 0, kernel2DSize = 0.3, irisOcclusionConfig = null) {

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

        // Add a varying for iris splats
        let vertexShaderSource = SplatMaterial.buildVertexShaderBase(dynamicMode, enableOptionalEffects,
                                         maxSphericalHarmonicsDegree, customVertexVars);
        vertexShaderSource += SplatMaterial3D.buildVertexShaderProjection(antialiased, enableOptionalEffects,
                                          maxScreenSpaceSplatSize, kernel2DSize);
        const fragmentShaderSource = SplatMaterial3D.buildFragmentShader(irisOcclusionConfig);

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

    static buildFragmentShader(irisOcclusionConfig = null) {
        let fragmentShaderSource = `
            precision highp float;
            #include <common>

            uniform float eyeBlinkLeft;
            uniform float eyeBlinkRight;

            varying vec4 vColor;
            varying vec2 vUv;
            varying vec2 vPosition;
            varying vec2 vSplatIndex;
        `;

        fragmentShaderSource += `
            void main () {
                float A = dot(vPosition, vPosition);
                float opacity = exp(-0.5 * A) * vColor.a;
                if (opacity < 1.0 / 255.0)
                    discard;
                `;

        // Generate iris occlusion code only if config exists
        if (irisOcclusionConfig && (irisOcclusionConfig.right_iris || irisOcclusionConfig.left_iris)) {
            fragmentShaderSource += `
                float idx = vSplatIndex.x;
                `;

            // Generate right iris checks
            if (irisOcclusionConfig.right_iris && irisOcclusionConfig.right_iris.length > 0) {
                const rightConditions = irisOcclusionConfig.right_iris
                    .map(([start, end]) => `(idx >= ${start}.0 && idx <= ${end}.0)`)
                    .join(' ||\n                                   ');

                fragmentShaderSource += `
                // Check if this splat is part of right iris
                bool isRightIris = ${rightConditions};
                `;
            } else {
                fragmentShaderSource += `
                bool isRightIris = false;
                `;
            }

            // Generate left iris checks
            if (irisOcclusionConfig.left_iris && irisOcclusionConfig.left_iris.length > 0) {
                const leftConditions = irisOcclusionConfig.left_iris
                    .map(([start, end]) => `(idx >= ${start}.0 && idx <= ${end}.0)`)
                    .join(' ||\n                                  ');

                fragmentShaderSource += `
                // Check if this splat is part of left iris
                bool isLeftIris = ${leftConditions};
                `;
            } else {
                fragmentShaderSource += `
                bool isLeftIris = false;
                `;
            }

            fragmentShaderSource += `
                float finalOpacity = opacity;

                // Very narrow fade window at high blink values only
                // Iris stays visible until eye is almost completely closed
                if (isRightIris) {
                    float fadeFactor = 1.0 - smoothstep(0.5, 0.7, eyeBlinkRight);
                    finalOpacity = opacity * fadeFactor;
                } else if (isLeftIris) {
                    float fadeFactor = 1.0 - smoothstep(0.5, 0.7, eyeBlinkLeft);
                    finalOpacity = opacity * fadeFactor;
                }

                if (finalOpacity < 1.0 / 255.0)
                    discard;

                gl_FragColor = vec4(vColor.rgb, finalOpacity);
            }
        `;
        } else {
            // No iris occlusion - simple rendering
            fragmentShaderSource += `
                gl_FragColor = vec4(vColor.rgb, opacity);
            }
        `;
        }

        return fragmentShaderSource;
    }

}
