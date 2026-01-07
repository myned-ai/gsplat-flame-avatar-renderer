/**
 * ValidationUtils - Security-focused validation utilities
 *
 * CRITICAL: All external inputs MUST be validated before use.
 * This module provides allowlist-based validation following security best practices.
 */

import { ValidationError } from '../errors/index.js';

/**
 * Allowed URL protocols (allowlist approach)
 */
const ALLOWED_PROTOCOLS = Object.freeze(['https:', 'http:', 'blob:', 'data:']);

/**
 * Validate and sanitize a URL
 *
 * @param {string} url - URL to validate
 * @param {string} [baseURL] - Base URL for relative URLs (defaults to window.location.href)
 * @returns {string} Sanitized absolute URL
 * @throws {ValidationError} If URL is invalid or uses disallowed protocol
 */
export function validateUrl(url, baseURL) {
    if (typeof url !== 'string' || url.length === 0) {
        throw new ValidationError('URL must be a non-empty string', 'url');
    }

    let parsed;
    try {
        // Use base URL if provided, otherwise use window location (browser only)
        const base = baseURL || (typeof window !== 'undefined' ? window.location.href : undefined);
        parsed = new URL(url, base);
    } catch (error) {
        throw new ValidationError(
            `Invalid URL format: ${url}`,
            'url',
            error
        );
    }

    // Validate protocol against allowlist
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        throw new ValidationError(
            `Disallowed protocol: ${parsed.protocol}. Allowed protocols: ${ALLOWED_PROTOCOLS.join(', ')}`,
            'url.protocol'
        );
    }

    return parsed.href;
}

/**
 * Validate asset path to prevent path traversal attacks
 *
 * @param {string} path - File path to validate
 * @returns {string} Validated path
 * @throws {ValidationError} If path contains traversal sequences
 */
export function validateAssetPath(path) {
    if (typeof path !== 'string' || path.length === 0) {
        throw new ValidationError('Asset path must be a non-empty string', 'path');
    }

    // Check for path traversal sequences
    const dangerousPatterns = ['../', '..\\', '%2e%2e/', '%2e%2e\\'];
    const normalizedPath = path.toLowerCase();

    for (const pattern of dangerousPatterns) {
        if (normalizedPath.includes(pattern)) {
            throw new ValidationError(
                `Path traversal detected in asset path: ${path}`,
                'path'
            );
        }
    }

    return path;
}

/**
 * Validate file extension against allowlist
 *
 * @param {string} filename - Filename to validate
 * @param {string[]} allowedExtensions - Array of allowed extensions (e.g., ['.ply', '.glb'])
 * @returns {string} Validated filename
 * @throws {ValidationError} If extension is not allowed
 */
export function validateFileExtension(filename, allowedExtensions) {
    if (typeof filename !== 'string' || filename.length === 0) {
        throw new ValidationError('Filename must be a non-empty string', 'filename');
    }

    if (!Array.isArray(allowedExtensions) || allowedExtensions.length === 0) {
        throw new ValidationError(
            'allowedExtensions must be a non-empty array',
            'allowedExtensions'
        );
    }

    const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    const normalizedAllowed = allowedExtensions.map(ext => ext.toLowerCase());

    if (!normalizedAllowed.includes(extension)) {
        throw new ValidationError(
            `File extension ${extension} not allowed. Allowed: ${allowedExtensions.join(', ')}`,
            'filename'
        );
    }

    return filename;
}

/**
 * Validate numeric value is within range
 *
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value (inclusive)
 * @param {number} max - Maximum allowed value (inclusive)
 * @param {string} fieldName - Name of field for error messages
 * @returns {number} Validated value
 * @throws {ValidationError} If value is not a number or out of range
 */
export function validateNumberInRange(value, min, max, fieldName) {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(
            `${fieldName} must be a valid number`,
            fieldName
        );
    }

    if (value < min || value > max) {
        throw new ValidationError(
            `${fieldName} must be between ${min} and ${max}, got ${value}`,
            fieldName
        );
    }

    return value;
}

/**
 * Validate integer value
 *
 * @param {number} value - Value to validate
 * @param {string} fieldName - Name of field for error messages
 * @returns {number} Validated integer
 * @throws {ValidationError} If value is not an integer
 */
export function validateInteger(value, fieldName) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new ValidationError(
            `${fieldName} must be an integer`,
            fieldName
        );
    }

    return value;
}

