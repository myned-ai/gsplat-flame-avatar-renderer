/**
 * RenderLoop - Frame-independent animation loop with budget management
 *
 * Provides a robust requestAnimationFrame loop with:
 * - Delta time calculation for frame-independent updates
 * - Frame budget management to prevent frame drops
 * - Deferred task execution
 * - Performance monitoring
 */

import { getLogger } from './Logger.js';

const logger = getLogger('RenderLoop');

/**
 * RenderLoop - Manages animation frame loop
 */
export class RenderLoop {
    /**
     * Create a RenderLoop
     * @param {Function} updateFn - Update function called each frame with deltaTime
     * @param {Function} renderFn - Render function called each frame
     * @param {object} [options] - Configuration options
     * @param {number} [options.targetFps=60] - Target frames per second
     * @param {number} [options.maxDeltaTime=0.1] - Maximum delta time in seconds (prevents spiral of death)
     */
    constructor(updateFn, renderFn, options = {}) {
        this._update = updateFn;
        this._render = renderFn;

        this._targetFps = options.targetFps || 60;
        this._maxDeltaTime = options.maxDeltaTime || 0.1; // 100ms max
        this._frameBudget = 1000 / this._targetFps; // ms per frame

        this._running = false;
        this._rafId = null;
        this._lastTime = 0;
        this._frameCount = 0;
        this._deferredTasks = [];

        // Performance tracking
        this._fpsHistory = [];
        this._fpsHistorySize = 60; // Track last 60 frames
        this._lastFpsUpdate = 0;
        this._currentFps = 0;
    }

    /**
     * Start the render loop
     */
    start() {
        if (this._running) {
            logger.warn('RenderLoop already running');
            return;
        }

        this._running = true;
        this._lastTime = performance.now();
        this._frameCount = 0;
        logger.info('RenderLoop started');

        this._tick();
    }

    /**
     * Stop the render loop
     */
    stop() {
        if (!this._running) {
            return;
        }

        this._running = false;

        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        logger.info(`RenderLoop stopped after ${this._frameCount} frames`);
    }

    /**
     * Main loop tick
     * @private
     */
    _tick = () => {
        if (!this._running) {
            return;
        }

        const frameStart = performance.now();
        const rawDeltaTime = (frameStart - this._lastTime) / 1000; // Convert to seconds

        // Clamp delta time to prevent spiral of death
        const deltaTime = Math.min(rawDeltaTime, this._maxDeltaTime);

        this._lastTime = frameStart;
        this._frameCount++;

        try {
            // Update logic
            this._update(deltaTime);

            // Render
            this._render();

            // Process deferred tasks if time permits
            const frameElapsed = performance.now() - frameStart;
            const remainingTime = this._frameBudget - frameElapsed;

            if (remainingTime > 1 && this._deferredTasks.length > 0) {
                this._processDeferredTasks(remainingTime - 1); // Leave 1ms margin
            }

            // Update FPS tracking
            this._updateFpsTracking(performance.now() - frameStart);

        } catch (error) {
            logger.error('Error in render loop:', error);
            // Continue loop despite error
        }

        // Schedule next frame
        this._rafId = requestAnimationFrame(this._tick);
    };

    /**
     * Update FPS tracking
     * @private
     * @param {number} frameTime - Time taken for this frame in ms
     */
    _updateFpsTracking(frameTime) {
        this._fpsHistory.push(1000 / frameTime);

        if (this._fpsHistory.length > this._fpsHistorySize) {
            this._fpsHistory.shift();
        }

        // Update FPS every second
        const now = performance.now();
        if (now - this._lastFpsUpdate > 1000) {
            this._currentFps = this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length;
            this._lastFpsUpdate = now;
        }
    }

    /**
     * Process deferred tasks within time budget
     * @private
     * @param {number} maxTime - Maximum time in ms to spend on tasks
     */
    _processDeferredTasks(maxTime) {
        const startTime = performance.now();

        while (this._deferredTasks.length > 0) {
            if (performance.now() - startTime >= maxTime) {
                break;
            }

            const task = this._deferredTasks.shift();

            try {
                task.fn();
            } catch (error) {
                logger.error(`Error in deferred task: ${task.label}`, error);
            }
        }
    }

    /**
     * Execute task if within frame budget, otherwise defer
     *
     * @param {Function} task - Task function to execute
     * @param {number} [priority=0] - Task priority (higher = more important)
     * @param {string} [label=''] - Task label for debugging
     */
    executeOrDefer(task, priority = 0, label = '') {
        const frameElapsed = performance.now() - this._lastTime;

        if (frameElapsed < this._frameBudget * 0.8) {
            // Within budget, execute now
            task();
        } else {
            // Over budget, defer
            this._deferredTasks.push({ fn: task, priority, label });

            // Sort by priority (higher first)
            this._deferredTasks.sort((a, b) => b.priority - a.priority);
        }
    }

    /**
     * Get current FPS
     * @returns {number} Average FPS over recent frames
     */
    getFps() {
        return Math.round(this._currentFps);
    }

    /**
     * Get performance stats
     * @returns {object} Performance statistics
     */
    getStats() {
        return {
            fps: this.getFps(),
            frameCount: this._frameCount,
            deferredTaskCount: this._deferredTasks.length,
            running: this._running
        };
    }

    /**
     * Check if loop is running
     * @returns {boolean} True if running
     */
    isRunning() {
        return this._running;
    }

    /**
     * Get frame count
     * @returns {number} Total frames rendered
     */
    getFrameCount() {
        return this._frameCount;
    }

    /**
     * Clear all deferred tasks
     */
    clearDeferredTasks() {
        this._deferredTasks.length = 0;
        logger.debug('Cleared all deferred tasks');
    }
}

/**
 * FrameBudgetMonitor - Monitors and alerts on frame budget violations
 */
export class FrameBudgetMonitor {
    /**
     * Create a FrameBudgetMonitor
     * @param {number} [targetFps=60] - Target FPS
     * @param {Function} [onViolation] - Callback when budget is violated
     */
    constructor(targetFps = 60, onViolation = null) {
        this._targetFps = targetFps;
        this._frameBudget = 1000 / targetFps;
        this._onViolation = onViolation;
        this._violations = 0;
        this._frameStart = 0;
    }

    /**
     * Mark start of frame
     */
    startFrame() {
        this._frameStart = performance.now();
    }

    /**
     * Check if frame is within budget
     * @param {string} [location] - Location identifier for debugging
     * @returns {boolean} True if within budget
     */
    checkBudget(location = '') {
        const elapsed = performance.now() - this._frameStart;
        const withinBudget = elapsed < this._frameBudget;

        if (!withinBudget) {
            this._violations++;

            if (this._onViolation) {
                this._onViolation({
                    location,
                    elapsed,
                    budget: this._frameBudget,
                    overrun: elapsed - this._frameBudget
                });
            }

            logger.warn(`Frame budget violation at ${location}: ${elapsed.toFixed(2)}ms / ${this._frameBudget.toFixed(2)}ms`);
        }

        return withinBudget;
    }

    /**
     * Get violation count
     * @returns {number} Total violations
     */
    getViolationCount() {
        return this._violations;
    }

    /**
     * Reset violation count
     */
    resetViolations() {
        this._violations = 0;
    }
}

export default RenderLoop;
