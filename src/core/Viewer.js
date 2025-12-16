/**
 * Viewer
 * 
 * Based on @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * HEAVILY MODIFIED for FLAME avatar support:
 * - Added FLAME head model integration
 * - Extended with expression/pose controls
 * - Additional rendering pipeline modifications
 * - Additional ~900 lines of FLAME-specific code
 */

import { Bone, DynamicDrawUsage, InstancedBufferAttribute, MathUtils, Matrix4, OrthographicCamera, PerspectiveCamera, Quaternion, Scene, Skeleton, Vector2, Vector3, WebGLRenderer } from 'three';
import { 
    getCurrentTime, 
    clamp, 
    delayedExecute, 
    isIOS, 
    getIOSSemever, 
    Semver,
    fetchWithProgress,
    nativePromiseWithExtractedComponents,
    abortablePromiseWithExtractedComponents,
    disposeAllMeshes,
    AbortedPromiseError
} from '../utils/Util.js';
import { RenderMode } from '../enums/RenderMode.js';
import { LogLevel } from '../enums/LogLevel.js';
import { SplatRenderMode } from '../enums/SplatRenderMode.js';
import { SceneFormat, sceneFormatFromPath } from '../enums/SceneFormat.js';
import { SceneRevealMode } from '../enums/SceneRevealMode.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SplatMesh } from './SplatMesh.js';
import { SplatScene } from './SplatScene.js';
import { DirectLoadError } from '../loaders/DirectLoadError.js';
import { PlyLoader } from '../loaders/PlyLoader.js';
import { Raycaster } from '../raycaster/Raycaster.js';
import { createSortWorker } from '../worker/SortWorker.js';
import { 
    SCENE_FADEIN_RATE_FAST,
    SCENE_FADEIN_RATE_GRADUAL,
    THREE_CAMERA_FOV,
    MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT,
    CONSECUTIVE_RENDERED_FRAMES_FOR_FPS_CALCULATION,
    MIN_SPLAT_COUNT_TO_SHOW_SPLAT_TREE_LOADING_SPINNER,
    FOCUS_MARKER_FADE_IN_SPEED,
    FOCUS_MARKER_FADE_OUT_SPEED,
    Constants,
    LoaderStatus
} from '../enums/EngineConstants.js';

// UI components - stub implementations for now
class LoadingSpinner {
    constructor(msg, container) { this.tasks = []; }
    show() {}
    hide() {}
    setContainer(c) {}
    addTask(msg) { return this.tasks.push(msg); }
    removeTask(id) {}
    removeAllTasks() { this.tasks = []; }
    setMessageForTask(id, msg) {}
}

class LoadingProgressBar {
    constructor(container) {}
    show() {}
    hide() {}
    setContainer(c) {}
    setProgress(p) {}
}

class SceneHelper {
    constructor(scene) { 
        this.scene = scene; 
        this.meshCursor = null;
        this.meshCursorVisible = false;
        this.focusMarker = null;
        this.focusMarkerOpacity = 0;
        this.controlPlane = null;
        this.controlPlaneVisible = false;
    }
    setupMeshCursor() {}
    setupFocusMarker() {}
    setupControlPlane() {}
    updateMeshCursor(pos, active) {}
    updateFocusMarker(target, camera, renderDimensions) {}
    updateControlPlane(cam, ctrl) {}
    setFocusMarkerVisibility(v) {}
    setFocusMarkerOpacity(o) { this.focusMarkerOpacity = o; }
    getFocusMarkerOpacity() { return this.focusMarkerOpacity; }
    positionAndOrientFocusMarker(pos, cam) {}
    positionAndOrientMeshCursor(pos, cam) {}
    setMeshCursorVisibility(visible) { this.meshCursorVisible = visible; }
    getMeschCursorVisibility() { return this.meshCursorVisible; }
    setControlPlaneVisibility(visible) { this.controlPlaneVisible = visible; }
    positionAndOrientControlPlane(pos, quat, scale) {}
    updateForRenderMode(mode, mesh) {}
    dispose() {}
}

/**
 * Viewer - Core Gaussian Splatting Viewer
 * Handles the Three.js scene, camera, controls, and rendering loop.
 */
export class Viewer {
  /**
   * @param {object} options - Configuration options
   * @param {Array<number>} [options.cameraUp=[0, 1, 0]] - Camera up vector
   * @param {Array<number>} [options.initialCameraPosition=[0, 10, 15]] - Initial camera position
   * @param {Array<number>} [options.initialCameraRotation=[0, 0, 0]] - Initial camera rotation
   * @param {Array<number>} [options.initialCameraLookAt=[0, 0, 0]] - Initial camera look-at point
   * @param {boolean} [options.dropInMode=false] - If true, viewer is used as a Three.js scene object
   * @param {boolean} [options.selfDrivenMode=true] - If true, viewer manages its own render loop
   * @param {boolean} [options.useBuiltInControls=true] - If true, uses OrbitControls
   * @param {HTMLElement} [options.rootElement] - Parent element for the canvas
   * @param {HTMLCanvasElement} [options.threejsCanvas] - Existing canvas to use
   * @param {boolean} [options.ignoreDevicePixelRatio=false] - If true, forces DPR to 1
   * @param {boolean} [options.halfPrecisionCovariancesOnGPU=false] - Use 16-bit float for covariances
   * @param {THREE.Scene} [options.threeScene] - External Three.js scene to render
   * @param {THREE.WebGLRenderer} [options.renderer] - External Three.js renderer
   * @param {THREE.Camera} [options.camera] - External Three.js camera
   * @param {boolean} [options.gpuAcceleratedSort=false] - Use GPU for sorting distances
   * @param {boolean} [options.integerBasedSort=true] - Use integer arithmetic for sorting
   * @param {boolean} [options.sharedMemoryForWorkers=true] - Use SharedArrayBuffer for workers
   * @param {boolean} [options.dynamicScene=false] - Optimize for dynamic scenes
   */
  constructor(options = {}) {
    // The natural 'up' vector for viewing the scene (only has an effect when used with orbit controls and
    // when the viewer uses its own camera).
    if (!options.cameraUp) options.cameraUp = [0, 1, 0];
    this.cameraUp = new Vector3().fromArray(options.cameraUp);

    // The camera's initial position (only used when the viewer uses its own camera).
    if (!options.initialCameraPosition)
      options.initialCameraPosition = [0, 10, 15];
    this.initialCameraPosition = new Vector3().fromArray(
      options.initialCameraPosition
    );

    if (!options.initialCameraRotation)
        options.initialCameraRotation = [0, 0, 0];
      this.initialCameraRotation = new Vector3().fromArray(
        options.initialCameraRotation
    );
    this.backgroundColor = options.backgroundColor;

    // The initial focal point of the camera and center of the camera's orbit (only used when the viewer uses its own camera).
    if (!options.initialCameraLookAt) options.initialCameraLookAt = [0, 0, 0];
    this.initialCameraLookAt = new Vector3().fromArray(
      options.initialCameraLookAt
    );

    // 'dropInMode' is a flag that is used internally to support the usage of the viewer as a Three.js scene object
    this.dropInMode = options.dropInMode || false;

    // If 'selfDrivenMode' is true, the viewer manages its own update/animation loop via requestAnimationFrame()
    if (options.selfDrivenMode === undefined || options.selfDrivenMode === null)
      options.selfDrivenMode = true;
    this.selfDrivenMode = options.selfDrivenMode && !this.dropInMode;
    this.selfDrivenUpdateFunc = this.selfDrivenUpdate.bind(this);

    // If 'useBuiltInControls' is true, the viewer will create its own instance of OrbitControls and attach to the camera
    if (options.useBuiltInControls === undefined)
      options.useBuiltInControls = true;
    this.useBuiltInControls = options.useBuiltInControls;

    // parent element of the Three.js renderer canvas
    this.rootElement = options.rootElement;
    this.canvas = options.threejsCanvas;
    // Tells the viewer to pretend the device pixel ratio is 1, which can boost performance on devices where it is larger,
    // at a small cost to visual quality
    this.ignoreDevicePixelRatio = options.ignoreDevicePixelRatio || false;
    this.devicePixelRatio = this.ignoreDevicePixelRatio
      ? 1
      : window.devicePixelRatio || 1;

    // Tells the viewer to use 16-bit floating point values when storing splat covariance data in textures, instead of 32-bit
    this.halfPrecisionCovariancesOnGPU =
      options.halfPrecisionCovariancesOnGPU || false;

    // If 'threeScene' is valid, it will be rendered by the viewer along with the splat mesh
    this.threeScene = options.threeScene;
    // Allows for usage of an external Three.js renderer
    this.renderer = options.renderer;
    // Allows for usage of an external Three.js camera
    this.camera = options.camera;

    // If 'gpuAcceleratedSort' is true, a partially GPU-accelerated approach to sorting splats will be used.
    // Currently this means pre-computing splat distances from the camera on the GPU
    this.gpuAcceleratedSort = options.gpuAcceleratedSort || false;

    // if 'integerBasedSort' is true, the integer version of splat centers as well as other values used to calculate
    // splat distances are used instead of the float version. This speeds up computation, but introduces the possibility of
    // overflow in larger scenes.
    if (
      options.integerBasedSort === undefined ||
      options.integerBasedSort === null
    ) {
      options.integerBasedSort = true;
    }
    this.integerBasedSort = options.integerBasedSort;

    // If 'sharedMemoryForWorkers' is true, a SharedArrayBuffer will be used to communicate with web workers. This method
    // is faster than copying memory to or from web workers, but comes with security implications as outlined here:
    // https://web.dev/articles/cross-origin-isolation-guide
    // If enabled, it requires specific CORS headers to be present in the response from the server that is sent when
    // loading the application. More information is available in the README.
    if (
      options.sharedMemoryForWorkers === undefined ||
      options.sharedMemoryForWorkers === null
    )
      options.sharedMemoryForWorkers = true;
    this.sharedMemoryForWorkers = false; //options.sharedMemoryForWorkers;

    // if 'dynamicScene' is true, it tells the viewer to assume scene elements are not stationary or that the number of splats in the
    // scene may change. This prevents optimizations that depend on a static scene from being made. Additionally, if 'dynamicScene' is
    // true it tells the splat mesh to not apply scene tranforms to splat data that is returned by functions like
    // SplatMesh.getSplatCenter() by default.
    this.dynamicScene = !!options.dynamicScene;

    // When true, will perform additional steps during rendering to address artifacts caused by the rendering of gaussians at a
    // substantially different resolution than that at which they were rendered during training. This will only work correctly
    // for models that were trained using a process that utilizes this compensation calculation. For more details:
    // https://github.com/nerfstudio-project/gsplat/pull/117
    // https://github.com/graphdeco-inria/gaussian-splatting/issues/294#issuecomment-1772688093
    this.antialiased = options.antialiased || false;

    // This constant is added to the projected 2D screen-space splat scales
    this.kernel2DSize =
      options.kernel2DSize === undefined ? 0.3 : options.kernel2DSize;

    // if 'renderMode' is RenderMode.Always, then the viewer will rrender the scene on every update. If it is RenderMode.OnChange,
    // it will only render when something in the scene has changed.
    this.renderMode = options.renderMode || RenderMode.Always;

    // SceneRevealMode.Default results in a nice, slow fade-in effect for progressively loaded scenes,
    // and a fast fade-in for non progressively loaded scenes.
    // SceneRevealMode.Gradual will force a slow fade-in for all scenes.
    // SceneRevealMode.Instant will force all loaded scene data to be immediately visible.
    this.sceneRevealMode = options.sceneRevealMode || SceneRevealMode.Default;

    // Hacky, experimental, non-scientific parameter for tweaking focal length related calculations. For scenes with very
    // small gaussians, small details, and small dimensions -- increasing this value can help improve visual quality.
    this.focalAdjustment = options.focalAdjustment || 1.0;

    // Specify the maximum screen-space splat size, can help deal with large splats that get too unwieldy
    this.maxScreenSpaceSplatSize = options.maxScreenSpaceSplatSize || 1024;

    // The verbosity of console logging
    this.logLevel = options.logLevel || LogLevel.None;

    // Degree of spherical harmonics to utilize in rendering splats (assuming the data is present in the splat scene).
    // Valid values are 0 - 2. Default value is 0.
    this.sphericalHarmonicsDegree = options.sphericalHarmonicsDegree || 0;

    // When true, allows for usage of extra properties and attributes during rendering for effects such as opacity adjustment.
    // Default is false for performance reasons. These properties are separate from transform properties (scale, rotation, position)
    // that are enabled by the 'dynamicScene' parameter.
    this.enableOptionalEffects = options.enableOptionalEffects || false;

    // Enable the usage of SIMD WebAssembly instructions for the splat sort
    if (
      options.enableSIMDInSort === undefined ||
      options.enableSIMDInSort === null
    )
      options.enableSIMDInSort = true;
    this.enableSIMDInSort = options.enableSIMDInSort;

    // Level to compress non KSPLAT files when loading them for direct rendering
    if (
      options.inMemoryCompressionLevel === undefined ||
      options.inMemoryCompressionLevel === null
    ) {
      options.inMemoryCompressionLevel = 0;
    }
    this.inMemoryCompressionLevel = options.inMemoryCompressionLevel;

    // Reorder splat data in memory after loading is complete to optimize cache utilization. Default is true.
    // Does not apply if splat scene is progressively loaded.
    if (
      options.optimizeSplatData === undefined ||
      options.optimizeSplatData === null
    ) {
      options.optimizeSplatData = true;
    }
    this.optimizeSplatData = options.optimizeSplatData;

    // When true, the intermediate splat data that is the result of decompressing splat bufffer(s) and is used to
    // populate the data textures will be freed. This will reduces memory usage, but if that data needs to be modified
    // it will need to be re-populated from the splat buffer(s). Default is false.
    if (
      options.freeIntermediateSplatData === undefined ||
      options.freeIntermediateSplatData === null
    ) {
      options.freeIntermediateSplatData = false;
    }
    this.freeIntermediateSplatData = options.freeIntermediateSplatData;

    // It appears that for certain iOS versions, special actions need to be taken with the
    // usage of SIMD instructions and shared memory
    if (isIOS()) {
      const semver = getIOSSemever();
      if (semver.major < 17) {
        this.enableSIMDInSort = false;
      }
      if (semver.major < 16) {
        this.sharedMemoryForWorkers = false;
      }
    }

    // Tell the viewer how to render the splats
    if (
      options.splatRenderMode === undefined ||
      options.splatRenderMode === null
    ) {
      options.splatRenderMode = SplatRenderMode.ThreeD;
    }
    this.splatRenderMode = options.splatRenderMode;

    // Customize the speed at which the scene is revealed
    this.sceneFadeInRateMultiplier = options.sceneFadeInRateMultiplier || 1.0;

    // Set the range for the depth map for the counting sort used to sort the splats
    this.splatSortDistanceMapPrecision =
      options.splatSortDistanceMapPrecision ||
      Constants.DefaultSplatSortDistanceMapPrecision;
    const maxPrecision = this.integerBasedSort ? 20 : 24;
    this.splatSortDistanceMapPrecision = clamp(
      this.splatSortDistanceMapPrecision,
      10,
      maxPrecision
    );

    this.onSplatMeshChangedCallback = null;
    this.createSplatMesh();

    this.controls = null;
    this.perspectiveControls = null;
    this.orthographicControls = null;

    this.orthographicCamera = null;
    this.perspectiveCamera = null;

    this.showMeshCursor = false;
    this.showControlPlane = false;
    this.showInfo = false;

    this.sceneHelper = null;

    this.sortWorker = null;
    this.sortRunning = false;
    this.splatRenderCount = 0;
    this.splatSortCount = 0;
    this.lastSplatSortCount = 0;
    this.sortWorkerIndexesToSort = null;
    this.sortWorkerSortedIndexes = null;
    this.sortWorkerPrecomputedDistances = null;
    this.sortWorkerTransforms = null;
    this.preSortMessages = [];
    this.runAfterNextSort = [];

    this.selfDrivenModeRunning = false;
    this.splatRenderReady = false;

    this.raycaster = new Raycaster();

    this.infoPanel = null;

    this.startInOrthographicMode = false;

    this.currentFPS = 0;
    this.lastSortTime = 0;
    this.consecutiveRenderFrames = 0;

    this.previousCameraTarget = new Vector3();
    this.nextCameraTarget = new Vector3();

    this.mousePosition = new Vector2();
    this.mouseDownPosition = new Vector2();
    this.mouseDownTime = null;

    this.resizeObserver = null;
    this.mouseMoveListener = null;
    this.mouseDownListener = null;
    this.mouseUpListener = null;
    this.keyDownListener = null;

    this.sortPromise = null;
    this.sortPromiseResolver = null;
    this.splatSceneDownloadControllers = [];
    this.splatSceneDownloadPromises = {};
    this.splatSceneDownloadAndBuildPromise = null;
    this.splatSceneRemovalPromise = null;

    this.loadingSpinner = new LoadingSpinner(
      null,
      this.rootElement || document.body
    );
    this.loadingSpinner.hide();
    this.loadingProgressBar = new LoadingProgressBar(
      this.rootElement || document.body
    );
    this.loadingProgressBar.hide();
    // this.infoPanel = new InfoPanel(this.rootElement || document.body)
    // this.infoPanel.hide()

    this.usingExternalCamera = this.dropInMode || this.camera ? true : false;
    this.usingExternalRenderer = this.dropInMode || this.renderer ? true : false;

    this.initialized = false;
    this.disposing = false;
    this.disposed = false;
    this.disposePromise = null;

    this.lastTime = 0;
    this.gaussianSplatCount = 0;
    this.totalFrames = 0; 
    this.flame_params = null;
    this.bone_tree = null;
    this.lbs_weight_80k = null;
    this.frame = 0;
  
    this.useFlame = true;
    this.bones = null;
    this.skeleton = null;
    this. avatarMesh = null;
    this.skinModel = null;
    this.boneRoot = null;
    this.baseMesh = null;
    this.setSkinAttibutes = false;

    if (!this.dropInMode) this.init();
  }

