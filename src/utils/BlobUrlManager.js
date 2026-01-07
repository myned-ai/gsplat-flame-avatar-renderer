/**
 * BlobUrlManager - Secure blob URL lifecycle management
 *
 * Tracks blob URLs and ensures they are revoked to prevent memory leaks
 * and unauthorized access. Critical for security and resource management.
 */

import { getLogger } from './Logger.js';
import { ValidationError } from '../errors/index.js';

const logger = getLogger('BlobUrlManager');

/**
 * BlobUrlManager - Manages blob URL lifecycle
 */
export class BlobUrlManager {
    constructor() {
        /**
         * Map of blob URL to metadata
         * @private
         */
        this._urls = new Map();

        /**
         * Whether manager has been disposed
         * @private
         */
        this._disposed = false;
    }

    /**
     * Assert manager is not disposed
     * @private
     * @throws {Error} If manager is disposed
     */
    _assertNotDisposed() {
        if (this._disposed) {
            throw new Error('BlobUrlManager has been disposed');
        }
    }

    /**
     * Create a blob URL from data
     *
     * @param {Blob|ArrayBuffer|Uint8Array} data - Data to create blob from
     * @param {string} mimeType - MIME type (e.g., 'model/gltf-binary')
     * @param {string} [label] - Optional label for debugging
     * @returns {string} Blob URL
     * @throws {ValidationError} If data or mimeType is invalid
     */
    createBlobUrl(data, mimeType, label = '') {
        this._assertNotDisposed();

        // Validate mimeType
        if (typeof mimeType !== 'string' || mimeType.length === 0) {
            throw new ValidationError(
                'mimeType must be a non-empty string',
                'mimeType'
            );
        }

        // Convert data to Blob if needed
        let blob;
        if (data instanceof Blob) {
            blob = data;
        } else if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
            blob = new Blob([data], { type: mimeType });
        } else {
            throw new ValidationError(
                'data must be Blob, ArrayBuffer, or Uint8Array',
                'data'
            );
        }

        // Create blob URL
        const url = URL.createObjectURL(blob);

        // Track metadata
        this._urls.set(url, {
            createdAt: Date.now(),
            mimeType,
            label: label || 'unlabeled',
            size: blob.size
        });

        logger.debug(`Created blob URL: ${label || url.substring(0, 50)}, size: ${blob.size} bytes`);

        return url;
    }

    /**
     * Register an externally created blob URL for tracking
     *
     * @param {string} url - Blob URL to track
     * @param {string} [label] - Optional label for debugging
     * @throws {ValidationError} If URL is not a blob URL
     */
    registerBlobUrl(url, label = '') {
        this._assertNotDisposed();

        if (typeof url !== 'string' || !url.startsWith('blob:')) {
            throw new ValidationError(
                'url must be a valid blob URL',
                'url'
            );
        }

        if (!this._urls.has(url)) {
            this._urls.set(url, {
                createdAt: Date.now(),
                mimeType: 'unknown',
                label: label || 'registered-external',
                size: 0
            });

            logger.debug(`Registered external blob URL: ${label || url.substring(0, 50)}`);
        }
    }

    /**
     * Revoke a blob URL and remove from tracking
     *
     * @param {string} url - Blob URL to revoke
     * @returns {boolean} True if URL was tracked and revoked
     */
    revokeBlobUrl(url) {
        this._assertNotDisposed();

        if (this._urls.has(url)) {
            const metadata = this._urls.get(url);
            URL.revokeObjectURL(url);
            this._urls.delete(url);

            logger.debug(`Revoked blob URL: ${metadata.label}, age: ${Date.now() - metadata.createdAt}ms`);
            return true;
        }

        return false;
    }

    /**
     * Revoke all blob URLs and clear tracking
     */
    revokeAll() {
        this._assertNotDisposed();

        logger.debug(`Revoking ${this._urls.size} blob URLs`);

        for (const url of this._urls.keys()) {
            URL.revokeObjectURL(url);
        }

        this._urls.clear();
    }

    /**
     * Get tracked blob URL metadata
     *
     * @param {string} url - Blob URL
     * @returns {object|null} Metadata or null if not tracked
     */
    getMetadata(url) {
        return this._urls.get(url) || null;
    }

    /**
     * Get all tracked blob URLs
     *
     * @returns {Array<{url: string, metadata: object}>} Array of URL info
     */
    getAllTrackedUrls() {
        const urls = [];
        for (const [url, metadata] of this._urls.entries()) {
            urls.push({ url, metadata });
        }
        return urls;
    }

    /**
     * Get statistics about tracked URLs
     *
     * @returns {object} Statistics
     */
    getStats() {
        let totalSize = 0;
        let oldestAge = 0;
        const now = Date.now();

        for (const metadata of this._urls.values()) {
            totalSize += metadata.size;
            const age = now - metadata.createdAt;
            if (age > oldestAge) {
                oldestAge = age;
            }
        }

        return {
            count: this._urls.size,
            totalSize,
            oldestAge
        };
    }

    /**
     * Revoke blob URLs older than specified age
     *
     * @param {number} maxAgeMs - Maximum age in milliseconds
     * @returns {number} Number of URLs revoked
     */
    revokeOlderThan(maxAgeMs) {
        this._assertNotDisposed();

        const now = Date.now();
        const toRevoke = [];

        for (const [url, metadata] of this._urls.entries()) {
            const age = now - metadata.createdAt;
            if (age > maxAgeMs) {
                toRevoke.push(url);
            }
        }

        for (const url of toRevoke) {
            this.revokeBlobUrl(url);
        }

        if (toRevoke.length > 0) {
            logger.info(`Revoked ${toRevoke.length} blob URLs older than ${maxAgeMs}ms`);
        }

        return toRevoke.length;
    }

    /**
     * Check if a URL is being tracked
     *
     * @param {string} url - URL to check
     * @returns {boolean} True if URL is tracked
     */
    isTracked(url) {
        return this._urls.has(url);
    }

    /**
     * Dispose manager and revoke all URLs
     */
    dispose() {
        if (this._disposed) {
            return;
        }

        logger.debug('Disposing BlobUrlManager');
        this.revokeAll();
        this._disposed = true;
    }
}

/**
 * Global blob URL manager instance
 * @type {BlobUrlManager}
 */
const globalBlobUrlManager = new BlobUrlManager();

/**
 * Get the global blob URL manager
 * @returns {BlobUrlManager} Global manager instance
 */
export function getGlobalBlobUrlManager() {
    return globalBlobUrlManager;
}

/**
 * Helper function to create a blob URL with automatic tracking
 *
 * @param {Blob|ArrayBuffer|Uint8Array} data - Data to create blob from
 * @param {string} mimeType - MIME type
 * @param {string} [label] - Optional label for debugging
 * @returns {string} Blob URL
 */
export function createTrackedBlobUrl(data, mimeType, label) {
    return globalBlobUrlManager.createBlobUrl(data, mimeType, label);
}

/**
 * Helper function to revoke a blob URL
 *
 * @param {string} url - Blob URL to revoke
 * @returns {boolean} True if URL was tracked and revoked
 */
export function revokeTrackedBlobUrl(url) {
    return globalBlobUrlManager.revokeBlobUrl(url);
}

export default BlobUrlManager;
