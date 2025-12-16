/**
 * DirectLoadError
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * Minor enhancement: Added this.name property for better error identification.
 */
export class DirectLoadError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'DirectLoadError';
    }
}