  createSplatMesh() {
    this.splatMesh = new SplatMesh(
      this.splatRenderMode,
      this.dynamicScene,
      this.enableOptionalEffects,
      this.halfPrecisionCovariancesOnGPU,
      this.devicePixelRatio,
      this.gpuAcceleratedSort,
      this.integerBasedSort,
      this.antialiased,
      this.maxScreenSpaceSplatSize,
      this.logLevel,
      this.sphericalHarmonicsDegree,
      this.sceneFadeInRateMultiplier,
      this.kernel2DSize
    );
    this.splatMesh.frustumCulled = false;
    if (this.onSplatMeshChangedCallback) this.onSplatMeshChangedCallback();
  }

  init() {
    if (this.initialized) return

    if (!this.rootElement) {
      if (!this.usingExternalRenderer) {
        this.rootElement = document.createElement('div');
        this.rootElement.style.width = '100%';
        this.rootElement.style.height = '100%';
        this.rootElement.style.position = 'absolute';
        document.body.appendChild(this.rootElement);
      } else {
        this.rootElement = this.renderer.domElement || document.body;
      }
    }

    this.setupCamera();
    this.setupRenderer();
    // 暂时去掉控制器
    // this.setupControls()
    this.setupEventHandlers();

    this.threeScene = this.threeScene || new Scene();
    this.sceneHelper = new SceneHelper(this.threeScene);
    this.sceneHelper.setupMeshCursor();
    this.sceneHelper.setupFocusMarker();
    this.sceneHelper.setupControlPlane();

    this.loadingProgressBar.setContainer(this.rootElement);
    this.loadingSpinner.setContainer(this.rootElement);
    // this.infoPanel.setContainer(this.rootElement)

    this.initialized = true;
  }

  setupCamera() {
    if (!this.usingExternalCamera) {
      const renderDimensions = new Vector2();
      this.getRenderDimensions(renderDimensions);

      this.perspectiveCamera = new PerspectiveCamera(
        THREE_CAMERA_FOV,
        renderDimensions.x / renderDimensions.y,
        0.1,
        1000
      );
      this.orthographicCamera = new OrthographicCamera(
        renderDimensions.x / -2,
        renderDimensions.x / 2,
        renderDimensions.y / 2,
        renderDimensions.y / -2,
        0.1,
        1000
      );
      this.camera = this.startInOrthographicMode
        ? this.orthographicCamera
        : this.perspectiveCamera;
      this.camera.position.copy(this.initialCameraPosition);
      // this.camera.up.copy(this.cameraUp).normalize()
      // this.camera.lookAt(this.initialCameraLookAt)
      this.camera.rotateX(MathUtils.degToRad(this.initialCameraRotation.x));
      this.camera.rotateY(MathUtils.degToRad(this.initialCameraRotation.y));
      this.camera.rotateZ(MathUtils.degToRad(this.initialCameraRotation.z));
    }
  }

  setupRenderer() {
    if (!this.usingExternalRenderer) {
      const renderDimensions = new Vector2();
      this.getRenderDimensions(renderDimensions);

      this.renderer = new WebGLRenderer({
        antialias: false,
        precision: 'highp',
        canvas: this.canvas
      });
      this.renderer.setPixelRatio(this.devicePixelRatio);
      this.renderer.autoClear = true;
      this.renderer.setClearColor(this.backgroundColor, 1.0); // set background color according to the config

      this.renderer.setSize(renderDimensions.x, renderDimensions.y);

      this.resizeObserver = new ResizeObserver(() => {
        this.getRenderDimensions(renderDimensions);
        this.renderer.setSize(renderDimensions.x, renderDimensions.y);
        this.forceRenderNextFrame();
      });
      this.resizeObserver.observe(this.rootElement);
      this.rootElement.appendChild(this.renderer.domElement);
    }
  }

  setupControls() {
    if (this.useBuiltInControls) {
      if (!this.usingExternalCamera) {
        this.perspectiveControls = new OrbitControls(
          this.perspectiveCamera,
          this.renderer.domElement
        );
        this.orthographicControls = new OrbitControls(
          this.orthographicCamera,
          this.renderer.domElement
        );
      } else {
        if (this.camera.isOrthographicCamera) {
          this.orthographicControls = new OrbitControls(
            this.camera,
            this.renderer.domElement
          );
        } else {
          this.perspectiveControls = new OrbitControls(
            this.camera,
            this.renderer.domElement
          );
        }
      }
      for (let controls of [
        this.orthographicControls,
        this.perspectiveControls
      ]) {
        if (controls) {
          controls.listenToKeyEvents(window);
          controls.rotateSpeed = 0.5;
          controls.maxPolarAngle = Math.PI * 0.5;// + Math.PI / 24
          controls.minPolarAngle = Math.PI * 0.5;// - Math.PI / 24
          controls.minAzimuthAngle = -Math.PI / 72;
          controls.maxAzimuthAngle = Math.PI / 72;
          controls.enableDamping = true;
          controls.dampingFactor = 0.05;
          controls.target.copy(this.initialCameraLookAt);
          controls.update();
        }
      }
      this.controls = this.camera.isOrthographicCamera
        ? this.orthographicControls
        : this.perspectiveControls;
      this.controls.update();
    }
  }

  setupEventHandlers() {
    if (this.useBuiltInControls) {
      this.mouseMoveListener = this.onMouseMove.bind(this);
      this.renderer.domElement.addEventListener(
        'pointermove',
        this.mouseMoveListener,
        false
      );
      this.mouseDownListener = this.onMouseDown.bind(this);
      this.renderer.domElement.addEventListener(
        'pointerdown',
        this.mouseDownListener,
        false
      );
      this.mouseUpListener = this.onMouseUp.bind(this);
      this.renderer.domElement.addEventListener(
        'pointerup',
        this.mouseUpListener,
        false
      );
      this.keyDownListener = this.onKeyDown.bind(this);
      // 暂时去掉键盘事件的监听
      // window.addEventListener('keydown', this.keyDownListener, false)
    }
  }

  removeEventHandlers() {
    if (this.useBuiltInControls) {
      this.renderer.domElement.removeEventListener(
        'pointermove',
        this.mouseMoveListener
      );
      this.mouseMoveListener = null;
      this.renderer.domElement.removeEventListener(
        'pointerdown',
        this.mouseDownListener
      );
      this.mouseDownListener = null;
      this.renderer.domElement.removeEventListener(
        'pointerup',
        this.mouseUpListener
      );
      this.mouseUpListener = null;
      window.removeEventListener('keydown', this.keyDownListener);
      this.keyDownListener = null;
    }
  }

  setRenderMode(renderMode) {
    this.renderMode = renderMode;
  }

  setActiveSphericalHarmonicsDegrees(activeSphericalHarmonicsDegrees) {
    this.splatMesh.material.uniforms.sphericalHarmonicsDegree.value =
      activeSphericalHarmonicsDegrees;
    this.splatMesh.material.uniformsNeedUpdate = true;
  }