/**
 * Validate positive integer
 *
 * @param {number} value - Value to validate
 * @param {string} fieldName - Name of field for error messages
 * @returns {number} Validated positive integer
 * @throws {ValidationError} If value is not a positive integer
 */
export function validatePositiveInteger(value, fieldName) {
    validateInteger(value, fieldName);

    if (value <= 0) {
        throw new ValidationError(
            `${fieldName} must be positive, got ${value}`,
            fieldName
        );
    }

    return value;
}

/**
 * Validate object has required properties
 *
 * @param {object} obj - Object to validate
 * @param {string[]} requiredProps - Array of required property names
 * @param {string} objectName - Name of object for error messages
 * @returns {object} Validated object
 * @throws {ValidationError} If object is invalid or missing required properties
 */
export function validateRequiredProperties(obj, requiredProps, objectName) {
    if (obj === null || typeof obj !== 'object') {
        throw new ValidationError(
            `${objectName} must be an object`,
            objectName
        );
    }

    for (const prop of requiredProps) {
        if (!(prop in obj) || obj[prop] === undefined) {
            throw new ValidationError(
                `${objectName} missing required property: ${prop}`,
                `${objectName}.${prop}`
            );
        }
    }

    return obj;
}

/**
 * Validate array buffer
 *
 * @param {ArrayBuffer} buffer - Buffer to validate
 * @param {string} fieldName - Name of field for error messages
 * @param {number} [minSize=0] - Minimum size in bytes
 * @returns {ArrayBuffer} Validated buffer
 * @throws {ValidationError} If buffer is invalid or too small
 */
export function validateArrayBuffer(buffer, fieldName, minSize = 0) {
    if (!(buffer instanceof ArrayBuffer)) {
        throw new ValidationError(
            `${fieldName} must be an ArrayBuffer`,
            fieldName
        );
    }

    if (buffer.byteLength < minSize) {
        throw new ValidationError(
            `${fieldName} must be at least ${minSize} bytes, got ${buffer.byteLength}`,
            fieldName
        );
    }

    return buffer;
}

/**
 * Validate enum value against allowed values
 *
 * @param {*} value - Value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of field for error messages
 * @returns {*} Validated value
 * @throws {ValidationError} If value is not in allowed values
 */
export function validateEnum(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
        throw new ValidationError(
            `${fieldName} must be one of: ${allowedValues.join(', ')}. Got: ${value}`,
            fieldName
        );
    }

    return value;
}

/**
 * Validate callback function
 *
 * @param {Function} callback - Callback to validate
 * @param {string} fieldName - Name of field for error messages
 * @param {boolean} [required=true] - Whether callback is required
 * @returns {Function|null} Validated callback or null if not required and not provided
 * @throws {ValidationError} If callback is required but not a function
 */
export function validateCallback(callback, fieldName, required = true) {
    if (callback === null || callback === undefined) {
        if (required) {
            throw new ValidationError(
                `${fieldName} is required`,
                fieldName
            );
        }
        return null;
    }

    if (typeof callback !== 'function') {
        throw new ValidationError(
            `${fieldName} must be a function`,
            fieldName
        );
    }

    return callback;
}

/**
 * Validate hex color string
 *
 * @param {string} value - Color string to validate
 * @param {string} fieldName - Name of field for error messages
 * @returns {string} Validated color string
 * @throws {ValidationError} If color format is invalid
 */
export function validateHexColor(value, fieldName) {
    if (typeof value !== 'string') {
        throw new ValidationError(
            `${fieldName} must be a string`,
            fieldName
        );
    }

    const hexColorRegex = /^(#|0x)[0-9A-Fa-f]{6}$/i;
    if (!hexColorRegex.test(value)) {
        throw new ValidationError(
            `${fieldName} must be a valid hex color (e.g., #FFFFFF or 0xFFFFFF)`,
            fieldName
        );
    }

    return value;
}

/**
 * Validate DOM element
 *
 * @param {HTMLElement} element - Element to validate
 * @param {string} fieldName - Name of field for error messages
 * @returns {HTMLElement} Validated element
 * @throws {ValidationError} If element is not a valid DOM element
 */
export function validateDOMElement(element, fieldName) {
    if (typeof HTMLElement !== 'undefined' && !(element instanceof HTMLElement)) {
        throw new ValidationError(
            `${fieldName} must be a valid HTML element`,
            fieldName
        );
    }

    return element;
}
