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
import { SceneRevealMode } from '../enums/SceneRevealMode.js';

// Import new utilities and error classes
import { getLogger } from '../utils/Logger.js';
import {
    ValidationError,
    NetworkError,
    AssetLoadError,
    InitializationError,
    ResourceDisposedError
} from '../errors/index.js';
import {
    validateUrl,
    validateDOMElement,
    validateHexColor,
    validateCallback
} from '../utils/ValidationUtils.js';
import { BlobUrlManager } from '../utils/BlobUrlManager.js';
import { tempVector3A } from '../utils/ObjectPool.js';

// Create logger for this module
const logger = getLogger('GaussianSplatRenderer');

// Configuration objects - these would normally be loaded from the ZIP
const charactorConfig = {
    camPos: { x: 0, y: 1.8, z: 1 },
    camRot: { x: -10, y: 0, z: 0 },
    backgroundColor: 'ffffff'
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
    /**
     * Factory method to create a new renderer instance
     *
     * @param {HTMLElement} container - DOM container for canvas
     * @param {string} assetPath - URL to character ZIP file
     * @param {object} [options={}] - Configuration options
     * @param {Function} [options.downloadProgress] - Download progress callback (0-1)
     * @param {Function} [options.loadProgress] - Load progress callback (0-1)
     * @param {Function} [options.getChatState] - Chat state provider function
     * @param {Function} [options.getExpressionData] - Expression data provider function
     * @param {string} [options.backgroundColor] - Background color (hex string)
     * @returns {Promise<GaussianSplatRenderer>} Renderer instance
     * @throws {ValidationError} If parameters are invalid
     * @throws {NetworkError} If asset download fails
     * @throws {AssetLoadError} If asset loading/parsing fails
     * @throws {InitializationError} If renderer initialization fails
     */
    static async create(container, assetPath, options = {}) {

        try {
            // Validate required parameters
            validateDOMElement(container, 'container');
            validateUrl(assetPath);

            // Validate optional callbacks
            if (options.downloadProgress) {
                validateCallback(options.downloadProgress, 'options.downloadProgress', false);
            }
            if (options.loadProgress) {
                validateCallback(options.loadProgress, 'options.loadProgress', false);
            }
            if (options.getChatState) {
                validateCallback(options.getChatState, 'options.getChatState', false);
            }
            if (options.getExpressionData) {
                validateCallback(options.getExpressionData, 'options.getExpressionData', false);
            }
            if (options.backgroundColor) {
                validateHexColor(options.backgroundColor, 'options.backgroundColor');
            }

            logger.info('Initializing GaussianSplatRenderer', { assetPath });

            const characterPath = assetPath;

            // Parse character name from path
            let characterName;
            try {
                const url = new URL(characterPath, typeof window !== 'undefined' ? window.location.href : undefined);
                const pathname = url.pathname;
                const matches = pathname.match(/\/([^/]+?)\.zip/);
                characterName = matches?.[1];

                if (!characterName) {
                    throw new ValidationError(
                        'Character model name could not be extracted from path. Expected format: /path/name.zip',
                        'assetPath'
                    );
                }
            } catch (error) {
                if (error instanceof ValidationError) {
                    throw error;
                }
                throw new ValidationError(
                    `Invalid asset path format: ${error.message}`,
                    'assetPath',
                    error
                );
            }

            // Show progress
            if (typeof NProgress !== 'undefined') {
                NProgress.start();
            }

            // Download ZIP file
            logger.info('Downloading asset ZIP', { path: characterPath });
            let characterZipResponse;
            try {
                characterZipResponse = await fetch(characterPath);
                if (!characterZipResponse.ok) {
                    throw new NetworkError(
                        `Failed to download asset: ${characterZipResponse.statusText}`,
                        characterZipResponse.status
                    );
                }
            } catch (error) {
                if (error instanceof NetworkError) {
                    throw error;
                }
                throw new NetworkError(
                    `Network error downloading asset: ${error.message}`,
                    0,
                    error
                );
            }

            // Report download progress
            if (options.downloadProgress) {
                try {
                    options.downloadProgress(1.0);
                } catch (error) {
                    logger.warn('Error in downloadProgress callback', error);
                }
            }

            if (options.loadProgress) {
                try {
                    options.loadProgress(0.1);
                } catch (error) {
                    logger.warn('Error in loadProgress callback', error);
                }
            }

            if (typeof NProgress !== 'undefined') {
                NProgress.done();
            }

            // Parse array buffer
            let arrayBuffer;
            try {
                arrayBuffer = await characterZipResponse.arrayBuffer();
            } catch (error) {
                throw new NetworkError(
                    `Failed to read response data: ${error.message}`,
                    0,
                    error
                );
            }

            // Load ZIP with imported JSZip
            logger.debug('Unpacking ZIP archive');
            let zipData;
            try {
                zipData = await JSZip.loadAsync(arrayBuffer);
            } catch (error) {
                throw new AssetLoadError(
                    `Failed to unpack ZIP archive: ${error.message}`,
                    characterPath,
                    error
                );
            }

            // Find folder name in ZIP
            let fileName = '';
            Object.values(zipData.files).forEach(file => {
                if (file.dir) {
                    fileName = file.name?.slice(0, file.name?.length - 1); // Remove trailing '/'
                }
            });

            if (!fileName) {
                throw new AssetLoadError(
                    'No folder found in ZIP archive. Expected ZIP to contain a folder with model files.',
                    characterPath
                );
            }

            logger.debug('Found model folder in ZIP', { fileName });

            // Create renderer instance
            logger.debug('Creating GaussianSplatRenderer instance');
            const renderer = new GaussianSplatRenderer(container, zipData);

            // Setup camera position (use object pool for temp vectors)
            const cameraPos = tempVector3A.set(
                charactorConfig.camPos?.x ?? 0,
                charactorConfig.camPos?.y ?? 0,
                charactorConfig.camPos?.z ?? 1
            );

            const cameraRotation = new Vector3(
                charactorConfig.camRot?.x ?? 0,
                charactorConfig.camRot?.y ?? 0,
                charactorConfig.camRot?.z ?? 0
            );

            logger.debug('Camera setup', {
                position: { x: cameraPos.x, y: cameraPos.y, z: cameraPos.z },
                rotation: { x: cameraRotation.x, y: cameraRotation.y, z: cameraRotation.z }
            });

            // Background color with validation
            let backgroundColor = 0xffffff;
            try {
                if (charactorConfig.backgroundColor) {
                    const parsed = parseInt(charactorConfig.backgroundColor, 16);
                    if (!isNaN(parsed)) {
                        backgroundColor = parsed;
                    } else {
                        logger.warn('Invalid backgroundColor in config, using default', {
                            value: charactorConfig.backgroundColor
                        });
                    }
                }
                if (options?.backgroundColor) {
                    if (renderer.isHexColorStrict(options.backgroundColor)) {
                        backgroundColor = parseInt(options.backgroundColor, 16);
                    } else {
                        logger.warn('Invalid backgroundColor option, using config value', {
                            value: options.backgroundColor
                        });
                    }
                }
            } catch (error) {
                logger.warn('Error parsing backgroundColor, using default', error);
            }

            logger.debug('Background color set', { backgroundColor: backgroundColor.toString(16) });

            // Store callbacks
            renderer.getChatState = options?.getChatState;
            renderer.getExpressionData = options?.getExpressionData;

            // Load iris occlusion configuration BEFORE creating viewer (optional)
            logger.debug('Checking for iris_occlusion.json');
            let irisOcclusionConfig = null;
            try {
                irisOcclusionConfig = await renderer._loadJsonFromZip(fileName + '/iris_occlusion.json');
                if (irisOcclusionConfig) {
                    logger.info('Iris occlusion configuration loaded', {
                        rightIrisRanges: irisOcclusionConfig.right_iris?.length ?? 0,
                        leftIrisRanges: irisOcclusionConfig.left_iris?.length ?? 0
                    });
                    renderer.irisOcclusionConfig = irisOcclusionConfig;
                } else {
                    logger.debug('No iris_occlusion.json found, iris occlusion will be disabled');
                }
            } catch (error) {
                // Log but don't fail - iris occlusion is optional
                logger.warn('Failed to load iris_occlusion.json, continuing without it', { error: error.message });
                renderer.irisOcclusionConfig = null;
            }

            // Create Viewer with proper error handling
            logger.debug('Creating Viewer instance');
            try {
                renderer.viewer = new Viewer({
                    rootElement: container,
                    threejsCanvas: renderer._canvas,
                    cameraUp: [0, 1, 0],
                    initialCameraPosition: [cameraPos.x, cameraPos.y, cameraPos.z],
                    initialCameraRotation: [cameraRotation.x, cameraRotation.y, cameraRotation.z],
                    sphericalHarmonicsDegree: 0,
                    backgroundColor: backgroundColor,
                    sceneRevealMode: SceneRevealMode.Default,  // Default reveal mode
                    sceneFadeInRateMultiplier: 3.0,  // 3x faster fade-in
                    irisOcclusionConfig: irisOcclusionConfig  // Pass iris config to viewer
                });
            } catch (error) {
                throw new InitializationError(
                    `Failed to create Viewer instance: ${error.message}`,
                    error
                );
            }

            // Load model (non-FLAME mode only)
            logger.info('Loading model', { fileName });
            try {
                await renderer.loadModel(fileName, animationConfig, motionConfig);
            } catch (error) {
                throw new AssetLoadError(
                    `Failed to load model: ${error.message}`,
                    fileName,
                    error
                );
            }

            // Progress callback with error isolation
            if (options.loadProgress) {
                try {
                    options.loadProgress(0.2);
                } catch (error) {
                    logger.warn('Error in loadProgress callback', error);
                }
            }

            // Load offset PLY
            logger.debug('Loading offset PLY file');
            let offsetFileUrl;
            try {
                offsetFileUrl = await renderer.unpackFileAsBlob(fileName + '/offset.ply');
            } catch (error) {
                throw new AssetLoadError(
                    `Failed to load offset.ply: ${error.message}`,
                    fileName + '/offset.ply',
                    error
                );
            }

            // Progress callback with error isolation
            if (options.loadProgress) {
                try {
                    options.loadProgress(0.3);
                } catch (error) {
                    logger.warn('Error in loadProgress callback', error);
                }
            }

            // Add splat scene
            logger.debug('Adding splat scene');
            try {
                await renderer.viewer.addSplatScene(offsetFileUrl, {
                    progressiveLoad: true,
                    sharedMemoryForWorkers: false,
                    showLoadingUI: false,
                    format: SceneFormat.Ply
                });
            } catch (error) {
                throw new InitializationError(
                    `Failed to add splat scene: ${error.message}`,
                    error
                );
            }

            // Initial render
            try {
                renderer.render();
            } catch (error) {
                logger.error('Error in initial render', error);
                // Don't throw - render errors are non-fatal
            }

            // Progress callback with error isolation
            if (options.loadProgress) {
                try {
                    options.loadProgress(1);
                } catch (error) {
                    logger.warn('Error in loadProgress callback', error);
                }
            }

            logger.info('GaussianSplatRenderer initialized successfully');
            return renderer;

        } catch (error) {
            // Re-throw custom errors as-is
            if (error instanceof ValidationError ||
                error instanceof NetworkError ||
                error instanceof AssetLoadError ||
                error instanceof InitializationError) {
                logger.error('Initialization failed', { errorCode: error.code, message: error.message });
                throw error;
            }

            // Wrap unexpected errors
            logger.error('Unexpected error during initialization', error);
            throw new InitializationError(
                `Unexpected error initializing GaussianSplatRenderer: ${error.message}`,
                error
            );
        }
    }

    /**
     * @deprecated Use create() instead. This method is kept for backwards compatibility.
     * @param {HTMLElement} container - DOM container for canvas
     * @param {string} assetPath - URL to character ZIP file
     * @param {object} [options={}] - Configuration options
     * @returns {Promise<GaussianSplatRenderer>} Renderer instance
     */
    static async getInstance(container, assetPath, options = {}) {
        logger.warn('getInstance() is deprecated. Use create() instead. Each call creates a new instance.');
        return this.create(container, assetPath, options);
    }

    /**
     * Constructor - Creates a new GaussianSplatRenderer instance
     *
     * @param {HTMLElement} _container - DOM container element for the renderer
     * @param {JSZip} zipData - Loaded ZIP archive containing model data
     * @private - Use create() factory method instead
     */
    constructor(_container, zipData) {
        logger.debug('GaussianSplatRenderer constructor called');

        // Disposal tracking
        this._disposed = false;

        // BlobUrlManager for tracking blob URLs
        this._blobUrlManager = new BlobUrlManager();

        // ZIP file cache
        this.zipUrls = {
            urls: new Map(),
            zip: zipData
        };

        // State
        this.lastTime = 0;
        this.startTime = 0;
        this.expressionData = {};
        this.chatState = TYVoiceChatState.Idle;

        // Create instance-specific canvas
        this._canvas = null;
        if (typeof document !== 'undefined' && _container) {
            this._canvas = document.createElement('canvas');
            const { width, height } = _container.getBoundingClientRect();
            this._canvas.style.visibility = 'visible';
            this._canvas.width = width;
            this._canvas.height = height;
            _container.appendChild(this._canvas);
            logger.debug('Canvas setup', { width, height });
        }

        // Animation timing
        this.clock = new Clock();
        this.startTime = performance.now() / 1000.0;

        // These will be set during loading
        this.viewer = null;
        this.mixer = null;
        this.animManager = null;
        this.model = null;
        this.irisOcclusionConfig = null;
        this.motioncfg = null;
        this.getChatState = null;
        this.getExpressionData = null;

        logger.debug('GaussianSplatRenderer instance created');
    }

    /**
     * Assert renderer is not disposed
     * @private
     * @throws {ResourceDisposedError} If renderer has been disposed
     */
    _assertNotDisposed() {
        if (this._disposed) {
            throw new ResourceDisposedError('GaussianSplatRenderer has been disposed');
        }
    }

    /**
     * Dispose renderer and free all resources
     *
     * Properly cleans up:
     * - Model resources (mesh, animations, textures)
     * - Blob URLs to prevent memory leaks
     * - Viewer instance
     * - Canvas visibility
     *
     * @returns {void}
     */
    dispose() {
        if (this._disposed) {
            logger.warn('GaussianSplatRenderer.dispose() called on already disposed instance');
            return;
        }

        logger.info('Disposing GaussianSplatRenderer');

        // Hide and remove canvas
        if (this._canvas) {
            this._canvas.style.visibility = 'hidden';
            if (this._canvas.parentNode) {
                this._canvas.parentNode.removeChild(this._canvas);
            }
            this._canvas = null;
        }

        // Dispose model resources
        this.disposeModel();

        // Revoke all blob URLs using BlobUrlManager
        try {
            this._blobUrlManager?.dispose();
        } catch (error) {
            logger.error('Error disposing BlobUrlManager', error);
        }

        // Legacy blob URL cleanup (for URLs created before BlobUrlManager)
        if (this.zipUrls?.urls) {
            this.zipUrls.urls.forEach((value) => {
                try {
                    URL.revokeObjectURL(value);
                } catch (error) {
                    logger.warn('Error revoking blob URL', { url: value, error });
                }
            });
            this.zipUrls.urls.clear();
        }

        // Nullify references to aid GC
        this.viewer = null;
        this.mixer = null;
        this.animManager = null;
        this.model = null;
        this.motioncfg = null;
        this.getChatState = null;
        this.getExpressionData = null;
        this.zipUrls = null;

        // Mark as disposed
        this._disposed = true;

        // Clear singleton instance
        GaussianSplatRenderer.instance = undefined;

        logger.debug('GaussianSplatRenderer disposed successfully');
    }

    /**
     * Dispose model-specific resources
     *
     * Cleans up:
     * - Animation mixer and cached actions
     * - Animation manager
     * - Viewer instance
     *
     * @returns {void}
     */
    disposeModel() {
        logger.debug('Disposing model resources');

        // Dispose animation mixer
        if (this.mixer) {
            try {
                this.mixer.stopAllAction();
                if (this.viewer?.avatarMesh) {
                    this.mixer.uncacheRoot(this.viewer.avatarMesh);
                }
            } catch (error) {
                logger.error('Error disposing animation mixer', error);
            }
            this.mixer = null;
        }

        // Dispose animation manager
        if (this.animManager) {
            try {
                this.animManager.dispose();
            } catch (error) {
                logger.error('Error disposing animation manager', error);
            }
            this.animManager = null;
        }

        // Dispose viewer
        if (this.viewer) {
            try {
                this.viewer.dispose();
            } catch (error) {
                logger.error('Error disposing viewer', error);
            }
            this.viewer = null;
        }

        logger.debug('Model resources disposed');
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
                    logger.debug('Chat state changed', {
                        newState: this.chatState,
                        hasAnimManager: !!this.animManager
                    });
                    this._lastLoggedState = this.chatState;
                }
                this.animManager?.update(this.chatState);
            }

            // Update expression data
            if (this.getExpressionData) {
                this.expressionData = this.updateBS(this.getExpressionData());
            }

            // Animation mixer update
            if (!this.mixer || !this.animManager) {
                if (!this._warnedOnce) {
                    logger.warn('Mixer or animManager not initialized, skipping animation update', {
                        hasMixer: !!this.mixer,
                        hasAnimManager: !!this.animManager
                    });
                    this._warnedOnce = true;
                }
                // Still update expressions even without mixer/animManager
                this.setExpression();
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

            // Update viewer
            this.viewer.update(this.viewer.renderer, this.viewer.camera);

            // Render if needed
            const shouldRender = this.viewer.shouldRender();
            if (this._renderLogCount <= 3) {
                logger.debug('shouldRender check', { shouldRender });
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
            
            // Update eye blink uniforms for smooth iris fade
            const material = this.viewer.splatMesh.material;
            if (material?.uniforms) {
                const eyeBlinkLeft = this.expressionData.eyeBlinkLeft || 0.0;
                const eyeBlinkRight = this.expressionData.eyeBlinkRight || 0.0;
                if (material.uniforms.eyeBlinkLeft) {
                    material.uniforms.eyeBlinkLeft.value = eyeBlinkLeft;
                }
                if (material.uniforms.eyeBlinkRight) {
                    material.uniforms.eyeBlinkRight.value = eyeBlinkRight;
                }
            }
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
     * Load model with animation
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
        logger.debug('Total frames calculated', { totalFrames: this.viewer.totalFrames });

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
     * Unpack file from ZIP and create a blob URL
     *
     * Uses BlobUrlManager to track blob URLs for automatic cleanup.
     * Caches URLs for repeated access to the same file.
     *
     * @param {string} path - Path to file within ZIP archive
     * @returns {Promise<string>} Blob URL to the file
     * @throws {AssetLoadError} If file cannot be unpacked
     */
    async unpackFileAsBlob(path) {
        this._assertNotDisposed();

        // Return cached URL if available
        if (this.zipUrls.urls.has(path)) {
            logger.debug('Returning cached blob URL', { path });
            return this.zipUrls.urls.get(path);
        }

        logger.debug('Unpacking file from ZIP', { path });

        // Extract file from ZIP
        const fileEntry = this.zipUrls.zip?.file(path);
        if (!fileEntry) {
            throw new AssetLoadError(
                `File not found in ZIP archive: ${path}`,
                path
            );
        }

        let modelFile;
        try {
            modelFile = await fileEntry.async('blob');
        } catch (error) {
            throw new AssetLoadError(
                `Failed to extract file from ZIP: ${error.message}`,
                path,
                error
            );
        }

        if (!modelFile) {
            throw new AssetLoadError(
                `File extracted but blob is empty: ${path}`,
                path
            );
        }

        // Create blob URL using BlobUrlManager for tracking
        const mimeType = this._getMimeType(path);
        const modelUrl = this._blobUrlManager.createBlobUrl(
            modelFile,
            mimeType,
            `zip:${path}`
        );

        // Cache for future access
        this.zipUrls.urls.set(path, modelUrl);
        logger.debug('Blob URL created and cached', { path, url: modelUrl.substring(0, 50) });

        return modelUrl;
    }

    /**
     * Load JSON file from ZIP archive
     *
     * @param {string} path - Path to JSON file within ZIP archive
     * @returns {Promise<Object|null>} Parsed JSON object, or null if file doesn't exist
     * @throws {ParseError} If JSON parsing fails
     * @private
     */
    async _loadJsonFromZip(path) {
        this._assertNotDisposed();

        logger.debug('Attempting to load JSON from ZIP', { path });

        // Check if file exists in ZIP
        const fileEntry = this.zipUrls.zip?.file(path);
        if (!fileEntry) {
            logger.debug('JSON file not found in ZIP, returning null', { path });
            return null;
        }

        // Extract file as text
        let jsonText;
        try {
            jsonText = await fileEntry.async('text');
        } catch (error) {
            throw new ParseError(
                `Failed to extract JSON file from ZIP: ${error.message}`,
                path,
                error
            );
        }

        // Parse JSON
        try {
            const jsonData = JSON.parse(jsonText);
            logger.debug('JSON file loaded successfully', { path });
            return jsonData;
        } catch (error) {
            throw new ParseError(
                `Failed to parse JSON file: ${error.message}`,
                path,
                error
            );
        }
    }

    /**
     * Unpack GLB file from ZIP and load it
     *
     * @param {string} path - Path to GLB file within ZIP archive
     * @returns {Promise<THREE.Group|THREE.AnimationClip[]>} Loaded GLTF model
     * @throws {AssetLoadError} If file cannot be unpacked or loaded
     */
    async unpackAndLoadGlb(path) {
        this._assertNotDisposed();

        // Return cached URL if available
        if (this.zipUrls.urls.has(path)) {
            logger.debug('Using cached GLB URL', { path });
            return this.LoadGLTF(this.zipUrls.urls.get(path));
        }

        logger.debug('Unpacking GLB from ZIP', { path });

        // Extract file from ZIP as ArrayBuffer
        const fileEntry = this.zipUrls.zip?.file(path);
        if (!fileEntry) {
            throw new AssetLoadError(
                `GLB file not found in ZIP archive: ${path}`,
                path
            );
        }

        let modelFile;
        try {
            modelFile = await fileEntry.async('arraybuffer');
        } catch (error) {
            throw new AssetLoadError(
                `Failed to extract GLB from ZIP: ${error.message}`,
                path,
                error
            );
        }

        if (!modelFile) {
            throw new AssetLoadError(
                `GLB extracted but ArrayBuffer is empty: ${path}`,
                path
            );
        }

        // Create blob URL using BlobUrlManager
        const blob = new Blob([modelFile], { type: 'model/gltf-binary' });
        const modelUrl = this._blobUrlManager.createBlobUrl(
            blob,
            'model/gltf-binary',
            `zip:${path}`
        );

        // Cache for future access
        this.zipUrls.urls.set(path, modelUrl);
        logger.debug('GLB blob URL created and cached', { path });

        return this.LoadGLTF(modelUrl);
    }

    /**
     * Get MIME type from file extension
     * @private
     * @param {string} path - File path
     * @returns {string} MIME type
     */
    _getMimeType(path) {
        const extension = path.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'ply': 'model/ply',
            'glb': 'model/gltf-binary',
            'gltf': 'model/gltf+json',
            'json': 'application/json',
            'bin': 'application/octet-stream',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg'
        };
        return mimeTypes[extension] || 'application/octet-stream';
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