  onSplatMeshChanged(callback) {
    this.onSplatMeshChangedCallback = callback;
  }

  tempForward = new Vector3()
  tempMatrixLeft = new Matrix4()
  tempMatrixRight = new Matrix4()
  onKeyDown = (e) => {
    this.tempForward.set(0, 0, -1);
    this.tempForward.transformDirection(this.camera.matrixWorld);
    this.tempMatrixLeft.makeRotationAxis(this.tempForward, Math.PI / 128);
    this.tempMatrixRight.makeRotationAxis(this.tempForward, -Math.PI / 128);
    switch (e.code) {
      case 'KeyG':
        this.focalAdjustment += 0.02;
        this.forceRenderNextFrame();
        break
      case 'KeyF':
        this.focalAdjustment -= 0.02;
        this.forceRenderNextFrame();
        break
      case 'ArrowLeft':
        this.camera.up.transformDirection(this.tempMatrixLeft);
        break
      case 'ArrowRight':
        this.camera.up.transformDirection(this.tempMatrixRight);
        break
      case 'KeyC':
        this.showMeshCursor = !this.showMeshCursor;
        break
      case 'KeyU':
        this.showControlPlane = !this.showControlPlane;
        break
      case 'KeyI':
        this.showInfo = !this.showInfo;
        if (this.showInfo) {
          // this.infoPanel.show()
        } else {
          // this.infoPanel.hide()
        }
        break
      case 'KeyO':
        if (!this.usingExternalCamera) {
          this.setOrthographicMode(!this.camera.isOrthographicCamera);
        }
        break
      case 'KeyP':
        if (!this.usingExternalCamera) {
          this.splatMesh.setPointCloudModeEnabled(
            !this.splatMesh.getPointCloudModeEnabled()
          );
        }
        break
      case 'Equal':
        if (!this.usingExternalCamera) {
          this.splatMesh.setSplatScale(this.splatMesh.getSplatScale() + 0.05);
        }
        break
      case 'Minus':
        if (!this.usingExternalCamera) {
          this.splatMesh.setSplatScale(
            Math.max(this.splatMesh.getSplatScale() - 0.05, 0.0)
          );
        }
        break
    }
  }

  onMouseMove(mouse) {
    this.mousePosition.set(mouse.offsetX, mouse.offsetY);
  }

  onMouseDown() {
    this.mouseDownPosition.copy(this.mousePosition);
    this.mouseDownTime = getCurrentTime();
  }

  onMouseUp = (function () {
    const clickOffset = new Vector2();

    return function (mouse) {
      clickOffset.copy(this.mousePosition).sub(this.mouseDownPosition);
      const mouseUpTime = getCurrentTime();
      const wasClick =
        mouseUpTime - this.mouseDownTime < 0.5 && clickOffset.length() < 2;
      if (wasClick) {
        this.onMouseClick(mouse);
      }
    }
  })()

  onMouseClick(mouse) {
    this.mousePosition.set(mouse.offsetX, mouse.offsetY);
    this.checkForFocalPointChange();
  }

  checkPointRenderDimensions = new Vector2()
  checkPointToNewFocalPoint = new Vector3()
  checkPointOutHits = []
  checkForFocalPointChange = () => {
    if (!this.transitioningCameraTarget) {
      this.getRenderDimensions(this.checkPointRenderDimensions);
      this.checkPointOutHits.length = 0;
      this.raycaster.setFromCameraAndScreenPosition(
        this.camera,
        this.mousePosition,
        this.checkPointRenderDimensions
      );
      this.raycaster.intersectSplatMesh(this.splatMesh, this.checkPointOutHits);
      if (this.checkPointOutHits.length > 0) {
        const hit = this.checkPointOutHits[0];
        const intersectionPoint = hit.origin;
        this.checkPointToNewFocalPoint
          .copy(intersectionPoint)
          .sub(this.camera.position);
        if (
          this.checkPointToNewFocalPoint.length() >
          MINIMUM_DISTANCE_TO_NEW_FOCAL_POINT
        ) {
          this.previousCameraTarget.copy(this.controls.target);
          this.nextCameraTarget.copy(intersectionPoint);
          this.transitioningCameraTarget = true;
          this.transitioningCameraTargetStartTime = getCurrentTime();
        }
      }
    }
  }

  getRenderDimensions(outDimensions) {
    if (this.rootElement) {
      outDimensions.x = this.rootElement.offsetWidth;
      outDimensions.y = this.rootElement.offsetHeight;
    } else {
      this.renderer.getSize(outDimensions);
    }
  }

  setOrthographicMode(orthographicMode) {
    if (orthographicMode === this.camera.isOrthographicCamera) return
    const fromCamera = this.camera;
    const toCamera = orthographicMode
      ? this.orthographicCamera
      : this.perspectiveCamera;
    toCamera.position.copy(fromCamera.position);
    toCamera.up.copy(fromCamera.up);
    toCamera.rotation.copy(fromCamera.rotation);
    toCamera.quaternion.copy(fromCamera.quaternion);
    toCamera.matrix.copy(fromCamera.matrix);
    this.camera = toCamera;

    if (this.controls) {
      const resetControls = (controls) => {
        controls.saveState();
        controls.reset();
      };

      const fromControls = this.controls;
      const toControls = orthographicMode
        ? this.orthographicControls
        : this.perspectiveControls;

      resetControls(toControls);
      resetControls(fromControls);

      toControls.target.copy(fromControls.target);
      if (orthographicMode) {
        Viewer.setCameraZoomFromPosition(toCamera, fromCamera, fromControls);
      } else {
        Viewer.setCameraPositionFromZoom(toCamera, fromCamera, toControls);
      }
      this.controls = toControls;
      this.camera.lookAt(this.controls.target);
    }
  }

  static setCameraPositionFromZoom = (function () {
    const tempVector = new Vector3();

    return function (positionCamera, zoomedCamera, controls) {
      const toLookAtDistance = 1 / (zoomedCamera.zoom * 0.001);
      tempVector
        .copy(controls.target)
        .sub(positionCamera.position)
        .normalize()
        .multiplyScalar(toLookAtDistance)
        .negate();
      positionCamera.position.copy(controls.target).add(tempVector);
    }
  })()

  static setCameraZoomFromPosition = (function () {
    const tempVector = new Vector3();

    return function (zoomCamera, positionZamera, controls) {
      const toLookAtDistance = tempVector
        .copy(controls.target)
        .sub(positionZamera.position)
        .length();
      zoomCamera.zoom = 1 / (toLookAtDistance * 0.001);
    }
  })()

  updateSplatMesh = (function () {
    const renderDimensions = new Vector2();

    return function () {
      if (!this.splatMesh) return
      const splatCount = this.splatMesh.getSplatCount();
      if (splatCount > 0) {
        this.splatMesh.updateVisibleRegionFadeDistance(this.sceneRevealMode);
        this.splatMesh.updateTransforms();
        this.getRenderDimensions(renderDimensions);
        const focalLengthX =
          this.camera.projectionMatrix.elements[0] *
          0.5 *
          this.devicePixelRatio *
          renderDimensions.x;
        const focalLengthY =
          this.camera.projectionMatrix.elements[5] *
          0.5 *
          this.devicePixelRatio *
          renderDimensions.y;

        const focalMultiplier = this.camera.isOrthographicCamera
          ? 1.0 / this.devicePixelRatio
          : 1.0;
        const focalAdjustment = this.focalAdjustment * focalMultiplier;
        const inverseFocalAdjustment = 1.0 / focalAdjustment;

        this.adjustForWebXRStereo(renderDimensions);
        this.splatMesh.updateUniforms(
          renderDimensions,
          focalLengthX * focalAdjustment,
          focalLengthY * focalAdjustment,
          this.camera.isOrthographicCamera,
          this.camera.zoom || 1.0,
          inverseFocalAdjustment
        );
      }
    }
  })()

  adjustForWebXRStereo(renderDimensions) {
    // TODO: Figure out a less hacky way to determine if stereo rendering is active
    if (this.camera && this.webXRActive) {
      const xrCamera = this.renderer.xr.getCamera();
      const xrCameraProj00 = xrCamera.projectionMatrix.elements[0];
      const cameraProj00 = this.camera.projectionMatrix.elements[0];
      renderDimensions.x *= cameraProj00 / xrCameraProj00;
    }
  }

  isLoadingOrUnloading() {
    return (
      Object.keys(this.splatSceneDownloadPromises).length > 0 ||
      this.splatSceneDownloadAndBuildPromise !== null ||
      this.splatSceneRemovalPromise !== null
    )
  }

  isDisposingOrDisposed() {
    return this.disposing || this.disposed
  }

  addSplatSceneDownloadController(controller) {
    this.splatSceneDownloadControllers.push(controller);
  }

  removeSplatSceneDownloadController(controller) {
    const index = this.splatSceneDownloadControllers.indexOf(controller);
    if (index > -1) {
        this.splatSceneDownloadControllers.splice(index, 1);
    }
  }

  addSplatSceneDownloadPromise(promise) {
    this.splatSceneDownloadPromises[promise.id] = promise;
  }

  removeSplatSceneDownloadPromise(promise) {
    delete this.splatSceneDownloadPromises[promise.id];
  }

  setSplatSceneDownloadAndBuildPromise(promise) {
    this.splatSceneDownloadAndBuildPromise = promise;
  }

  clearSplatSceneDownloadAndBuildPromise() {
    this.splatSceneDownloadAndBuildPromise = null;
  }

  /**
   * Add a splat scene to the viewer and display any loading UI if appropriate.
   * @param {string} path Path to splat scene to be loaded
   * @param {object} options {
   *
   *         splatAlphaRemovalThreshold: Ignore any splats with an alpha less than the specified
   *                                     value (valid range: 0 - 255), defaults to 1
   *
   *         showLoadingUI:         Display a loading spinner while the scene is loading, defaults to true
   *
   *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
   *
   *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
   *
   *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
   *
   *         onProgress:                 Function to be called as file data are received, or other processing occurs
   *
   *         headers:                    Optional HTTP headers to be sent along with splat requests
   * }
   * @return {Promise}
   */
  addSplatScene(path, options = {}) {
    if (this.isLoadingOrUnloading()) {
      throw new Error(
        'Cannot add splat scene while another load or unload is already in progress.'
      )
    }

    if (this.isDisposingOrDisposed()) {
      throw new Error('Cannot add splat scene after dispose() is called.')
    }

    if (
      options.progressiveLoad &&
      this.splatMesh.scenes &&
      this.splatMesh.scenes.length > 0
    ) {
      console.log(
        'addSplatScene(): "progressiveLoad" option ignore because there are multiple splat scenes'
      );
      options.progressiveLoad = false;
    }

    const format =
      options.format !== undefined && options.format !== null
        ? options.format
        : sceneFormatFromPath(path);
    const progressiveLoad =
      Viewer.isProgressivelyLoadable(format) && options.progressiveLoad;
    const showLoadingUI =
      options.showLoadingUI !== undefined && options.showLoadingUI !== null
        ? options.showLoadingUI
        : true;

    let loadingUITaskId = null;
    if (showLoadingUI) {
      this.loadingSpinner.removeAllTasks();
      loadingUITaskId = this.loadingSpinner.addTask('Downloading...');
    }
    const hideLoadingUI = () => {
      this.loadingProgressBar.hide();
      this.loadingSpinner.removeAllTasks();
    };

    const onProgressUIUpdate = (
      percentComplete,
      percentCompleteLabel,
      loaderStatus
    ) => {
      if (showLoadingUI) {
        if (loaderStatus === LoaderStatus.Downloading) {
          if (percentComplete == 100) {
            this.loadingSpinner.setMessageForTask(
              loadingUITaskId,
              'Download complete!'
            );
          } else {
            if (progressiveLoad) {
              this.loadingSpinner.setMessageForTask(
                loadingUITaskId,
                'Downloading splats...'
              );
            } else {
              const suffix = percentCompleteLabel
                ? `: ${percentCompleteLabel}`
                : `...`;
              this.loadingSpinner.setMessageForTask(
                loadingUITaskId,
                `Downloading${suffix}`
              );
            }
          }
        } else if (loaderStatus === LoaderStatus.Processing) {
          console.log('loaderStatus === LoaderStatus.Processing');
          this.loadingSpinner.setMessageForTask(
            loadingUITaskId,
            'Processing splats...'
          );
        }
      }
    };

    let downloadDone = false;
    let downloadedPercentage = 0;
    const splatBuffersAddedUIUpdate = (firstBuild, finalBuild) => {
      if (showLoadingUI) {
        if (
          (firstBuild && progressiveLoad) ||
          (finalBuild && !progressiveLoad)
        ) {
          this.loadingSpinner.removeTask(loadingUITaskId);
          if (!finalBuild && !downloadDone) this.loadingProgressBar.show();
        }
        if (progressiveLoad) {
          if (finalBuild) {
            downloadDone = true;
            this.loadingProgressBar.hide();
          } else {
            this.loadingProgressBar.setProgress(downloadedPercentage);
          }
        }
      }
    };

    const onProgress = (
      percentComplete,
      percentCompleteLabel,
      loaderStatus
    ) => {
      downloadedPercentage = percentComplete;
      onProgressUIUpdate(percentComplete, percentCompleteLabel, loaderStatus);
      if (options.onProgress)
        options.onProgress(percentComplete, percentCompleteLabel, loaderStatus);
    };

    const buildSection = (splatBuffer, firstBuild, finalBuild) => {
      if (!progressiveLoad && options.onProgress)
        options.onProgress(0, '0%', LoaderStatus.Processing);
      const addSplatBufferOptions = {
        rotation: options.rotation || options.orientation,
        position: options.position,
        scale: options.scale,
        splatAlphaRemovalThreshold: options.splatAlphaRemovalThreshold
      };
      return this.addSplatBuffers(
        [splatBuffer],
        [addSplatBufferOptions],
        finalBuild,
        firstBuild && showLoadingUI,
        showLoadingUI,
        progressiveLoad,
        progressiveLoad
      ).then(() => {
        if (!progressiveLoad && options.onProgress)
          options.onProgress(100, '100%', LoaderStatus.Processing);
        splatBuffersAddedUIUpdate(firstBuild, finalBuild);
      })
    };

    const loadFunc = progressiveLoad
      ? this.downloadAndBuildSingleSplatSceneProgressiveLoad.bind(this)
      : this.downloadAndBuildSingleSplatSceneStandardLoad.bind(this);
    return loadFunc(
      path,
      format,
      options.splatAlphaRemovalThreshold,
      buildSection.bind(this),
      onProgress,
      hideLoadingUI.bind(this),
      options.headers
    )
  }

