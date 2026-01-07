/**
 * Error classes for structured error handling
 *
 * This module exports all custom error classes used throughout the application.
 * All errors extend ApplicationError for consistent error handling.
 */

export {
    ApplicationError,
    ValidationError,
    NetworkError,
    AssetLoadError,
    ResourceDisposedError,
    InitializationError,
    ParseError,
    ConfigurationError
} from './ApplicationError.js';
