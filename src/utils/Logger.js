/**
 * Logger - Structured logging system
 *
 * Provides leveled logging with optional output suppression for production.
 * Replaces direct console.log calls for better control and debugging.
 */

/**
 * Logger levels in order of severity
 * Note: Named LoggerLevel to avoid conflict with existing LogLevel enum
 */
export const LoggerLevel = Object.freeze({
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
});

/**
 * Logger class for structured application logging
 */
export class Logger {
    /**
     * Create a Logger instance
     * @param {string} namespace - Logger namespace (e.g., 'Renderer', 'Loader')
     * @param {number} [minLevel=LoggerLevel.INFO] - Minimum log level to output
     */
    constructor(namespace, minLevel = LoggerLevel.INFO) {
        this.namespace = namespace;
        this.minLevel = minLevel;
    }

    /**
     * Set minimum log level
     * @param {number} level - Minimum level from LoggerLevel enum
     */
    setLevel(level) {
        this.minLevel = level;
    }

    /**
     * Format log message with namespace and timestamp
     * @private
     * @param {string} level - Log level name
     * @param {Array} args - Log arguments
     * @returns {Array} Formatted arguments
     */
    _format(level, args) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.namespace}]`;
        return [prefix, ...args];
    }

    /**
     * Log debug message (most verbose)
     * @param {...*} args - Arguments to log
     */
    debug(...args) {
        if (this.minLevel <= LoggerLevel.DEBUG) {
            console.debug(...this._format('DEBUG', args));
        }
    }

    /**
     * Log info message
     * @param {...*} args - Arguments to log
     */
    info(...args) {
        if (this.minLevel <= LoggerLevel.INFO) {
            console.info(...this._format('INFO', args));
        }
    }

    /**
     * Log warning message
     * @param {...*} args - Arguments to log
     */
    warn(...args) {
        if (this.minLevel <= LoggerLevel.WARN) {
            console.warn(...this._format('WARN', args));
        }
    }

    /**
     * Log error message
     * @param {...*} args - Arguments to log
     */
    error(...args) {
        if (this.minLevel <= LoggerLevel.ERROR) {
            console.error(...this._format('ERROR', args));
        }
    }

    /**
     * Log error with stack trace
     * @param {Error} error - Error object
     * @param {string} [context] - Additional context
     */
    errorWithTrace(error, context = '') {
        if (this.minLevel <= LoggerLevel.ERROR) {
            const contextStr = context ? ` Context: ${context}` : '';
            console.error(...this._format('ERROR', [
                `${error.message}${contextStr}`,
                '\nStack:', error.stack
            ]));
        }
    }

    /**
     * Create a child logger with extended namespace
     * @param {string} childNamespace - Child namespace to append
     * @returns {Logger} New logger with combined namespace
     */
    child(childNamespace) {
        return new Logger(`${this.namespace}:${childNamespace}`, this.minLevel);
    }
}

/**
 * Global logger registry
 * @private
 */
const loggers = new Map();

/**
 * Global log level (affects all new loggers)
 * @private
 */
let globalLogLevel = LoggerLevel.INFO;

/**
 * Set global log level for all loggers
 * @param {number} level - Log level from LoggerLevel enum
 */
export function setGlobalLogLevel(level) {
    globalLogLevel = level;
    // Update existing loggers
    for (const logger of loggers.values()) {
        logger.setLevel(level);
    }
}

/**
 * Get or create a logger for a namespace
 * @param {string} namespace - Logger namespace
 * @returns {Logger} Logger instance
 */
export function getLogger(namespace) {
    if (!loggers.has(namespace)) {
        loggers.set(namespace, new Logger(namespace, globalLogLevel));
    }
    return loggers.get(namespace);
}

/**
 * Configure logging for production (suppress all logs)
 */
export function configureForProduction() {
    setGlobalLogLevel(LoggerLevel.NONE);
}

/**
 * Configure logging for development (show all logs)
 */
export function configureForDevelopment() {
    setGlobalLogLevel(LoggerLevel.DEBUG);
}

// Export default logger for convenience
export default getLogger('App');