  /**
   * Download a single splat scene, convert to splat buffer and then rebuild the viewer's splat mesh
   * by calling 'buildFunc' -- all before displaying the scene. Also sets/clears relevant instance synchronization objects,
   * and calls appropriate functions on success or failure.
   * @param {string} path Path to splat scene to be loaded
   * @param {SceneFormat} format Format of the splat scene file
   * @param {number} splatAlphaRemovalThreshold Ignore any splats with an alpha less than the specified value (valid range: 0 - 255)
   * @param {function} buildFunc Function to build the viewer's splat mesh with the downloaded splat buffer
   * @param {function} onProgress Function to be called as file data are received, or other processing occurs
   * @param {function} onException Function to be called when exception occurs
   * @param {object} headers Optional HTTP headers to pass to use for downloading splat scene
   * @return {Promise}
   */
  downloadAndBuildSingleSplatSceneStandardLoad(
    path,
    format,
    splatAlphaRemovalThreshold,
    buildFunc,
    onProgress,
    onException,
    headers
  ) {
    const downloadPromise = this.downloadSplatSceneToSplatBuffer(
      path,
      splatAlphaRemovalThreshold,
      onProgress,
      false,
      undefined,
      format,
      headers
    );

    // Create a promise that can be resolved/rejected externally, with abort capability
    const downloadAndBuildPromise = abortablePromiseWithExtractedComponents(
      downloadPromise.abort ? downloadPromise.abort.bind(downloadPromise) : undefined
    );

    downloadPromise
      .then((splatBuffer) => {
        this.removeSplatSceneDownloadPromise(downloadPromise);
        return buildFunc(splatBuffer, true, true).then(() => {
          downloadAndBuildPromise.resolve();
          this.clearSplatSceneDownloadAndBuildPromise();
        })
      })
      .catch((e) => {
        if (onException) onException();
        this.clearSplatSceneDownloadAndBuildPromise();
        this.removeSplatSceneDownloadPromise(downloadPromise);
        const error =
          (e instanceof AbortedPromiseError || e.name === 'AbortError')
            ? e
            : new Error(`Viewer::addSplatScene -> Could not load file ${path}`);
        downloadAndBuildPromise.reject(error);
      });

    this.addSplatSceneDownloadPromise(downloadPromise);
    this.setSplatSceneDownloadAndBuildPromise(downloadAndBuildPromise.promise);

    return downloadAndBuildPromise.promise
  }

  /**
   * Download a single splat scene and convert to splat buffer in a progressive manner, allowing rendering as the file downloads.
   * As each section is downloaded, the viewer's splat mesh is rebuilt by calling 'buildFunc'
   * Also sets/clears relevant instance synchronization objects, and calls appropriate functions on success or failure.
   * @param {string} path Path to splat scene to be loaded
   * @param {SceneFormat} format Format of the splat scene file
   * @param {number} splatAlphaRemovalThreshold Ignore any splats with an alpha less than the specified value (valid range: 0 - 255)
   * @param {function} buildFunc Function to rebuild the viewer's splat mesh after a new splat buffer section is downloaded
   * @param {function} onDownloadProgress Function to be called as file data are received
   * @param {function} onDownloadException Function to be called when exception occurs at any point during the full download
   * @param {object} headers Optional HTTP headers to pass to use for downloading splat scene
   * @return {Promise}
   */
  downloadAndBuildSingleSplatSceneProgressiveLoad(
    path,
    format,
    splatAlphaRemovalThreshold,
    buildFunc,
    onDownloadProgress,
    onDownloadException,
    headers
  ) {
    let progressiveLoadedSectionBuildCount = 0;
    let progressiveLoadedSectionBuilding = false;
    const queuedProgressiveLoadSectionBuilds = [];

    const checkAndBuildProgressiveLoadSections = () => {
      if (
        queuedProgressiveLoadSectionBuilds.length > 0 &&
        !progressiveLoadedSectionBuilding &&
        !this.isDisposingOrDisposed()
      ) {
        progressiveLoadedSectionBuilding = true;
        const queuedBuild = queuedProgressiveLoadSectionBuilds.shift();
        buildFunc(
          queuedBuild.splatBuffer,
          queuedBuild.firstBuild,
          queuedBuild.finalBuild
        ).then(() => {
          progressiveLoadedSectionBuilding = false;
          if (queuedBuild.firstBuild) {
            progressiveLoadFirstSectionBuildPromise.resolve();
          } else if (queuedBuild.finalBuild) {
            splatSceneDownloadAndBuildPromise.resolve();
            this.clearSplatSceneDownloadAndBuildPromise();
          }
          if (queuedProgressiveLoadSectionBuilds.length > 0) {
            delayedExecute(() => checkAndBuildProgressiveLoadSections());
          }
        });
      }
    };

    const onProgressiveLoadSectionProgress = (splatBuffer, finalBuild) => {
      if (!this.isDisposingOrDisposed()) {
        if (
          finalBuild ||
          queuedProgressiveLoadSectionBuilds.length === 0 ||
          splatBuffer.getSplatCount() >
            queuedProgressiveLoadSectionBuilds[0].splatBuffer.getSplatCount()
        ) {
          queuedProgressiveLoadSectionBuilds.push({
            splatBuffer,
            firstBuild: progressiveLoadedSectionBuildCount === 0,
            finalBuild
          });
          progressiveLoadedSectionBuildCount++;
          checkAndBuildProgressiveLoadSections();
        }
      }
    };

    const splatSceneDownloadPromise = this.downloadSplatSceneToSplatBuffer(
      path,
      splatAlphaRemovalThreshold,
      onDownloadProgress,
      true,
      onProgressiveLoadSectionProgress,
      format,
      headers
    );

    // Get abort handler from download promise
    const abortHandler = splatSceneDownloadPromise.abort 
      ? splatSceneDownloadPromise.abort.bind(splatSceneDownloadPromise) 
      : undefined;

    const progressiveLoadFirstSectionBuildPromise =
      abortablePromiseWithExtractedComponents(abortHandler);

    const splatSceneDownloadAndBuildPromise =
      abortablePromiseWithExtractedComponents(abortHandler);

    this.addSplatSceneDownloadPromise(splatSceneDownloadPromise);
    this.setSplatSceneDownloadAndBuildPromise(
      splatSceneDownloadAndBuildPromise.promise
    );

    splatSceneDownloadPromise
      .then(() => {
        this.removeSplatSceneDownloadPromise(splatSceneDownloadPromise);
      })
      .catch((e) => {
        console.error('Viewer::addSplatScene actual error:', e);
        this.clearSplatSceneDownloadAndBuildPromise();
        this.removeSplatSceneDownloadPromise(splatSceneDownloadPromise);
        const error =
          (e instanceof AbortedPromiseError || e.name === 'AbortError')
            ? e
            : new Error(
                `Viewer::addSplatScene -> Could not load one or more scenes: ${e.message}`
              );
        progressiveLoadFirstSectionBuildPromise.reject(error);
        if (onDownloadException) onDownloadException(error);
      });

    return progressiveLoadFirstSectionBuildPromise.promise
  }

  /**
   * Add multiple splat scenes to the viewer and display any loading UI if appropriate.
   * @param {Array<object>} sceneOptions Array of per-scene options: {
   *
   *         path: Path to splat scene to be loaded
   *
   *         splatAlphaRemovalThreshold: Ignore any splats with an alpha less than the specified
   *                                     value (valid range: 0 - 255), defaults to 1
   *
   *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
   *
   *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
   *
   *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
   *
   *         headers:                    Optional HTTP headers to be sent along with splat requests
   *
   *         format (SceneFormat)        Optional, the format of the scene data (.ply, .ksplat, .splat). If not present, the
   *                                     file extension in 'path' will be used to determine the format (if it is present)
   * }
   * @param {boolean} showLoadingUI Display a loading spinner while the scene is loading, defaults to true
   * @param {function} onProgress Function to be called as file data are received
   * @return {Promise}
   */
  addSplatScenes(sceneOptions, showLoadingUI = true, onProgress = undefined) {
    if (this.isLoadingOrUnloading()) {
      throw new Error(
        'Cannot add splat scene while another load or unload is already in progress.'
      )
    }

    if (this.isDisposingOrDisposed()) {
      throw new Error('Cannot add splat scene after dispose() is called.')
    }

    const fileCount = sceneOptions.length;
    const percentComplete = [];

    let loadingUITaskId;
    if (showLoadingUI) {
      this.loadingSpinner.removeAllTasks();
      loadingUITaskId = this.loadingSpinner.addTask('Downloading...');
    }

    const onLoadProgress = (fileIndex, percent, percentLabel, loaderStatus) => {
      percentComplete[fileIndex] = percent;
      let totalPercent = 0;
      for (let i = 0; i < fileCount; i++)
        totalPercent += percentComplete[i] || 0;
      totalPercent = totalPercent / fileCount;
      percentLabel = `${totalPercent.toFixed(2)}%`;
      if (showLoadingUI) {
        if (loaderStatus === LoaderStatus.Downloading) {
          this.loadingSpinner.setMessageForTask(
            loadingUITaskId,
            totalPercent == 100
              ? `Download complete!`
              : `Downloading: ${percentLabel}`
          );
        }
      }
      if (onProgress) onProgress(totalPercent, percentLabel, loaderStatus);
    };

    const abortController = new AbortController();
    const signal = abortController.signal;
    this.addSplatSceneDownloadController(abortController);

    const downloadPromises = [];
    for (let i = 0; i < sceneOptions.length; i++) {
      const options = sceneOptions[i];
      const format =
        options.format !== undefined && options.format !== null
          ? options.format
          : sceneFormatFromPath(options.path);
      const downloadPromise = this.downloadSplatSceneToSplatBuffer(
        options.path,
        options.splatAlphaRemovalThreshold,
        onLoadProgress.bind(this, i),
        false,
        undefined,
        format,
        options.headers,
        signal
      );
      downloadPromises.push(downloadPromise);
    }

    const downloadAndBuildPromise = Promise.all(downloadPromises)
      .then((splatBuffers) => {
        if (showLoadingUI) this.loadingSpinner.removeTask(loadingUITaskId);
        if (onProgress) onProgress(0, '0%', LoaderStatus.Processing);
        return this.addSplatBuffers(
          splatBuffers,
          sceneOptions,
          true,
          showLoadingUI,
          showLoadingUI,
          false,
          false
        ).then(() => {
          if (onProgress) onProgress(100, '100%', LoaderStatus.Processing);
          this.clearSplatSceneDownloadAndBuildPromise();
        });
      })
      .catch((e) => {
        if (showLoadingUI) this.loadingSpinner.removeTask(loadingUITaskId);
        this.clearSplatSceneDownloadAndBuildPromise();
        const error =
          e.name === 'AbortError'
            ? e
            : new Error(
                `Viewer::addSplatScenes -> Could not load one or more splat scenes.`
              );
        throw error;
      })
      .finally(() => {
        this.removeSplatSceneDownloadController(abortController);
      });

    this.setSplatSceneDownloadAndBuildPromise(downloadAndBuildPromise);
    return downloadAndBuildPromise
  }

