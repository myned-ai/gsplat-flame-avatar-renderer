/**
 * ObjectPool - Memory-efficient object pooling
 *
 * Reduces garbage collection pressure by reusing objects instead of
 * repeatedly allocating and deallocating them. Critical for real-time rendering.
 */

import { Vector3, Matrix4, Quaternion, Euler } from 'three';

/**
 * Generic object pool
 */
export class ObjectPool {
    /**
     * Create an ObjectPool
     * @param {Function} factory - Function that creates new objects
     * @param {Function} reset - Function that resets an object to initial state
     * @param {number} [initialSize=10] - Number of objects to pre-allocate
     */
    constructor(factory, reset, initialSize = 10) {
        this._factory = factory;
        this._reset = reset;
        this._pool = [];
        this._allocated = 0;
        this._maxSize = initialSize * 10; // Prevent unbounded growth

        // Pre-allocate initial objects
        for (let i = 0; i < initialSize; i++) {
            this._pool.push(factory());
        }
    }

    /**
     * Acquire an object from the pool
     * @returns {*} Pooled object
     */
    acquire() {
        this._allocated++;
        if (this._pool.length > 0) {
            return this._pool.pop();
        }
        // Pool exhausted, create new object
        return this._factory();
    }

    /**
     * Release an object back to the pool
     * @param {*} obj - Object to return to pool
     */
    release(obj) {
        this._allocated--;
        if (this._pool.length < this._maxSize) {
            this._reset(obj);
            this._pool.push(obj);
        }
        // If pool is at max size, let object be garbage collected
    }

    /**
     * Release multiple objects
     * @param {Array} objects - Objects to return to pool
     */
    releaseAll(objects) {
        for (const obj of objects) {
            this.release(obj);
        }
    }

    /**
     * Get pool statistics
     * @returns {object} Pool stats
     */
    getStats() {
        return {
            available: this._pool.length,
            allocated: this._allocated,
            maxSize: this._maxSize
        };
    }

    /**
     * Clear the pool and release all objects
     */
    dispose() {
        this._pool.length = 0;
        this._allocated = 0;
    }
}

/**
 * Pre-configured pools for common Three.js objects
 */

/**
 * Vector3 pool
 * @type {ObjectPool}
 */
export const vector3Pool = new ObjectPool(
    () => new Vector3(),
    (v) => v.set(0, 0, 0),
    50 // Pre-allocate 50 vectors
);

/**
 * Matrix4 pool
 * @type {ObjectPool}
 */
export const matrix4Pool = new ObjectPool(
    () => new Matrix4(),
    (m) => m.identity(),
    20 // Pre-allocate 20 matrices
);

/**
 * Quaternion pool
 * @type {ObjectPool}
 */
export const quaternionPool = new ObjectPool(
    () => new Quaternion(),
    (q) => q.set(0, 0, 0, 1),
    30 // Pre-allocate 30 quaternions
);

/**
 * Euler pool
 * @type {ObjectPool}
 */
export const eulerPool = new ObjectPool(
    () => new Euler(),
    (e) => e.set(0, 0, 0),
    30 // Pre-allocate 30 eulers
);

/**
 * Scoped pool allocation helper
 *
 * Automatically releases pooled objects when scope exits.
 * Use with try/finally to ensure cleanup.
 *
 * @example
 * const scope = new PoolScope();
 * try {
 *   const v1 = scope.vector3();
 *   const v2 = scope.vector3();
 *   // Use vectors...
 * } finally {
 *   scope.releaseAll();
 * }
 */
export class PoolScope {
    constructor() {
        this._allocated = [];
    }

    /**
     * Acquire a Vector3 from pool
     * @returns {Vector3} Pooled vector
     */
    vector3() {
        const obj = vector3Pool.acquire();
        this._allocated.push({ pool: vector3Pool, obj });
        return obj;
    }

    /**
     * Acquire a Matrix4 from pool
     * @returns {Matrix4} Pooled matrix
     */
    matrix4() {
        const obj = matrix4Pool.acquire();
        this._allocated.push({ pool: matrix4Pool, obj });
        return obj;
    }

    /**
     * Acquire a Quaternion from pool
     * @returns {Quaternion} Pooled quaternion
     */
    quaternion() {
        const obj = quaternionPool.acquire();
        this._allocated.push({ pool: quaternionPool, obj });
        return obj;
    }

    /**
     * Acquire an Euler from pool
     * @returns {Euler} Pooled euler
     */
    euler() {
        const obj = eulerPool.acquire();
        this._allocated.push({ pool: eulerPool, obj });
        return obj;
    }

    /**
     * Release all objects allocated in this scope
     */
    releaseAll() {
        for (const { pool, obj } of this._allocated) {
            pool.release(obj);
        }
        this._allocated.length = 0;
    }

    /**
     * Get count of allocated objects in this scope
     * @returns {number} Number of allocated objects
     */
    getAllocatedCount() {
        return this._allocated.length;
    }
}

/**
 * Module-level temporary objects for hot-path reuse
 * IMPORTANT: These are NOT thread-safe. Only use in single-threaded contexts.
 * Reset these before use to avoid stale data.
 */
export const tempVector3A = new Vector3();
export const tempVector3B = new Vector3();
export const tempVector3C = new Vector3();
export const tempMatrix4A = new Matrix4();
export const tempMatrix4B = new Matrix4();
export const tempQuaternionA = new Quaternion();
export const tempQuaternionB = new Quaternion();

/**
 * Get pool statistics for all pre-configured pools
 * @returns {object} Statistics for all pools
 */
export function getPoolStats() {
    return {
        vector3: vector3Pool.getStats(),
        matrix4: matrix4Pool.getStats(),
        quaternion: quaternionPool.getStats(),
        euler: eulerPool.getStats()
    };
}

/**
 * Dispose all pre-configured pools
 */
export function disposeAllPools() {
    vector3Pool.dispose();
    matrix4Pool.dispose();
    quaternionPool.dispose();
    eulerPool.dispose();
}
