/**
 * GaussianSplatRenderer
 * 
 * Derived from gaussian-splat-renderer-for-lam
 * 
 * High-level orchestration class that:
 * - Loads ZIP assets via fetch
 * - Unpacks with JSZip
 * - Creates Viewer instance
 * - Loads FLAME/skin models
 * - Runs the render loop
 */

/* global NProgress */

import {
    Vector3,
    Bone,
    Clock,
    AnimationMixer
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import JSZip from 'jszip';

// Import internal modules
import { TYVoiceChatState } from './AppConstants.js';
import { AnimationManager } from './AnimationManager.js';
import { Viewer } from '../core/Viewer.js';
import { SceneFormat } from '../enums/SceneFormat.js';

// Configuration objects - these would normally be loaded from the ZIP
const charactorConfig = {
    camPos: { x: 0, y: 1.8, z: 1 },
    camRot: { x: -10, y: 0, z: 0 },
    backgroundColor: 'ffffff',
    useFlame: 'false'  // Match compact file default - use non-FLAME mode
};

const motionConfig = {
    offset: {},
    scale: {}
};

// Animation configuration - defines how animation clips are distributed to states
// The animation.glb contains clips in order: hello(2), idle(1), listen(0), speak(6), think(3)
const animationConfig = {
    hello: { size: 2, isGroup: false },
    idle: { size: 1, isGroup: false },
    listen: { size: 0, isGroup: false },
    speak: { size: 6, isGroup: false },
    think: { size: 3, isGroup: true },
    other: []
};

/**
 * GaussianSplatRenderer - Main rendering class
 */
export class GaussianSplatRenderer {
    // Static canvas element shared across instances
    static _canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    
    // Singleton instance
    static instance = undefined;

    /**
     * Factory method to create/get renderer instance
     * @param {HTMLElement} container - DOM container for canvas
     * @param {string} assetPath - URL to character ZIP file
     * @param {object} options - Configuration options
     * @returns {Promise<GaussianSplatRenderer>}
     */
    static async getInstance(container, assetPath, options = {}) {
        if (this.instance !== undefined) {
            return this.instance;
        }

        try {
            const characterPath = assetPath;
            
            // Parse character name from path
            const url = new URL(characterPath, window.location.href);
            const pathname = url.pathname;
            const matches = pathname.match(/\/([^/]+?)\.zip/);
            const characterName = matches && matches[1];
            
            if (!characterName) {
                throw new Error('character model is not found');
            }

            // Show progress
            if (typeof NProgress !== 'undefined') {
                NProgress.start();
            }

            // Download ZIP file
            const characterZipResponse = await fetch(characterPath);
            if (!characterZipResponse.ok) {
                throw new Error(`Failed to download: ${characterZipResponse.statusText}`);
            }

            // Report download progress
            if (options.downloadProgress) {
                options.downloadProgress(1.0);
            }

            if (options.loadProgress) {
                options.loadProgress(0.1);
            }

            if (typeof NProgress !== 'undefined') {
                NProgress.done();
            }

            const arrayBuffer = await characterZipResponse.arrayBuffer();
            
            // Load ZIP with imported JSZip
            const zipData = await JSZip.loadAsync(arrayBuffer);

            // Find folder name in ZIP
            let fileName = '';
            Object.values(zipData.files).forEach(file => {
                if (file.dir) {
                    fileName = file.name?.slice(0, file.name?.length - 1); // Remove trailing '/'
                }
            });

            if (!fileName) {
                throw new Error('file folder is not found');
            }

            // Create renderer instance
            const renderer = new GaussianSplatRenderer(container, zipData);

            // Setup camera position
            const cameraPos = new Vector3();
            cameraPos.x = charactorConfig.camPos?.x || 0;
            cameraPos.y = charactorConfig.camPos?.y || 0;
            cameraPos.z = charactorConfig.camPos?.z || 1;

            const cameraRotation = new Vector3();
            cameraRotation.x = charactorConfig.camRot?.x || 0;
            cameraRotation.y = charactorConfig.camRot?.y || 0;
            cameraRotation.z = charactorConfig.camRot?.z || 0;

            // Background color
            let backgroundColor = 0xffffff;
            if (charactorConfig.backgroundColor) {
                backgroundColor = parseInt(charactorConfig.backgroundColor, 16);
            }
            if (options?.backgroundColor && renderer.isHexColorStrict(options.backgroundColor)) {
                backgroundColor = parseInt(options.backgroundColor, 16);
            }

            // Store callbacks
            renderer.getChatState = options?.getChatState;
            renderer.getExpressionData = options?.getExpressionData;

            // FLAME mode flag
            if (charactorConfig.useFlame) {
                renderer.useFlame = (charactorConfig.useFlame === 'false') ? false : true;
            }

            // Create Viewer with imported class
            renderer.viewer = new Viewer({
                rootElement: container,
                threejsCanvas: GaussianSplatRenderer._canvas,
                cameraUp: [0, 1, 0],
                initialCameraPosition: [cameraPos.x, cameraPos.y, cameraPos.z],
                initialCameraRotation: [cameraRotation.x, cameraRotation.y, cameraRotation.z],
                sphericalHarmonicsDegree: 0,
                backgroundColor: backgroundColor
            });

            renderer.viewer.useFlame = renderer.useFlame;

            // Load model based on mode
            if (renderer.viewer.useFlame === true) {
                await renderer.loadFlameModel(fileName, motionConfig);
            } else {
                await renderer.loadModel(fileName, animationConfig, motionConfig);
            }

            if (options.loadProgress) {
                options.loadProgress(0.2);
            }

            // Load offset PLY
            const offsetFileUrl = await renderer.unpackFileAsBlob(fileName + '/offset.ply');

            if (options.loadProgress) {
                options.loadProgress(0.3);
            }

            // Add splat scene
            await renderer.viewer.addSplatScene(offsetFileUrl, {
                progressiveLoad: true,
                sharedMemoryForWorkers: false,
                showLoadingUI: false,
                format: SceneFormat.Ply
            });
            renderer.render();

            if (options.loadProgress) {
                options.loadProgress(1);
            }

            this.instance = renderer;
            return renderer;

        } catch (error) {
            console.error('GaussianSplatRenderer.getInstance error:', error);
            throw error;
        }
    }

    /**
     * Constructor
     * @param {HTMLElement} _container - DOM container
     * @param {JSZip} zipData - Loaded ZIP data
     */
    constructor(_container, zipData) {
        // ZIP file cache
        this.zipUrls = {
            urls: new Map(),
            zip: zipData
        };

        // State
        this.useFlame = false;
        this.lastTime = 0;
        this.startTime = 0;
        this.expressionData = {};
        this.chatState = TYVoiceChatState.Idle;

        // Setup canvas
        if (GaussianSplatRenderer._canvas && _container) {
            const { width, height } = _container.getBoundingClientRect();
            GaussianSplatRenderer._canvas.style.visibility = 'visible';
            GaussianSplatRenderer._canvas.width = width;
            GaussianSplatRenderer._canvas.height = height;
            _container.appendChild(GaussianSplatRenderer._canvas);
        }

        // Animation timing
        this.clock = new Clock();
        this.startTime = performance.now() / 1000.0;

        // These will be set during loading
        this.viewer = null;
        this.mixer = null;
        this.animManager = null;
        this.model = null;
        this.motioncfg = null;
        this.getChatState = null;
        this.getExpressionData = null;
    }

    /**
     * Dispose renderer and free resources
     */
    dispose() {
        if (GaussianSplatRenderer._canvas) {
            GaussianSplatRenderer._canvas.style.visibility = 'hidden';
        }
        
        this.disposeModel();
        
        // Revoke all blob URLs
        this.zipUrls.urls.forEach((value) => {
            URL.revokeObjectURL(value);
        });

        GaussianSplatRenderer.instance = undefined;
    }

    /**
     * Dispose model-specific resources
     */
    disposeModel() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            if (this.viewer?.avatarMesh) {
                this.mixer.uncacheRoot(this.viewer.avatarMesh);
            }
            this.mixer = undefined;
            this.animManager?.dispose();
        }
        this.viewer?.dispose();
    }

    /**
     * Get the Three.js camera
     * @returns {THREE.Camera}
     */
    getCamera() {
        return this.viewer?.camera;
    }

    /**
     * Update blendshape weights from action data
     * @param {object} actionData - Blendshape weights
     * @returns {object} Processed influence values
     */
    updateBS(actionData) {
        // Default influence values - all 52 ARKit blendshapes
        let influence = {
            browDownLeft: 0.0,
            browDownRight: 0.0,
            browInnerUp: 0.0,
            browOuterUpLeft: 0.0,
            browOuterUpRight: 0.0,
            mouthCheekPuff: 0.0,
            cheekSquintLeft: 0.0,
            cheekSquintRight: 0.0,
            eyeBlinkLeft: 0.0,
            eyeBlinkRight: 0.0,
            eyeLookDownLeft: 0.0,
            eyeLookDownRight: 0.0,
            eyeLookInLeft: 0.0,
            eyeLookInRight: 0.0,
            eyeLookOutLeft: 0.0,
            eyeLookOutRight: 0.0,
            eyeLookUpLeft: 0.0,
            eyeLookUpRight: 0.0,
            eyeSquintLeft: 0.0,
            eyeSquintRight: 0.0,
            eyeWideLeft: 0.0,
            eyeWideRight: 0.0,
            jawForward: 0.0,
            jawLeft: 0.0,
            jawOpen: 0.0,
            jawRight: 0.0,
            mouthClose: 0.0,
            mouthDimpleLeft: 0.0,
            mouthDimpleRight: 0.0,
            mouthFrownLeft: 0.0,
            mouthFrownRight: 0.0,
            mouthFunnel: 0.0,
            mouthLeft: 0.0,
            mouthLowerDownLeft: 0.0,
            mouthLowerDownRight: 0.0,
            mouthPressLeft: 0.0,
            mouthPressRight: 0.0,
            mouthPucker: 0.0,
            mouthRight: 0.0,
            mouthRollLower: 0.0,
            mouthRollUpper: 0.0,
            mouthShrugLower: 0.0,
            mouthShrugUpper: 0.0,
            mouthSmileLeft: 0.0,
            mouthSmileRight: 0.0,
            mouthStretchLeft: 0.0,
            mouthStretchRight: 0.0,
            mouthUpperUpLeft: 0.0,
            mouthUpperUpRight: 0.0,
            noseSneerLeft: 0.0,
            noseSneerRight: 0.0,
            tongueOut: 0.0
        };

        if (actionData != null) {
            influence = actionData;
        }

        return influence;
    }

    /**
     * Main render loop
     */
    render() {
        if (this.viewer && this.viewer.selfDrivenMode) {
            this.viewer.requestFrameId = requestAnimationFrame(() => this.render());

            const frameInfoInternal = 1.0 / 30.0;
            const currentTime = performance.now() / 1000;
            
            // Prevent division by zero if totalFrames is 0 or not set
            const totalFrames = this.viewer.totalFrames || 1;
            const calcDelta = (currentTime - this.startTime) % (totalFrames * frameInfoInternal);
            const frameIndex = Math.floor(calcDelta / frameInfoInternal);
            this.viewer.frame = frameIndex;

            // Update chat state
            if (this.getChatState) {
                this.chatState = this.getChatState();
                // DEBUG: Log state transitions
                if (!this._lastLoggedState || this._lastLoggedState !== this.chatState) {
                    console.log('[ANIM] Chat state changed to:', this.chatState, 'animManager exists:', !!this.animManager);
                    this._lastLoggedState = this.chatState;
                }
                this.animManager?.update(this.chatState);
            }

            // Update expression data
            if (this.getExpressionData) {
                this.expressionData = this.updateBS(this.getExpressionData());
            }

            // Non-FLAME mode: animation mixer
            if (this.viewer.useFlame === false) {
                if (!this.mixer || !this.animManager) {
                    if (!this._warnedOnce) {
                        console.warn('render: mixer or animManager not initialized, skipping animation update');
                        console.log('[ANIM] useFlame:', this.viewer.useFlame, 'mixer:', !!this.mixer, 'animManager:', !!this.animManager);
                        this._warnedOnce = true;
                    }
                } else {
                    const mixerUpdateDelta = this.clock.getDelta();
                    this.mixer.update(mixerUpdateDelta);

                    // Apply motion config offsets/scales
                    if (this.motioncfg) {
                        for (const morphTarget in this.expressionData) {
                            const offset = this.motioncfg.offset?.[morphTarget];
                            const scale = this.motioncfg.scale?.[morphTarget];
                            if (offset !== undefined && scale !== undefined) {
                                this.expressionData[morphTarget] = 
                                    this.expressionData[morphTarget] * scale + offset;
                            }
                        }
                    }

                    this.setExpression();
                }
            }

            // Update viewer
            this.viewer.update(this.viewer.renderer, this.viewer.camera);

            // Render if needed
            const shouldRender = this.viewer.shouldRender();
            if (this._renderLogCount <= 3) {
                console.log('[GS-DEBUG] shouldRender:', shouldRender);
            }
            if (shouldRender) {
                this.viewer.render();
                this.viewer.consecutiveRenderFrames++;
            } else {
                this.viewer.consecutiveRenderFrames = 0;
            }

            this.viewer.renderNextFrame = false;
            this.viewer.selfDrivenModeRunning = true;
        } else {
            throw new Error('Cannot start viewer unless it is in self driven mode.');
        }
    }

    /**
     * Validate hex color string
     * @param {string} value - Color string to validate
     * @returns {boolean}
     */
    isHexColorStrict(value) {
        if (typeof value !== 'string') return false;
        const hexColorRegex = /^(#|0x)[0-9A-Fa-f]{6}$/i;
        return hexColorRegex.test(value);
    }

    /**
     * Apply expression data to mesh
     */
    setExpression() {
        // Update splat mesh blendshapes
        if (this.viewer?.splatMesh) {
            this.viewer.splatMesh.bsWeight = this.expressionData;
        }

        // Update morph targets on avatar model
        if (this.model) {
            this.model.traverse((object) => {
                if (object.isMesh || object.isSkinnedMesh) {
                    const morphAttributes = object.geometry?.morphAttributes;
                    const hasMorphTargets = morphAttributes && Object.keys(morphAttributes).length > 0;
                    
                    if (hasMorphTargets) {
                        const morphTargetDictionary = object.morphTargetDictionary;
                        for (const morphTarget in morphTargetDictionary) {
                            const target = morphTargetDictionary[morphTarget];
                            const data = this.expressionData[morphTarget];
                            if (data !== undefined) {
                                object.morphTargetInfluences[target] = Math.max(0.0, Math.min(1.0, data));
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Load FLAME model from ZIP
     * @param {string} pathName - Path within ZIP
     * @param {object} motionConfig - Motion configuration
     */
    async loadFlameModel(pathName, motionConfig) {
        // Load all required files in parallel
        const [skinModel, lbs_weight_80k, flame_params, indexes, bone_tree] = await Promise.all([
            this.unpackAndLoadGlb(pathName + '/skin.glb'),
            this.unpackAndLoadJson(pathName + '/lbs_weight_20k.json'),
            this.unpackAndLoadJson(pathName + '/flame_params.json'),
            this.unpackAndLoadJson(pathName + '/vertex_order.json'),
            this.unpackAndLoadJson(pathName + '/bone_tree.json')
        ]);

        if (!this.viewer) {
            throw new Error('render viewer is not initialized');
        }

        // Find skinned mesh and bone root
        let skinModelSkinnedMesh;
        let boneRoot;
        
        skinModel.traverse((object) => {
            if (object.isSkinnedMesh) {
                skinModelSkinnedMesh = object;
            }
            if (object instanceof Bone && object.name === 'hip') {
                boneRoot = object;
            }
        });

        // Set viewer properties
        this.viewer.sortedIndexes = indexes;
        this.viewer.flame_params = flame_params;
        this.viewer.lbs_weight_80k = lbs_weight_80k;
        this.viewer.bone_tree = bone_tree;
        this.viewer.totalFrames = flame_params['expr']?.length || 1;

        if (skinModelSkinnedMesh) {
            this.viewer.gaussianSplatCount = skinModelSkinnedMesh.geometry.attributes.position.count;
        }

        this.viewer.avatarMesh = skinModel;
        this.viewer.skinModel = skinModelSkinnedMesh;
        this.viewer.boneRoot = boneRoot;
        this.motioncfg = motionConfig;

        // Update morph targets
        if (skinModelSkinnedMesh) {
            this.viewer.updateMorphTarget(skinModelSkinnedMesh);
        }

        // Add to scene (hidden)
        this.viewer.threeScene.add(skinModel);
        skinModel.visible = false;

        // Compute bone texture
        if (skinModelSkinnedMesh) {
            skinModelSkinnedMesh.skeleton.computeBoneTexture();
        }
    }

    /**
     * Load non-FLAME model with animation
     * @param {string} pathName - Path within ZIP
     * @param {object} animationConfig - Animation configuration
     * @param {object} motionConfig - Motion configuration
     */
    async loadModel(pathName, animationConfig, motionConfig) {
        const [skinModel, aniclip, indexes] = await Promise.all([
            this.unpackAndLoadGlb(pathName + '/skin.glb'),
            this.unpackAndLoadGlb(pathName + '/animation.glb'),
            this.unpackAndLoadJson(pathName + '/vertex_order.json')
        ]);

        if (!this.viewer) {
            throw new Error('render viewer is not initialized');
        }

        let skinModelSkinnedMesh;
        let boneRoot;

        skinModel.traverse((object) => {
            if (object.isSkinnedMesh) {
                skinModelSkinnedMesh = object;
            }
            if (object instanceof Bone && object.name === 'hip') {
                boneRoot = object;
            }
        });

        this.viewer.sortedIndexes = indexes;

        if (skinModelSkinnedMesh) {
            this.viewer.gaussianSplatCount = skinModelSkinnedMesh.geometry.attributes.position.count;
        }

        this.viewer.avatarMesh = skinModel;
        this.viewer.skinModel = skinModelSkinnedMesh;
        this.viewer.boneRoot = boneRoot;

        // Setup animation
        this.mixer = new AnimationMixer(skinModel);
        this.animManager = new AnimationManager(this.mixer, aniclip, animationConfig);
        this.motioncfg = motionConfig;

        // Set totalFrames from animation clips or default to 1
        if (Array.isArray(aniclip) && aniclip.length > 0 && aniclip[0].duration) {
            this.viewer.totalFrames = Math.floor(aniclip[0].duration * 30); // 30 fps
        } else {
            this.viewer.totalFrames = 1;
        }
        console.log('loadModel: totalFrames set to', this.viewer.totalFrames);

        if (skinModelSkinnedMesh) {
            this.viewer.updateMorphTarget(skinModelSkinnedMesh);
        }

        this.viewer.threeScene.add(skinModel);
        skinModel.visible = false;

        if (skinModelSkinnedMesh) {
            skinModelSkinnedMesh.skeleton.computeBoneTexture();
        }
    }

    /**
     * Unpack file from ZIP as blob URL
     * @param {string} path - Path within ZIP
     * @returns {Promise<string>} Blob URL
     */
    async unpackFileAsBlob(path) {
        if (!this.zipUrls.urls.has(path)) {
            const modelFile = await this.zipUrls.zip?.file(path)?.async('blob');
            if (modelFile) {
                const modelUrl = URL.createObjectURL(modelFile);
                this.zipUrls.urls.set(path, modelUrl);
            }
        }
        return this.zipUrls.urls.get(path);
    }

    /**
     * Unpack and load GLB file
     * @param {string} path - Path within ZIP
     * @returns {Promise<THREE.Group|THREE.AnimationClip[]>}
     */
    async unpackAndLoadGlb(path) {
        if (!this.zipUrls.urls.has(path)) {
            const modelFile = await this.zipUrls.zip?.file(path)?.async('arraybuffer');
            if (modelFile) {
                const blob = new Blob([modelFile], { type: 'model/gltf-binary' });
                const modelUrl = URL.createObjectURL(blob);
                this.zipUrls.urls.set(path, modelUrl);
            }
        }
        return this.LoadGLTF(this.zipUrls.urls.get(path));
    }

    /**
     * Unpack and parse JSON file
     * @param {string} path - Path within ZIP
     * @returns {Promise<object>}
     */
    async unpackAndLoadJson(path) {
        const file = this.zipUrls.zip?.file(path);
        if (!file) {
            throw new Error(`File not found in ZIP: ${path}`);
        }
        const jsonFile = await file.async('string');
        if (!jsonFile) {
            throw new Error(`Failed to read file from ZIP: ${path}`);
        }
        return JSON.parse(jsonFile);
    }

    /**
     * Load GLTF file
     * @param {string} url - URL to GLTF/GLB file
     * @returns {Promise<THREE.Group|THREE.AnimationClip[]>}
     */
    async LoadGLTF(url) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    if (gltf.animations.length > 0) {
                        resolve(gltf.animations);
                    } else {
                        resolve(gltf.scene);
                    }
                },
                undefined,
                (error) => {
                    reject(error);
                }
            );
        });
    }
}

export default GaussianSplatRenderer;