  /**
   * Download a splat scene and convert to SplatBuffer instance.
   * @param {string} path Path to splat scene to be loaded
   * @param {number} splatAlphaRemovalThreshold Ignore any splats with an alpha less than the specified
   *                                            value (valid range: 0 - 255), defaults to 1
   *
   * @param {function} onProgress Function to be called as file data are received
   * @param {boolean} progressiveBuild Construct file sections into splat buffers as they are downloaded
   * @param {function} onSectionBuilt Function to be called when new section is added to the file
   * @param {string} format File format of the scene
   * @param {object} headers Optional HTTP headers to pass to use for downloading splat scene
   * @param {AbortSignal} signal Optional AbortSignal to cancel the download
   * @return {AbortablePromise}
   */
  downloadSplatSceneToSplatBuffer(
    path,
    splatAlphaRemovalThreshold = 1,
    onProgress = undefined,
    progressiveBuild = false,
    onSectionBuilt = undefined,
    format,
    headers
  ) {
    const optimizeSplatData = progressiveBuild ? false : this.optimizeSplatData;
    try {
      if (format === SceneFormat.Ply) {
        return PlyLoader.loadFromURL(
          path,
          onProgress,
          progressiveBuild,
          onSectionBuilt,
          splatAlphaRemovalThreshold,
          this.inMemoryCompressionLevel,
          optimizeSplatData,
          this.sphericalHarmonicsDegree,
          headers
        )
      }
    } catch (e) {
      if (e instanceof DirectLoadError) {
        throw new Error(
          'File type or server does not support progressive loading.'
        )
      } else {
        throw e
      }
    }

    throw new Error(
      `Viewer::downloadSplatSceneToSplatBuffer -> File format not supported: ${path}`
    )
  }

  static isProgressivelyLoadable(format) {
    return format === SceneFormat.Ply
  }

  /**
   * Add one or more instances of SplatBuffer to the SplatMesh instance managed by the viewer and set up the sorting web worker.
   * This function will terminate the existing sort worker (if there is one).
   */
  addSplatBuffers = (
    splatBuffers,
    splatBufferOptions = [],
    finalBuild = true,
    showLoadingUI = true,
    showLoadingUIForSplatTreeBuild = true,
    replaceExisting = false,
    enableRenderBeforeFirstSort = false,
    preserveVisibleRegion = true
  ) => {
    if (this.isDisposingOrDisposed()) return Promise.resolve()

    let splatProcessingTaskId = null;
    const removeSplatProcessingTask = () => {
      if (splatProcessingTaskId !== null) {
        this.loadingSpinner.removeTask(splatProcessingTaskId);
        splatProcessingTaskId = null;
      }
    };

    this.splatRenderReady = false;
    return new Promise((resolve) => {
      if (showLoadingUI) {
        splatProcessingTaskId = this.loadingSpinner.addTask(
          'Processing splats...'
        );
      }
      delayedExecute(() => {
        if (this.isDisposingOrDisposed()) {
          resolve();
        } else {
          const buildResults = this.addSplatBuffersToMesh(
            splatBuffers,
            splatBufferOptions,
            finalBuild,
            showLoadingUIForSplatTreeBuild,
            replaceExisting,
            preserveVisibleRegion
          );

          const maxSplatCount = this.splatMesh.getMaxSplatCount();
          if (
            this.sortWorker &&
            this.sortWorker.maxSplatCount !== maxSplatCount
          )
            this.disposeSortWorker();
          // If we aren't calculating the splat distances from the center on the GPU, the sorting worker needs
          // splat centers and transform indexes so that it can calculate those distance values.
          if (!this.gpuAcceleratedSort) {
            this.preSortMessages.push({
              centers: buildResults.centers.buffer,
              sceneIndexes: buildResults.sceneIndexes.buffer,
              range: {
                from: buildResults.from,
                to: buildResults.to,
                count: buildResults.count
              }
            });
          }
          const sortWorkerSetupPromise =
            !this.sortWorker && maxSplatCount > 0
              ? this.setupSortWorker(this.splatMesh)
              : Promise.resolve();
          sortWorkerSetupPromise.then(() => {
            if (this.isDisposingOrDisposed()) return
            this.runSplatSort(true, true).then((sortRunning) => {
              if (!this.sortWorker || !sortRunning) {
                this.splatRenderReady = true;
                removeSplatProcessingTask();
                resolve();
              } else {
                if (enableRenderBeforeFirstSort) {
                  this.splatRenderReady = true;
                } else {
                  this.runAfterNextSort.push(() => {
                    this.splatRenderReady = true;
                  });
                }
                this.runAfterNextSort.push(() => {
                  removeSplatProcessingTask();
                  resolve();
                });
              }
            });
          });
        }
      }, true);
    })
  }

  /**
   * Add one or more instances of SplatBuffer to the SplatMesh instance managed by the viewer. By default, this function is additive;
   * all splat buffers contained by the viewer's splat mesh before calling this function will be preserved. This behavior can be
   * changed by passing 'true' for 'replaceExisting'.
   * @param {Array<SplatBuffer>} splatBuffers SplatBuffer instances
   * @param {Array<object>} splatBufferOptions Array of options objects: {
   *
   *         splatAlphaRemovalThreshold: Ignore any splats with an alpha less than the specified
   *                                     value (valid range: 0 - 255), defaults to 1
   *
   *         position (Array<number>):   Position of the scene, acts as an offset from its default position, defaults to [0, 0, 0]
   *
   *         rotation (Array<number>):   Rotation of the scene represented as a quaternion, defaults to [0, 0, 0, 1]
   *
   *         scale (Array<number>):      Scene's scale, defaults to [1, 1, 1]
   * }
   * @param {boolean} finalBuild Will the splat mesh be in its final state after this build?
   * @param {boolean} showLoadingUIForSplatTreeBuild Whether or not to show the loading spinner during construction of the splat tree.
   * @return {object} Object containing info about the splats that are updated
   */
  addSplatBuffersToMesh = (function () {
    let splatOptimizingTaskId;

    return function (
      splatBuffers,
      splatBufferOptions,
      finalBuild = true,
      showLoadingUIForSplatTreeBuild = false,
      replaceExisting = false,
      preserveVisibleRegion = true
    ) {
      if (this.isDisposingOrDisposed()) return
      let allSplatBuffers = [];
      let allSplatBufferOptions = [];
      if (!replaceExisting) {
        allSplatBuffers =
          this.splatMesh.scenes.map((scene) => scene.splatBuffer) || [];
        allSplatBufferOptions = this.splatMesh.sceneOptions
          ? this.splatMesh.sceneOptions.map((sceneOptions) => sceneOptions)
          : [];
      }
      allSplatBuffers.push(...splatBuffers);
      allSplatBufferOptions.push(...splatBufferOptions);
      if (this.renderer) this.splatMesh.setRenderer(this.renderer);
      const onSplatTreeIndexesUpload = (finished) => {
        if (this.isDisposingOrDisposed()) return
        const splatCount = this.splatMesh.getSplatCount();
        if (
          showLoadingUIForSplatTreeBuild &&
          splatCount >= MIN_SPLAT_COUNT_TO_SHOW_SPLAT_TREE_LOADING_SPINNER
        ) {
          if (!finished && !splatOptimizingTaskId) {
            this.loadingSpinner.setMinimized(true, true);
            splatOptimizingTaskId = this.loadingSpinner.addTask(
              'Optimizing data structures...'
            );
          }
        }
      };
      const onSplatTreeReady = (finished) => {
        if (this.isDisposingOrDisposed()) return
        if (finished && splatOptimizingTaskId) {
          this.loadingSpinner.removeTask(splatOptimizingTaskId);
          splatOptimizingTaskId = null;
        }
      };
      const buildResults = this.splatMesh.build(
        allSplatBuffers,
        allSplatBufferOptions,
        true,
        finalBuild,
        onSplatTreeIndexesUpload,
        onSplatTreeReady,
        preserveVisibleRegion
      );
      if (finalBuild && this.freeIntermediateSplatData)
        this.splatMesh.freeIntermediateSplatData();
      return buildResults
    }
  })()

  /**
   * Set up the splat sorting web worker.
   * @param {SplatMesh} splatMesh SplatMesh instance that contains the splats to be sorted
   * @return {Promise}
   */
  async setupSortWorker(splatMesh) {
    if (this.isDisposingOrDisposed()) return
    const DistancesArrayType = this.integerBasedSort
      ? Int32Array
      : Float32Array;
    const splatCount = splatMesh.getSplatCount();
    const maxSplatCount = splatMesh.getMaxSplatCount();
    this.sortWorker = await createSortWorker(
      maxSplatCount,
      this.sharedMemoryForWorkers,
      this.enableSIMDInSort,
      this.integerBasedSort,
      this.splatMesh.dynamicMode,
      this.splatSortDistanceMapPrecision
    );
    return new Promise((resolve) => {
      this.sortWorker.onmessage = (e) => {
        if (e.data.sortDone) {
          this.sortRunning = false;
          let numbersArray = Array.from(
            { length: this.gaussianSplatCount },
            (_, i) => i
          );
          if (this.sharedMemoryForWorkers) {
            this.splatMesh.updateRenderIndexes(
              this.sortWorkerSortedIndexes,
              e.data.splatRenderCount
            );
          } else {
            const sortedIndexes = new Uint32Array(
              e.data.sortedIndexes.buffer,
              0,
              e.data.splatRenderCount
            );
            // console.log(sortedIndexes);
            this.splatMesh.updateRenderIndexes(
              sortedIndexes,
              e.data.splatRenderCount
            );
          }

          this.lastSplatSortCount = this.splatSortCount;

          this.lastSortTime = e.data.sortTime;
          this.sortPromiseResolver();
          this.sortPromiseResolver = null;
          this.forceRenderNextFrame();
          if (this.runAfterNextSort.length > 0) {
            this.runAfterNextSort.forEach((func) => {
              func();
            });
            this.runAfterNextSort.length = 0;
          }
        } else if (e.data.sortCanceled) {
          this.sortRunning = false;
        } else if (e.data.sortSetupPhase1Complete) {
          if (this.logLevel >= LogLevel.Info)
            console.log('Sorting web worker WASM setup complete.');
          if (this.sharedMemoryForWorkers) {
            this.sortWorkerSortedIndexes = new Uint32Array(
              e.data.sortedIndexesBuffer,
              e.data.sortedIndexesOffset,
              maxSplatCount
            );
            this.sortWorkerIndexesToSort = new Uint32Array(
              e.data.indexesToSortBuffer,
              e.data.indexesToSortOffset,
              maxSplatCount
            );
            this.sortWorkerPrecomputedDistances = new DistancesArrayType(
              e.data.precomputedDistancesBuffer,
              e.data.precomputedDistancesOffset,
              maxSplatCount
            );
            this.sortWorkerTransforms = new Float32Array(
              e.data.transformsBuffer,
              e.data.transformsOffset,
              Constants.MaxScenes * 16
            );
          } else {
            this.sortWorkerIndexesToSort = new Uint32Array(maxSplatCount);
            this.sortWorkerPrecomputedDistances = new DistancesArrayType(
              maxSplatCount
            );
            this.sortWorkerTransforms = new Float32Array(
              Constants.MaxScenes * 16
            );
          }
          for (let i = 0; i < splatCount; i++)
            this.sortWorkerIndexesToSort[i] = i;
          this.sortWorker.maxSplatCount = maxSplatCount;

          if (this.logLevel >= LogLevel.Info) {
            console.log('Sorting web worker ready.');
            const splatDataTextures = this.splatMesh.getSplatDataTextures();
            const covariancesTextureSize = splatDataTextures.covariances.size;
            const centersColorsTextureSize = splatDataTextures.centerColors.size;
            console.log(
              'Covariances texture size: ' +
                covariancesTextureSize.x +
                ' x ' +
                covariancesTextureSize.y
            );
            console.log(
              'Centers/colors texture size: ' +
                centersColorsTextureSize.x +
                ' x ' +
                centersColorsTextureSize.y
            );
          }

          resolve();
        }
      };
    })
  }

