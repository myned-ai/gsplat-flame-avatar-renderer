import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                performance: 'readonly',
                navigator: 'readonly',
                URL: 'readonly',
                Blob: 'readonly',
                File: 'readonly',
                FileReader: 'readonly',
                TextDecoder: 'readonly',
                TextEncoder: 'readonly',
                fetch: 'readonly',
                Response: 'readonly',
                Headers: 'readonly',
                AbortController: 'readonly',
                Worker: 'readonly',
                SharedArrayBuffer: 'readonly',
                Atomics: 'readonly',
                WebAssembly: 'readonly',
                ImageData: 'readonly',
                OffscreenCanvas: 'readonly',
                ResizeObserver: 'readonly',
                atob: 'readonly',
                btoa: 'readonly',
                // TypedArrays
                Float32Array: 'readonly',
                Float64Array: 'readonly',
                Int8Array: 'readonly',
                Int16Array: 'readonly',
                Int32Array: 'readonly',
                Uint8Array: 'readonly',
                Uint16Array: 'readonly',
                Uint32Array: 'readonly',
                Uint8ClampedArray: 'readonly',
                ArrayBuffer: 'readonly',
                DataView: 'readonly',
            }
        },
        rules: {
            // Possible errors
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-console': 'off',
            
            // Best practices
            'eqeqeq': ['warn', 'smart'],
            'no-eval': 'error',
            'no-implied-eval': 'error',
            
            // Style (relaxed for existing code)
            'semi': 'off',
            'quotes': 'off',
            'indent': 'off',
            'no-mixed-spaces-and-tabs': 'off',
        }
    },
    {
        ignores: ['dist/**', 'node_modules/**']
    }
];
