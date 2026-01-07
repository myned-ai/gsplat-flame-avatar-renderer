/**
 * EventEmitter - Observer pattern implementation for event-driven communication
 *
 * Provides decoupled event handling with automatic cleanup to prevent memory leaks.
 * Critical for managing state changes and component communication.
 */

import { getLogger } from './Logger.js';
import { ValidationError } from '../errors/index.js';

const logger = getLogger('EventEmitter');

/**
 * EventEmitter - Pub/sub event system
 */
export class EventEmitter {
    constructor() {
        /**
         * Map of event name to Set of listeners
         * @private
         */
        this._listeners = new Map();

        /**
         * Whether emitter has been disposed
         * @private
         */
        this._disposed = false;

        /**
         * Event emission history for debugging (last N events)
         * @private
         */
        this._eventHistory = [];
        this._maxHistorySize = 50;
    }

    /**
     * Assert emitter is not disposed
     * @private
     * @throws {Error} If emitter is disposed
     */
    _assertNotDisposed() {
        if (this._disposed) {
            throw new Error('EventEmitter has been disposed');
        }
    }

    /**
     * Subscribe to an event
     *
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @param {object} [options] - Subscription options
     * @param {boolean} [options.once=false] - Auto-unsubscribe after first call
     * @returns {Function} Unsubscribe function
     * @throws {ValidationError} If parameters are invalid
     */
    on(event, callback, options = {}) {
        this._assertNotDisposed();

        if (typeof event !== 'string' || event.length === 0) {
            throw new ValidationError(
                'event must be a non-empty string',
                'event'
            );
        }

        if (typeof callback !== 'function') {
            throw new ValidationError(
                'callback must be a function',
                'callback'
            );
        }

        // Wrap callback if once option is set
        const wrappedCallback = options.once
            ? (...args) => {
                this.off(event, wrappedCallback);
                callback(...args);
            }
            : callback;

        // Store original callback reference for removal
        if (options.once) {
            wrappedCallback._originalCallback = callback;
        }

        // Add listener
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(wrappedCallback);

        logger.debug(`Subscribed to event: ${event}`);

        // Return unsubscribe function
        return () => this.off(event, wrappedCallback);
    }

    /**
     * Subscribe to an event (fires once then auto-unsubscribes)
     *
     * @param {string} event - Event name
     * @param {Function} callback - Event handler
     * @returns {Function} Unsubscribe function
     */
    once(event, callback) {
        return this.on(event, callback, { once: true });
    }

    /**
     * Unsubscribe from an event
     *
     * @param {string} event - Event name
     * @param {Function} callback - Event handler to remove
     * @returns {boolean} True if callback was found and removed
     */
    off(event, callback) {
        this._assertNotDisposed();

        const listeners = this._listeners.get(event);
        if (!listeners) {
            return false;
        }

        // Try to remove directly
        if (listeners.delete(callback)) {
            logger.debug(`Unsubscribed from event: ${event}`);
            return true;
        }

        // Try to find by original callback (for once listeners)
        for (const listener of listeners) {
            if (listener._originalCallback === callback) {
                listeners.delete(listener);
                logger.debug(`Unsubscribed from event: ${event} (once listener)`);
                return true;
            }
        }

        return false;
    }

    /**
     * Remove all listeners for an event (or all events if no event specified)
     *
     * @param {string} [event] - Event name (optional)
     */
    removeAllListeners(event = null) {
        this._assertNotDisposed();

        if (event) {
            const count = this._listeners.get(event)?.size || 0;
            this._listeners.delete(event);
            logger.debug(`Removed ${count} listeners for event: ${event}`);
        } else {
            const totalCount = Array.from(this._listeners.values())
                .reduce((sum, set) => sum + set.size, 0);
            this._listeners.clear();
            logger.debug(`Removed all ${totalCount} listeners`);
        }
    }