  disposeSortWorker() {
    if (this.sortWorker) this.sortWorker.terminate();
    this.sortWorker = null;
    this.sortPromise = null;
    if (this.sortPromiseResolver) {
      this.sortPromiseResolver();
      this.sortPromiseResolver = null;
    }
    this.preSortMessages = [];
    this.sortRunning = false;
  }

  removeSplatScene(indexToRemove, showLoadingUI = true) {
    return this.removeSplatScenes([indexToRemove], showLoadingUI)
  }

  removeSplatScenes(indexesToRemove, showLoadingUI = true) {
    if (this.isLoadingOrUnloading()) {
      throw new Error(
        'Cannot remove splat scene while another load or unload is already in progress.'
      )
    }

    if (this.isDisposingOrDisposed()) {
      throw new Error('Cannot remove splat scene after dispose() is called.')
    }

    let sortPromise;

    this.splatSceneRemovalPromise = new Promise((resolve, reject) => {
      let revmovalTaskId;

      if (showLoadingUI) {
        this.loadingSpinner.removeAllTasks();
        this.loadingSpinner.show();
        revmovalTaskId = this.loadingSpinner.addTask('Removing splat scene...');
      }

      const checkAndHideLoadingUI = () => {
        if (showLoadingUI) {
          this.loadingSpinner.hide();
          this.loadingSpinner.removeTask(revmovalTaskId);
        }
      };

      const onDone = (error) => {
        checkAndHideLoadingUI();
        this.splatSceneRemovalPromise = null;
        if (!error) resolve();
        else reject(error);
      };

      const checkForEarlyExit = () => {
        if (this.isDisposingOrDisposed()) {
          onDone();
          return true
        }
        return false
      };

      sortPromise = this.sortPromise || Promise.resolve();
      sortPromise.then(() => {
        if (checkForEarlyExit()) return
        const savedSplatBuffers = [];
        const savedSceneOptions = [];
        const savedSceneTransformComponents = [];
        for (let i = 0; i < this.splatMesh.scenes.length; i++) {
          let shouldRemove = false;
          for (let indexToRemove of indexesToRemove) {
            if (indexToRemove === i) {
              shouldRemove = true;
              break
            }
          }
          if (!shouldRemove) {
            const scene = this.splatMesh.scenes[i];
            savedSplatBuffers.push(scene.splatBuffer);
            savedSceneOptions.push(this.splatMesh.sceneOptions[i]);
            savedSceneTransformComponents.push({
              position: scene.position.clone(),
              quaternion: scene.quaternion.clone(),
              scale: scene.scale.clone()
            });
          }
        }
        this.disposeSortWorker();
        this.splatMesh.dispose();
        this.sceneRevealMode = SceneRevealMode.Instant;
        this.createSplatMesh();
        this.addSplatBuffers(
          savedSplatBuffers,
          savedSceneOptions,
          true,
          false,
          true
        )
          .then(() => {
            if (checkForEarlyExit()) return
            checkAndHideLoadingUI();
            this.splatMesh.scenes.forEach((scene, index) => {
              scene.position.copy(savedSceneTransformComponents[index].position);
              scene.quaternion.copy(
                savedSceneTransformComponents[index].quaternion
              );
              scene.scale.copy(savedSceneTransformComponents[index].scale);
            });
            this.splatMesh.updateTransforms();
            this.splatRenderReady = false;

            this.runSplatSort(true).then(() => {
              if (checkForEarlyExit()) {
                this.splatRenderReady = true;
                return
              }
              sortPromise = this.sortPromise || Promise.resolve();
              sortPromise.then(() => {
                this.splatRenderReady = true;
                onDone();
              });
            });
          })
          .catch((e) => {
            onDone(e);
          });
      });
    });

    return this.splatSceneRemovalPromise
  }

  /**
   * Start self-driven mode
   */
  start() {
    if (this.selfDrivenMode) {
      this.requestFrameId = requestAnimationFrame(this.selfDrivenUpdateFunc);
      this.selfDrivenModeRunning = true;
    } else {
      throw new Error('Cannot start viewer unless it is in self driven mode.')
    }
  }

  /**
   * Stop self-driven mode
   */
  stop() {
    if (this.selfDrivenMode && this.selfDrivenModeRunning) {
      cancelAnimationFrame(this.requestFrameId);
      this.selfDrivenModeRunning = false;
    }
  }

  /**
   * Dispose of all resources held directly and indirectly by this viewer.
   */
  async dispose() {
    if (this.isDisposingOrDisposed()) return this.disposePromise

    for (let controller of this.splatSceneDownloadControllers) {
        controller.abort();
    }

    let waitPromises = [];
    if (this.sortPromise) {
      waitPromises.push(this.sortPromise);
    }

    this.disposing = true;
    this.disposePromise = Promise.all(waitPromises).finally(() => {
      this.stop();
      if (this.orthographicControls) {
        this.orthographicControls.dispose();
        this.orthographicControls = null;
      }
      if (this.perspectiveControls) {
        this.perspectiveControls.dispose();
        this.perspectiveControls = null;
      }
      this.controls = null;
      if (this.splatMesh) {
        this.splatMesh.dispose();
        this.splatMesh = null;
      }
      if (this.avatarMesh) {
        disposeAllMeshes(this.avatarMesh);
        this.avatarMesh = null;
      }
      if (this.sceneHelper) {
        this.sceneHelper.dispose();
        this.sceneHelper = null;
      }
      if (this.resizeObserver) {
        this.resizeObserver.unobserve(this.rootElement);
        this.resizeObserver = null;
      }
      this.disposeSortWorker();
      this.removeEventHandlers();

      this.loadingSpinner.removeAllTasks();
      this.loadingSpinner.setContainer(null);
      this.loadingProgressBar.hide();
      this.loadingProgressBar.setContainer(null);
      // this.infoPanel.setContainer(null)

      this.camera = null;
      this.threeScene = null;
      this.splatRenderReady = false;
      this.initialized = false;
      if (this.renderer) {
        if (!this.usingExternalRenderer) {
          this.rootElement.removeChild(this.renderer.domElement);
          this.renderer.dispose();
        }
        this.renderer = null;
      }

      if (!this.usingExternalRenderer) {
        // document.body.removeChild(this.rootElement);
      }

      this.sortWorkerSortedIndexes = null;
      this.sortWorkerIndexesToSort = null;
      this.sortWorkerPrecomputedDistances = null;
      this.sortWorkerTransforms = null;
      this.disposed = true;
      this.disposing = false;
      this.disposePromise = null;
    });
    return this.disposePromise
  }
  vsyncNum = 4
  selfDrivenUpdate() {
    if (this.selfDrivenMode) {
        this.requestFrameId = requestAnimationFrame(this.selfDrivenUpdateFunc);

        // const currentTime = getCurrentTime();
        // const calcDelta = currentTime - this.lastTime;
        // if (calcDelta >= 1.0 / 30.0) {
        //     this.lastTime = currentTime;
        // } else {
        //     return
        // }
    }
    this.vsyncCount++;

    if (this.vsyncCount < this.vsyncNum) {
      return
    }

    this.vsyncCount = 0;

    this.update();
    if (this.shouldRender()) {
      //add expression

      this.render();
      this.consecutiveRenderFrames++;
    } else {
      this.consecutiveRenderFrames = 0;
    }
    this.renderNextFrame = false;
  }

  forceRenderNextFrame() {
    this.renderNextFrame = true;
  }

  shouldRender = (function () {
    let renderCount = 0;
    const lastCameraPosition = new Vector3();
    const lastCameraOrientation = new Quaternion();
    const changeEpsilon = 0.0001;

    return function () {
      if (
        !this.initialized ||
        !this.splatRenderReady ||
        this.isDisposingOrDisposed()
      )
        return false

      let shouldRender = false;
      let cameraChanged = false;
      if (this.camera) {
        const cp = this.camera.position;
        const co = this.camera.quaternion;
        cameraChanged =
          Math.abs(cp.x - lastCameraPosition.x) > changeEpsilon ||
          Math.abs(cp.y - lastCameraPosition.y) > changeEpsilon ||
          Math.abs(cp.z - lastCameraPosition.z) > changeEpsilon ||
          Math.abs(co.x - lastCameraOrientation.x) > changeEpsilon ||
          Math.abs(co.y - lastCameraOrientation.y) > changeEpsilon ||
          Math.abs(co.z - lastCameraOrientation.z) > changeEpsilon ||
          Math.abs(co.w - lastCameraOrientation.w) > changeEpsilon;
      }

      shouldRender =
        this.renderMode !== RenderMode.Never &&
        (renderCount === 0 ||
          this.splatMesh.visibleRegionChanging ||
          cameraChanged ||
          this.renderMode === RenderMode.Always ||
          this.dynamicMode === true ||
          this.renderNextFrame);

      if (this.camera) {
        lastCameraPosition.copy(this.camera.position);
        lastCameraOrientation.copy(this.camera.quaternion);
      }

      renderCount++;
      return shouldRender
    }
  })()

  render = (function () {
    return function () {
      if (
        !this.initialized ||
        !this.splatRenderReady ||
        this.isDisposingOrDisposed()
      )
        return

      const hasRenderables = (threeScene) => {
        for (let child of threeScene.children) {
          if (child.visible) return true
        }
        return false
      };

      const savedAuoClear = this.renderer.autoClear;
      if (hasRenderables(this.threeScene)) {
        this.renderer.render(this.threeScene, this.camera);
        this.renderer.autoClear = false;
      }
      this.renderer.render(this.splatMesh, this.camera);
      this.renderer.autoClear = false;
      if (this.sceneHelper.getFocusMarkerOpacity() > 0.0)
        this.renderer.render(this.sceneHelper.focusMarker, this.camera);
      if (this.showControlPlane)
        this.renderer.render(this.sceneHelper.controlPlane, this.camera);
      this.renderer.autoClear = savedAuoClear;
    }
  })()


  update(renderer, camera) {
    // this.frame++
    const fpsDiv = document.getElementById('fps');
    if (fpsDiv) {
      fpsDiv.textContent = `FPS: ${this.currentFPS}`;
    }

    if(this.frame >= this.totalFrames) 
        this.frame = 0;
    
    if (this.dropInMode) this.updateForDropInMode(renderer, camera);

    if (
      !this.initialized ||
      !this.splatRenderReady ||
      this.isDisposingOrDisposed()
    )
      return

    if (this.controls) {
      this.controls.update();
      if (this.camera.isOrthographicCamera && !this.usingExternalCamera) {
        Viewer.setCameraPositionFromZoom(
          this.camera,
          this.camera,
          this.controls
        );
      }
    }
    this.runMorphUpdate();
    this.runSplatSort(true,true);

    const replaceIndexes = false;
    if (replaceIndexes) {
      this.splatMesh.updateRenderIndexes(
        this.sortedIndexes,
        this.sortedIndexes.length
      );
    }

    this.updateForRendererSizeChanges();
    this.updateSplatMesh();
    this.updateMeshCursor();
    this.updateFPS();
    this.timingSensitiveUpdates();
    // this.updateInfoPanel()
    this.updateControlPlane();
  }

  sortedIndexes
  updateForDropInMode(renderer, camera) {
    this.renderer = renderer;
    if (this.splatMesh) this.splatMesh.setRenderer(this.renderer);
    this.camera = camera;
    if (this.controls) this.controls.object = camera;
    this.init();
  }

  lastCalcTime = getCurrentTime()
  fpsFrameCount = 0
  updateFPS = () => {
    if (
      this.consecutiveRenderFrames >
      CONSECUTIVE_RENDERED_FRAMES_FOR_FPS_CALCULATION
    ) {
      const currentTime = getCurrentTime();
      const calcDelta = currentTime - this.lastCalcTime;
      if (calcDelta >= 1.0) {
        this.currentFPS = this.fpsFrameCount;
        this.fpsFrameCount = 0;
        this.lastCalcTime = currentTime;
      } else {
        this.fpsFrameCount++;
      }
    } else {
      this.currentFPS = null;
    }
  }

