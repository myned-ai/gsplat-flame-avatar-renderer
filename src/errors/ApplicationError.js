/**
 * ApplicationError - Base error class for all application errors
 *
 * Provides structured error handling with error codes and cause tracking.
 * All domain-specific errors should extend this class.
 *
 * @extends Error
 */
export class ApplicationError extends Error {
    /**
     * Create an ApplicationError
     * @param {string} message - Human-readable error message
     * @param {string} code - Machine-readable error code for programmatic handling
     * @param {Error} [cause=null] - Original error that caused this error (for error chaining)
     */
    constructor(message, code, cause = null) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.cause = cause;

        // Capture stack trace, excluding constructor call from it
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Convert error to JSON for logging/transmission
     * @returns {object} JSON representation of error
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            stack: this.stack,
            cause: this.cause ? {
                name: this.cause.name,
                message: this.cause.message
            } : null
        };
    }
}

/**
 * ValidationError - Thrown when input validation fails
 *
 * Used for invalid parameters, out-of-range values, or malformed data.
 *
 * @extends ApplicationError
 */
export class ValidationError extends ApplicationError {
    /**
     * Create a ValidationError
     * @param {string} message - Validation failure description
     * @param {string} field - Name of the field that failed validation
     * @param {Error} [cause=null] - Original error that caused this validation failure
     */
    constructor(message, field, cause = null) {
        super(message, 'VALIDATION_ERROR', cause);
        this.field = field;
    }
}

/**
 * NetworkError - Thrown when network operations fail
 *
 * Used for fetch failures, timeouts, or HTTP error responses.
 *
 * @extends ApplicationError
 */
export class NetworkError extends ApplicationError {
    /**
     * Create a NetworkError
     * @param {string} message - Network error description
     * @param {number} [statusCode=0] - HTTP status code (if applicable)
     * @param {Error} [cause=null] - Original error that caused this network failure
     */
    constructor(message, statusCode = 0, cause = null) {
        super(message, 'NETWORK_ERROR', cause);
        this.statusCode = statusCode;
    }
}

/**
 * AssetLoadError - Thrown when asset loading fails
 *
 * Used for failures loading models, textures, or other asset files.
 *
 * @extends ApplicationError
 */
export class AssetLoadError extends ApplicationError {
    /**
     * Create an AssetLoadError
     * @param {string} message - Asset load failure description
     * @param {string} assetPath - Path to the asset that failed to load
     * @param {Error} [cause=null] - Original error that caused this load failure
     */
    constructor(message, assetPath, cause = null) {
        super(message, 'ASSET_LOAD_ERROR', cause);
        this.assetPath = assetPath;
    }
}

/**
 * ResourceDisposedError - Thrown when attempting to use a disposed resource
 *
 * Used to prevent use-after-dispose bugs.
 *
 * @extends ApplicationError
 */
export class ResourceDisposedError extends ApplicationError {
    /**
     * Create a ResourceDisposedError
     * @param {string} resourceName - Name of the disposed resource
     */
    constructor(resourceName) {
        super(
            `Cannot use ${resourceName}: resource has been disposed`,
            'RESOURCE_DISPOSED_ERROR'
        );
        this.resourceName = resourceName;
    }
}

/**
 * InitializationError - Thrown when initialization fails
 *
 * Used when required setup steps fail or prerequisites are not met.
 *
 * @extends ApplicationError
 */
export class InitializationError extends ApplicationError {
    /**
     * Create an InitializationError
     * @param {string} message - Initialization failure description
     * @param {string} component - Name of component that failed to initialize
     * @param {Error} [cause=null] - Original error that caused this initialization failure
     */
    constructor(message, component, cause = null) {
        super(message, 'INITIALIZATION_ERROR', cause);
        this.component = component;
    }
}

/**
 * ParseError - Thrown when parsing data fails
 *
 * Used for malformed file formats, invalid JSON, or corrupt data.
 *
 * @extends ApplicationError
 */
export class ParseError extends ApplicationError {
    /**
     * Create a ParseError
     * @param {string} message - Parse failure description
     * @param {string} dataType - Type of data being parsed (e.g., 'JSON', 'PLY', 'GLB')
     * @param {Error} [cause=null] - Original error that caused this parse failure
     */
    constructor(message, dataType, cause = null) {
        super(message, 'PARSE_ERROR', cause);
        this.dataType = dataType;
    }
}

/**
 * ConfigurationError - Thrown when configuration is invalid
 *
 * Used for invalid settings, missing required configuration, or conflicting options.
 *
 * @extends ApplicationError
 */
export class ConfigurationError extends ApplicationError {
    /**
     * Create a ConfigurationError
     * @param {string} message - Configuration error description
     * @param {string} configKey - Configuration key that is invalid
     * @param {Error} [cause=null] - Original error
     */
    constructor(message, configKey, cause = null) {
        super(message, 'CONFIGURATION_ERROR', cause);
        this.configKey = configKey;
    }
}
