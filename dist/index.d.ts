import { Camera, Scene, WebGLRenderer, AnimationMixer, Clock, Vector3 } from 'three';

/**
 * Voice chat state enum
 */
export enum TYVoiceChatState {
    Idle = 'Idle',
    Hello = 'Hello',
    Listening = 'Listening',
    Thinking = 'Thinking',
    Responding = 'Responding'
}

/**
 * Scene format enum
 */
export enum SceneFormat {
    Ply = 0,
    Splat = 1,
    KSplat = 2
}

/**
 * Render mode enum
 */
export enum RenderMode {
    Always = 0,
    OnChange = 1,
    Never = 2
}

/**
 * Log level enum
 */
export enum LogLevel {
    None = 0,
    Info = 1,
    Warning = 2,
    Error = 3,
    Debug = 4
}

/**
 * Scene reveal mode enum
 */
export enum SceneRevealMode {
    Default = 0,
    Gradual = 1,
    Instant = 2
}

/**
 * Splat render mode enum
 */
export enum SplatRenderMode {
    Default = 0,
    TwoD = 1
}

/**
 * WebXR mode enum
 */
export enum WebXRMode {
    None = 0,
    VR = 1,
    AR = 2
}

/**
 * Options for getInstance
 */
export interface GaussianSplatRendererOptions {
    getChatState?: () => TYVoiceChatState | string;
    getExpressionData?: () => Record<string, number>;
    loadProgress?: (progress: number) => void;
    downloadProgress?: (progress: number) => void;
    backgroundColor?: string;
}

/**
 * Viewer options
 */
export interface ViewerOptions {
    rootElement?: HTMLElement;
    threejsCanvas?: HTMLCanvasElement;
    cameraUp?: [number, number, number];
    initialCameraPosition?: [number, number, number];
    initialCameraRotation?: [number, number, number];
    sphericalHarmonicsDegree?: number;
    backgroundColor?: number;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    ignoreDevicePixelRatio?: boolean;
    halfPrecisionCovariancesOnGPU?: boolean;
    antialiased?: boolean;
    focalAdjustment?: number;
    logLevel?: LogLevel;
    webXRMode?: WebXRMode;
    renderMode?: RenderMode;
    sceneRevealMode?: SceneRevealMode;
    splatRenderMode?: SplatRenderMode;
    dynamicScene?: boolean;
}

/**
 * Splat scene options
 */
export interface SplatSceneOptions {
    progressiveLoad?: boolean;
    sharedMemoryForWorkers?: boolean;
    showLoadingUI?: boolean;
    format?: SceneFormat;
    splatAlphaRemovalThreshold?: number;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
}

/**
 * Main GaussianSplatRenderer class
 */
export class GaussianSplatRenderer {
    static _canvas: HTMLCanvasElement;
    static instance: GaussianSplatRenderer | undefined;

    viewer: Viewer;
    zipUrls: {
        urls: Map<string, string>;
        zip?: any;
    };

    /**
     * Get or create a GaussianSplatRenderer instance
     */
    static getInstance(
        container: HTMLDivElement,
        assetPath: string,
        options?: GaussianSplatRendererOptions
    ): Promise<GaussianSplatRenderer>;

    /**
     * Dispose the renderer and release resources
     */
    dispose(): void;

    /**
     * Dispose just the model
     */
    disposeModel(): void;

    /**
     * Get the camera
     */
    getCamera(): Camera | undefined;

    /**
     * Start the render loop
     */
    render(): void;

    /**
     * Set expression weights
     */
    setExpression(): void;

    /**
     * Load a FLAME model
     */
    loadFlameModel(fileName: string, motionConfig: any): Promise<void>;

    /**
     * Load a non-FLAME model
     */
    loadModel(fileName: string, animationConfig: any, motionConfig: any): Promise<void>;
}

/**
 * Viewer class for rendering Gaussian splats
 */
export class Viewer {
    camera: Camera;
    renderer: WebGLRenderer;
    scene: Scene;
    splatMesh: SplatMesh;
    selfDrivenMode: boolean;
    selfDrivenModeRunning: boolean;
    webXRMode: WebXRMode;
    renderMode: RenderMode;
    frame: number;
    totalFrames: number;
    useFlame: boolean;
    avatarMesh: any;
    splatRenderReady: boolean;
    consecutiveRenderFrames: number;
    renderNextFrame: boolean;
    requestFrameId: number;
    selfDrivenUpdateFunc: () => void;

    constructor(options?: ViewerOptions);

    /**
     * Add a splat scene to the viewer
     */
    addSplatScene(
        path: string,
        options?: SplatSceneOptions
    ): Promise<void>;

    /**
     * Update the viewer
     */
    update(renderer: WebGLRenderer, camera: Camera): void;

    /**
     * Check if should render
     */
    shouldRender(): boolean;

    /**
     * Render the scene
     */
    render(): void;

    /**
     * Dispose the viewer
     */
    dispose(): void;

    /**
     * Start self-driven mode
     */
    start(): void;

    /**
     * Stop self-driven mode
     */
    stop(): void;

    /**
     * Force render next frame
     */
    forceRenderNextFrame(): void;
}

/**
 * SplatMesh class
 */
export class SplatMesh {
    bsWeight: Record<string, number> | number[];
    visibleRegionChanging: boolean;

    getMaxSplatCount(): number;
    getSplatCount(): number;
}

/**
 * Animation manager for state-based animations
 */
export class AnimationManager {
    constructor(mixer: AnimationMixer, clips: any[]);

    update(state: TYVoiceChatState | string): void;
    dispose(): void;
}

/**
 * Drop-in viewer for simple integration
 */
export class DropInViewer {
    constructor(options?: ViewerOptions);

    addSplatScene(path: string, options?: SplatSceneOptions): Promise<void>;
    dispose(): void;
}

/**
 * Orbit controls for camera manipulation
 */
export class OrbitControls {
    constructor(camera: Camera, domElement: HTMLElement);

    update(): void;
    dispose(): void;
    enabled: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    enableRotate: boolean;
    enablePan: boolean;
}

/**
 * Splat buffer class
 */
export class SplatBuffer {
    static CenterComponentCount: number;
    static ScaleComponentCount: number;
    static RotationComponentCount: number;
    static ColorComponentCount: number;
}

/**
 * Splat buffer generator
 */
export class SplatBufferGenerator {
    static getStandardSections(compressionLevel: number): any;
}

/**
 * Splat partitioner
 */
export class SplatPartitioner {
    static partitionIntoSections(splats: any[], sectionCapacity: number): any[];
}

/**
 * PLY loader
 */
export class PlyLoader {
    static loadFromURL(url: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer>;
}

/**
 * PLY parser
 */
export class PlyParser {
    static parseToUncompressedSplatArray(data: ArrayBuffer): any;
}

/**
 * KSplat loader
 */
export class KSplatLoader {
    static loadFromURL(url: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer>;
}

/**
 * Utility functions
 */
export const LoaderUtils: {
    downloadFile(url: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer>;
};

/**
 * Abortable promise utility
 */
export class AbortablePromise<T> extends Promise<T> {
    abort(): void;
}