  updateForRendererSizeChanges = (function () {
    const lastRendererSize = new Vector2();
    const currentRendererSize = new Vector2();
    let lastCameraOrthographic;

    return function () {
      if (!this.usingExternalCamera) {
        this.renderer.getSize(currentRendererSize);
        if (
          lastCameraOrthographic === undefined ||
          lastCameraOrthographic !== this.camera.isOrthographicCamera ||
          currentRendererSize.x !== lastRendererSize.x ||
          currentRendererSize.y !== lastRendererSize.y
        ) {
          if (this.camera.isOrthographicCamera) {
            this.camera.left = -currentRendererSize.x / 2.0;
            this.camera.right = currentRendererSize.x / 2.0;
            this.camera.top = currentRendererSize.y / 2.0;
            this.camera.bottom = -currentRendererSize.y / 2.0;
          } else {
            this.camera.aspect = currentRendererSize.x / currentRendererSize.y;
          }
          this.camera.updateProjectionMatrix();
          lastRendererSize.copy(currentRendererSize);
          lastCameraOrthographic = this.camera.isOrthographicCamera;
        }
      }
    }
  })()

  timingSensitiveUpdates = (function () {
    let lastUpdateTime;

    return function () {
      const currentTime = getCurrentTime();
      if (!lastUpdateTime) lastUpdateTime = currentTime;
      const timeDelta = currentTime - lastUpdateTime;

      this.updateCameraTransition(currentTime);
      this.updateFocusMarker(timeDelta);

      lastUpdateTime = currentTime;
    }
  })()

  tempCameraTarget = new Vector3()
  toPreviousTarget = new Vector3()
  toNextTarget = new Vector3()
  updateCameraTransition = (currentTime) => {
    if (this.transitioningCameraTarget) {
      this.toPreviousTarget
        .copy(this.previousCameraTarget)
        .sub(this.camera.position)
        .normalize();
      this.toNextTarget
        .copy(this.nextCameraTarget)
        .sub(this.camera.position)
        .normalize();
      const rotationAngle = Math.acos(
        this.toPreviousTarget.dot(this.toNextTarget)
      );
      const rotationSpeed = (rotationAngle / (Math.PI / 3)) * 0.65 + 0.3;
      const t =
        (rotationSpeed / rotationAngle) *
        (currentTime - this.transitioningCameraTargetStartTime);
      this.tempCameraTarget
        .copy(this.previousCameraTarget)
        .lerp(this.nextCameraTarget, t);
      this.camera.lookAt(this.tempCameraTarget);
      this.controls.target.copy(this.tempCameraTarget);
      if (t >= 1.0) {
        this.transitioningCameraTarget = false;
      }
    }
  }

  updateFocusMarker = (function () {
    const renderDimensions = new Vector2();
    let wasTransitioning = false;

    return function (timeDelta) {
      this.getRenderDimensions(renderDimensions);
      if (this.transitioningCameraTarget) {
        this.sceneHelper.setFocusMarkerVisibility(true);
        const currentFocusMarkerOpacity = Math.max(
          this.sceneHelper.getFocusMarkerOpacity(),
          0.0
        );
        let newFocusMarkerOpacity = Math.min(
          currentFocusMarkerOpacity + FOCUS_MARKER_FADE_IN_SPEED * timeDelta,
          1.0
        );
        this.sceneHelper.setFocusMarkerOpacity(newFocusMarkerOpacity);
        this.sceneHelper.updateFocusMarker(
          this.nextCameraTarget,
          this.camera,
          renderDimensions
        );
        wasTransitioning = true;
        this.forceRenderNextFrame();
      } else {
        let currentFocusMarkerOpacity;
        if (wasTransitioning) currentFocusMarkerOpacity = 1.0;
        else
          currentFocusMarkerOpacity = Math.min(
            this.sceneHelper.getFocusMarkerOpacity(),
            1.0
          );
        if (currentFocusMarkerOpacity > 0) {
          this.sceneHelper.updateFocusMarker(
            this.nextCameraTarget,
            this.camera,
            renderDimensions
          );
          let newFocusMarkerOpacity = Math.max(
            currentFocusMarkerOpacity - FOCUS_MARKER_FADE_OUT_SPEED * timeDelta,
            0.0
          );
          this.sceneHelper.setFocusMarkerOpacity(newFocusMarkerOpacity);
          if (newFocusMarkerOpacity === 0.0)
            this.sceneHelper.setFocusMarkerVisibility(false);
        }
        if (currentFocusMarkerOpacity > 0.0) this.forceRenderNextFrame();
        wasTransitioning = false;
      }
    }
  })()

  updateMeshCursor = (function () {
    const outHits = [];
    const renderDimensions = new Vector2();

    return function () {
      if (this.showMeshCursor) {
        this.forceRenderNextFrame();
        this.getRenderDimensions(renderDimensions);
        outHits.length = 0;
        this.raycaster.setFromCameraAndScreenPosition(
          this.camera,
          this.mousePosition,
          renderDimensions
        );
        this.raycaster.intersectSplatMesh(this.splatMesh, outHits);
        if (outHits.length > 0) {
          this.sceneHelper.setMeshCursorVisibility(true);
          this.sceneHelper.positionAndOrientMeshCursor(
            outHits[0].origin,
            this.camera
          );
        } else {
          this.sceneHelper.setMeshCursorVisibility(false);
        }
      } else {
        if (this.sceneHelper.getMeschCursorVisibility())
          this.forceRenderNextFrame();
        this.sceneHelper.setMeshCursorVisibility(false);
      }
    }
  })()

  updateInfoPanel = (function () {
    const renderDimensions = new Vector2();

    return function () {
      if (!this.showInfo) return
      const splatCount = this.splatMesh.getSplatCount();
      this.getRenderDimensions(renderDimensions);
      const cameraLookAtPosition = this.controls ? this.controls.target : null;
      const meshCursorPosition = this.showMeshCursor
        ? this.sceneHelper.meshCursor.position
        : null;
      const splatRenderCountPct =
        splatCount > 0 ? (this.splatRenderCount / splatCount) * 100 : 0;
      // this.infoPanel.update(
      //   renderDimensions,
      //   this.camera.position,
      //   cameraLookAtPosition,
      //   this.camera.up,
      //   this.camera.isOrthographicCamera,
      //   meshCursorPosition,
      //   this.currentFPS || 'N/A',
      //   splatCount,
      //   this.splatRenderCount,
      //   splatRenderCountPct,
      //   this.lastSortTime,
      //   this.focalAdjustment,
      //   this.splatMesh.getSplatScale(),
      //   this.splatMesh.getPointCloudModeEnabled()
      // )
    }
  })()

  updateControlPlane() {
    if (this.showControlPlane) {
      this.sceneHelper.setControlPlaneVisibility(true);
      this.sceneHelper.positionAndOrientControlPlane(
        this.controls.target,
        this.camera.up
      );
    } else {
      this.sceneHelper.setControlPlaneVisibility(false);
    }
  }

  mvpMatrix = new Matrix4()
  cameraPositionArray = []
  lastSortViewDir = new Vector3(0, 0, -1)
  sortViewDir = new Vector3(0, 0, -1)
  lastSortViewPos = new Vector3()
  sortViewOffset = new Vector3()
  queuedSorts = []

  partialSorts = [
    {
      angleThreshold: 0.55,
      sortFractions: [0.125, 0.33333, 0.75]
    },
    {
      angleThreshold: 0.65,
      sortFractions: [0.33333, 0.66667]
    },
    {
      angleThreshold: 0.8,
      sortFractions: [0.5]
    }
  ]
  runSplatSort = (force = false, forceSortAll = false) => {
    if (!this.initialized) return Promise.resolve(false)
    if (this.sortRunning) return Promise.resolve(true)
    if (this.splatMesh.getSplatCount() <= 0) {
      this.splatRenderCount = 0;
      return Promise.resolve(false)
    }

    let angleDiff = 0;
    let positionDiff = 0;
    let needsRefreshForRotation = false;
    let needsRefreshForPosition = false;

    this.sortViewDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    angleDiff = this.sortViewDir.dot(this.lastSortViewDir);
    positionDiff = this.sortViewOffset
      .copy(this.camera.position)
      .sub(this.lastSortViewPos)
      .length();

    if (!force) {
      if (!this.splatMesh.dynamicMode && this.queuedSorts.length === 0) {
        if (angleDiff <= 0.99) needsRefreshForRotation = true;
        if (positionDiff >= 1.0) needsRefreshForPosition = true;
        if (!needsRefreshForRotation && !needsRefreshForPosition)
          return Promise.resolve(false)
      }
    }

    this.sortRunning = true;
    let { splatRenderCount, shouldSortAll } = this.gatherSceneNodesForSort();
    shouldSortAll = shouldSortAll || forceSortAll;
    this.splatRenderCount = splatRenderCount;

    this.mvpMatrix.copy(this.camera.matrixWorld).invert();
    const mvpCamera = this.perspectiveCamera || this.camera;
    this.mvpMatrix.premultiply(mvpCamera.projectionMatrix);
    if (!this.splatMesh.dynamicMode)
      this.mvpMatrix.multiply(this.splatMesh.matrixWorld);

    let gpuAcceleratedSortPromise = Promise.resolve(true);
    if (
      this.gpuAcceleratedSort &&
      (this.queuedSorts.length <= 1 || this.queuedSorts.length % 2 === 0)
    ) {
      gpuAcceleratedSortPromise = this.splatMesh.computeDistancesOnGPU(
        this.mvpMatrix,
        this.sortWorkerPrecomputedDistances
      );
    }

    gpuAcceleratedSortPromise.then(() => {
      if (this.queuedSorts.length === 0) {
        if (this.splatMesh.dynamicMode || shouldSortAll) {
          this.queuedSorts.push(this.splatRenderCount);
        } else {
          for (let partialSort of this.partialSorts) {
            if (angleDiff < partialSort.angleThreshold) {
              for (let sortFraction of partialSort.sortFractions) {
                this.queuedSorts.push(
                  Math.floor(this.splatRenderCount * sortFraction)
                );
              }
              break
            }
          }
          this.queuedSorts.push(this.splatRenderCount);
        }
      }
      let sortCount = Math.min(this.queuedSorts.shift(), this.splatRenderCount);
      this.splatSortCount = sortCount;

      this.cameraPositionArray[0] = this.camera.position.x;
      this.cameraPositionArray[1] = this.camera.position.y;
      this.cameraPositionArray[2] = this.camera.position.z;

      const sortMessage = {
        modelViewProj: this.mvpMatrix.elements,
        cameraPosition: this.cameraPositionArray,
        splatRenderCount: this.splatRenderCount,
        splatSortCount: sortCount,
        usePrecomputedDistances: this.gpuAcceleratedSort
      };
      if (this.splatMesh.dynamicMode) {
        this.splatMesh.fillTransformsArray(this.sortWorkerTransforms);
      }
      if (!this.sharedMemoryForWorkers) {
        sortMessage.indexesToSort = this.sortWorkerIndexesToSort;
        sortMessage.transforms = this.sortWorkerTransforms;
        if (this.gpuAcceleratedSort) {
          sortMessage.precomputedDistances = this.sortWorkerPrecomputedDistances;
        }
      }

      this.sortPromise = new Promise((resolve) => {
        this.sortPromiseResolver = resolve;
      });

      if (this.preSortMessages.length > 0) {
        this.preSortMessages.forEach((message) => {
          this.sortWorker.postMessage(message);
        });
        this.preSortMessages = [];
      }
      this.sortWorker.postMessage({
        sort: sortMessage
      });

      if (this.queuedSorts.length === 0) {
        this.lastSortViewPos.copy(this.camera.position);
        this.lastSortViewDir.copy(this.sortViewDir);
      }

      return true
    });

    return gpuAcceleratedSortPromise
  }