    /**
     * Emit an event to all subscribers
     *
     * @param {string} event - Event name
     * @param {...*} args - Arguments to pass to listeners
     * @returns {boolean} True if event had listeners
     */
    emit(event, ...args) {
        this._assertNotDisposed();

        const listeners = this._listeners.get(event);
        if (!listeners || listeners.size === 0) {
            return false;
        }

        // Record in history for debugging
        this._recordEvent(event, args);

        // Call all listeners
        let callCount = 0;
        for (const callback of listeners) {
            try {
                callback(...args);
                callCount++;
            } catch (error) {
                logger.error(`Error in event listener for '${event}':`, error);
                // Continue calling other listeners
            }
        }

        logger.debug(`Emitted event: ${event} to ${callCount} listeners`);

        return true;
    }

    /**
     * Record event in history for debugging
     * @private
     * @param {string} event - Event name
     * @param {Array} args - Event arguments
     */
    _recordEvent(event, args) {
        this._eventHistory.push({
            event,
            timestamp: Date.now(),
            argCount: args.length
        });

        // Keep history bounded
        if (this._eventHistory.length > this._maxHistorySize) {
            this._eventHistory.shift();
        }
    }

    /**
     * Get event emission history
     * @returns {Array} Array of event records
     */
    getEventHistory() {
        return [...this._eventHistory];
    }

    /**
     * Check if event has listeners
     *
     * @param {string} event - Event name
     * @returns {boolean} True if event has listeners
     */
    hasListeners(event) {
        const listeners = this._listeners.get(event);
        return listeners ? listeners.size > 0 : false;
    }

    /**
     * Get listener count for an event
     *
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    listenerCount(event) {
        const listeners = this._listeners.get(event);
        return listeners ? listeners.size : 0;
    }

    /**
     * Get all event names with listeners
     *
     * @returns {string[]} Array of event names
     */
    eventNames() {
        return Array.from(this._listeners.keys());
    }

    /**
     * Get statistics about listeners
     *
     * @returns {object} Statistics
     */
    getStats() {
        const stats = {
            totalEvents: this._listeners.size,
            totalListeners: 0,
            eventBreakdown: {}
        };

        for (const [event, listeners] of this._listeners.entries()) {
            const count = listeners.size;
            stats.totalListeners += count;
            stats.eventBreakdown[event] = count;
        }

        return stats;
    }

    /**
     * Dispose emitter and remove all listeners
     */
    dispose() {
        if (this._disposed) {
            return;
        }

        logger.debug('Disposing EventEmitter');
        this.removeAllListeners();
        this._eventHistory.length = 0;
        this._disposed = true;
    }
}

/**
 * TypedEventEmitter - Type-safe event emitter with event registry
 *
 * Ensures events are pre-registered, preventing typos and providing
 * better developer experience.
 */
export class TypedEventEmitter extends EventEmitter {
    /**
     * Create a TypedEventEmitter
     * @param {string[]} allowedEvents - Array of allowed event names
     */
    constructor(allowedEvents) {
        super();

        /**
         * Set of allowed event names
         * @private
         */
        this._allowedEvents = new Set(allowedEvents);
    }

    /**
     * Validate event name is allowed
     * @private
     * @param {string} event - Event name
     * @throws {ValidationError} If event is not allowed
     */
    _validateEvent(event) {
        if (!this._allowedEvents.has(event)) {
            throw new ValidationError(
                `Event '${event}' is not registered. Allowed events: ${Array.from(this._allowedEvents).join(', ')}`,
                'event'
            );
        }
    }

    /**
     * Subscribe to an event (override to add validation)
     * @override
     */
    on(event, callback, options) {
        this._validateEvent(event);
        return super.on(event, callback, options);
    }

    /**
     * Emit an event (override to add validation)
     * @override
     */
    emit(event, ...args) {
        this._validateEvent(event);
        return super.emit(event, ...args);
    }
}

export default EventEmitter;