  /**
   * Determine which splats to render by checking which are inside or close to the view frustum
   */
  gatherSceneNodesForSort = (function () {
    const nodeRenderList = [];
    let allSplatsSortBuffer = null;
    const tempVectorYZ = new Vector3();
    const tempVectorXZ = new Vector3();
    const tempVector = new Vector3();
    const modelView = new Matrix4();
    const baseModelView = new Matrix4();
    const sceneTransform = new Matrix4();
    const renderDimensions = new Vector3();
    const forward = new Vector3(0, 0, -1);

    const tempMax = new Vector3();
    const nodeSize = (node) => {
      return tempMax.copy(node.max).sub(node.min).length()
    };

    return function (gatherAllNodes = false) {
      this.getRenderDimensions(renderDimensions);
      const cameraFocalLength =
        renderDimensions.y /
        2.0 /
        Math.tan((this.camera.fov / 2.0) * MathUtils.DEG2RAD);
      const fovXOver2 = Math.atan(renderDimensions.x / 2.0 / cameraFocalLength);
      const fovYOver2 = Math.atan(renderDimensions.y / 2.0 / cameraFocalLength);
      const cosFovXOver2 = Math.cos(fovXOver2);
      const cosFovYOver2 = Math.cos(fovYOver2);

      const splatTree = this.splatMesh.getSplatTree();

      if (splatTree) {
        baseModelView.copy(this.camera.matrixWorld).invert();
        if (!this.splatMesh.dynamicMode)
          baseModelView.multiply(this.splatMesh.matrixWorld);

        let nodeRenderCount = 0;
        let splatRenderCount = 0;

        for (let s = 0; s < splatTree.subTrees.length; s++) {
          const subTree = splatTree.subTrees[s];
          modelView.copy(baseModelView);
          if (this.splatMesh.dynamicMode) {
            this.splatMesh.getSceneTransform(s, sceneTransform);
            modelView.multiply(sceneTransform);
          }
          const nodeCount = subTree.nodesWithIndexes.length;
          for (let i = 0; i < nodeCount; i++) {
            const node = subTree.nodesWithIndexes[i];
            if (
              !node.data ||
              !node.data.indexes ||
              node.data.indexes.length === 0
            )
              continue
            tempVector.copy(node.center).applyMatrix4(modelView);

            const distanceToNode = tempVector.length();
            tempVector.normalize();

            tempVectorYZ.copy(tempVector).setX(0).normalize();
            tempVectorXZ.copy(tempVector).setY(0).normalize();

            const cameraAngleXZDot = forward.dot(tempVectorXZ);
            const cameraAngleYZDot = forward.dot(tempVectorYZ);

            const ns = nodeSize(node);
            const outOfFovY = cameraAngleYZDot < cosFovYOver2 - 0.6;
            const outOfFovX = cameraAngleXZDot < cosFovXOver2 - 0.6;
            if (
              !gatherAllNodes &&
              (outOfFovX || outOfFovY) &&
              distanceToNode > ns
            ) {
              continue
            }
            splatRenderCount += node.data.indexes.length;
            nodeRenderList[nodeRenderCount] = node;
            node.data.distanceToNode = distanceToNode;
            nodeRenderCount++;
          }
        }

        nodeRenderList.length = nodeRenderCount;
        nodeRenderList.sort((a, b) => {
          if (a.data.distanceToNode < b.data.distanceToNode) return -1
          else return 1
        });

        let currentByteOffset = splatRenderCount * Constants.BytesPerInt;
        for (let i = 0; i < nodeRenderCount; i++) {
          const node = nodeRenderList[i];
          const windowSizeInts = node.data.indexes.length;
          const windowSizeBytes = windowSizeInts * Constants.BytesPerInt;
          let destView = new Uint32Array(
            this.sortWorkerIndexesToSort.buffer,
            currentByteOffset - windowSizeBytes,
            windowSizeInts
          );
          destView.set(node.data.indexes);
          currentByteOffset -= windowSizeBytes;
        }

        return {
          splatRenderCount: splatRenderCount,
          shouldSortAll: false
        }
      } else {
        const totalSplatCount = this.splatMesh.getSplatCount();
        if (
          !allSplatsSortBuffer ||
          allSplatsSortBuffer.length !== totalSplatCount
        ) {
          allSplatsSortBuffer = new Uint32Array(totalSplatCount);
          for (let i = 0; i < totalSplatCount; i++) {
            allSplatsSortBuffer[i] = i;
          }
        }
        this.sortWorkerIndexesToSort.set(allSplatsSortBuffer);
        return {
          splatRenderCount: totalSplatCount,
          shouldSortAll: true
        }
      }
    }
  })()

  getSplatMesh() {
    return this.splatMesh
  }

  /**
   * Get a reference to a splat scene.
   * @param {number} sceneIndex The index of the scene to which the reference will be returned
   * @return {SplatScene}
   */
  getSplatScene(sceneIndex) {
    return this.splatMesh.getScene(sceneIndex)
  }

  getSceneCount() {
    return this.splatMesh.getSceneCount()
  }

  isMobile() {
    return navigator.userAgent.includes('Mobi')
  }

  createBonesFromJson(bonesJson) {
    const bones = [];

    function createBoneRecursive(jsonBone, parent = null) {
      const bone = new Bone();
      bone.name = jsonBone.name;
      if (parent) {
        parent.add(bone);
      }
      bone.position.set(...jsonBone.position);
      bones.push(bone);

      if (jsonBone.children) {
        jsonBone.children.forEach((childJsonBone) =>
          createBoneRecursive(childJsonBone, bone)
        );
      }
      return bone
    }

    bonesJson.forEach((boneJson) => createBoneRecursive(boneJson));

    return bones
  }

  updateMorphTarget(inputMesh) {
    this.avatarMesh = inputMesh;
    this.splatMesh.flameModel = inputMesh;
    this.splatMesh.useFlameModel = this.useFlame;
    if(this.useFlame == true) {
        // const skinData = {
        //     bones: [
        //         {
        //         "name": "root",
        //         "position": [-1.7149e-04, -1.4252e-01, -8.2541e-02],
        //         "children": [
        //             {
        //             "name": "neck",
        //             "position": [-5.6988e-05, -1.6069e-02, -5.7859e-02],
                    
        //             "children": [
        //                 {
        //                 "name": "jaw",
        //                     "position": [7.4429e-04, -8.7249e-03, -5.3760e-02]

        //                 },
        //                 {
        //                 "name": "leftEye",
        //                 "position": [  3.0240e-02,  2.3092e-02,  2.2900e-02]
        //                 },
        //                 {
        //                 "name": "rightEye",
        //                 "position": [-3.0296e-02,  2.3675e-02,  2.1837e-02]
        //                 }
        //             ]
        //             }
        //         ]
        //         }
        //     ] 
        // };

        // this.bones = this.createBonesFromJson(skinData.bones);
        this.bones = this.createBonesFromJson(this.bone_tree["bones"]);

        const bonesPosReserve = [new Vector3(this.bones[0].position.x, this.bones[0].position.y, this.bones[0].position.z),
        new Vector3(this.bones[1].position.x, this.bones[1].position.y, this.bones[1].position.z),
        new Vector3(this.bones[2].position.x, this.bones[2].position.y, this.bones[2].position.z),
        new Vector3(this.bones[3].position.x, this.bones[3].position.y, this.bones[3].position.z),
        new Vector3(this.bones[4].position.x, this.bones[4].position.y, this.bones[4].position.z)
        ];
        this.bones[1].position.copy(new Vector3(bonesPosReserve[1].x - bonesPosReserve[0].x, bonesPosReserve[1].y - bonesPosReserve[0].y, bonesPosReserve[1].z - bonesPosReserve[0].z));
        this.bones[2].position.copy(new Vector3(bonesPosReserve[2].x - bonesPosReserve[1].x, bonesPosReserve[2].y - bonesPosReserve[1].y, bonesPosReserve[2].z - bonesPosReserve[1].z));
        this.bones[3].position.copy(new Vector3(bonesPosReserve[3].x - bonesPosReserve[1].x, bonesPosReserve[3].y - bonesPosReserve[1].y, bonesPosReserve[3].z - bonesPosReserve[1].z));
        this.bones[4].position.copy(new Vector3(bonesPosReserve[4].x - bonesPosReserve[1].x, bonesPosReserve[4].y - bonesPosReserve[1].y, bonesPosReserve[4].z - bonesPosReserve[1].z));
        
        this.bones[0].updateMatrixWorld(true);
        const boneInverses = [this.bones[0].matrixWorld.clone().invert(),
                                this.bones[1].matrixWorld.clone().invert(),
                                this.bones[2].matrixWorld.clone().invert(),
                                this.bones[3].matrixWorld.clone().invert(),
                                this.bones[4].matrixWorld.clone().invert()];

        this.skeleton = new Skeleton(this.bones, boneInverses);
    }

    this.runMorphUpdate();
    this.splatMesh.gaussianSplatCount = this.gaussianSplatCount;
  }

  updatedBoneMatrices(boneNum){
    let updatedBoneMatrices = [];
    for (let j = 0; j < boneNum; j++) { 
        let boneMatrix;
        boneMatrix =  this.skeleton.bones[j].matrixWorld.clone().multiply(this.skeleton.boneInverses[j].clone());

        function addMatrixToArray(matrix, array) {
            let elements = matrix.elements; 
            for (let i = 0; i < elements.length; i++) {
                array.push(elements[i]);
            }
        }
        
        addMatrixToArray(boneMatrix, updatedBoneMatrices);
    }
    let bonesMatrix = new Float32Array(updatedBoneMatrices);
    return bonesMatrix;
}
  runMorphUpdate() {
    this.gaussianSplatCount = this.avatarMesh.geometry.attributes.position.count;
    var morphedMesh = new Float32Array(
      this.avatarMesh.geometry.attributes.position.array
    );
    const numBones = 5;
    this.splatMesh.bonesNum = numBones;
    if (this.useFlame == false) 
    {
        this.skinModel.skeleton.update();
        this.boneRoot.updateMatrixWorld(true);
        if (this.splatMesh.geometry.getAttribute('splatIndex') && this.setSkinAttibutes === false) {

          this.setSkinAttibutes = true;
          const geometry = this.splatMesh.geometry;

          const skinIndexSource = this.skinModel.geometry.attributes.skinIndex;
          const skinWeightSource = this.skinModel.geometry.attributes.skinWeight;

          const newSkinIndex = new InstancedBufferAttribute(
              new skinIndexSource.array.constructor(skinIndexSource.array), 
              4,
              skinIndexSource.normalized,
              1
          );
          
          const newSkinWeight = new InstancedBufferAttribute(
              new skinWeightSource.array.constructor(skinWeightSource.array), 
              4,
              skinWeightSource.normalized,
              1
          );
          newSkinIndex.setUsage(DynamicDrawUsage);
          newSkinWeight.setUsage(DynamicDrawUsage);
          geometry.setAttribute('skinIndex', newSkinIndex);
          geometry.setAttribute('skinWeight', newSkinWeight);
      }
    } else {
        this.updateFlameBones();
    }
    
    this.splatMesh.morphedMesh = morphedMesh;

    let splatNum = this.splatMesh.morphedMesh.length / 3;
    if (this.splatMesh.splatDataTextures['flameModel'] != undefined) {
      this.splatMesh.updateTetureAfterBSAndSkeleton(0, splatNum - 1, this.useFlame);
    }
  }

  updateFlameBones(){
    this.splatMesh.bsWeight = this.flame_params['expr'][this.frame];

    function setBoneRotationAndMatrix(bone, angles, isQuat = false) {
        let quaternion;
        if(isQuat == true) {
            quaternion = new Quaternion(angles[0], angles[1], angles[2], angles[3]);
        } else {
            const value = new Vector3(angles[0], angles[1], angles[2]);
            const angleInRadians = value.length();
            const axis = value.normalize();
            quaternion = new Quaternion().setFromAxisAngle(axis, angleInRadians);
        }
        bone.quaternion.copy(quaternion);
        bone.updateMatrixWorld(true);
    }

    let angle = this.flame_params['rotation'][this.frame];

    setBoneRotationAndMatrix(this.skeleton.bones[0], angle);

    angle = this.flame_params['neck_pose'][this.frame];
    setBoneRotationAndMatrix(this.skeleton.bones[1], angle);

    angle = this.flame_params['jaw_pose'][this.frame];
    setBoneRotationAndMatrix(this.skeleton.bones[2], angle);

    angle = this.flame_params['eyes_pose'][this.frame];
    setBoneRotationAndMatrix(this.skeleton.bones[3], angle);

    setBoneRotationAndMatrix(this.skeleton.bones[4], [angle[3], angle[4], angle[5]]);

    // update skeleton
    this.skeleton.update();

    const numBones = 5;
    const bonesMatrix = this.updatedBoneMatrices(numBones);
    this.splatMesh.bonesMatrix = bonesMatrix;
    this.splatMesh.bonesNum = numBones;
    this.splatMesh.bonesWeight = this.lbs_weight_80k;
  }
}