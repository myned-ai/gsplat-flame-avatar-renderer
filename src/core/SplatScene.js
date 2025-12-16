/**
 * SplatScene
 * 
 * Derived from @mkkellogg/gaussian-splats-3d (MIT License)
 * https://github.com/mkkellogg/GaussianSplats3D
 * 
 * This file is functionally identical to the original.
 */

import { Matrix4, Object3D, Quaternion, Vector3 } from 'three';

export class SplatScene extends Object3D {

    constructor(splatBuffer, position = new Vector3(), quaternion = new Quaternion(),
                scale = new Vector3(1, 1, 1), minimumAlpha = 1, opacity = 1.0, visible = true) {
        super();
        this.splatBuffer = splatBuffer;
        this.position.copy(position);
        this.quaternion.copy(quaternion);
        this.scale.copy(scale);
        this.transform = new Matrix4();
        this.minimumAlpha = minimumAlpha;
        this.opacity = opacity;
        this.visible = visible;
    }

    copyTransformData(otherScene) {
        this.position.copy(otherScene.position);
        this.quaternion.copy(otherScene.quaternion);
        this.scale.copy(otherScene.scale);
        this.transform.copy(otherScene.transform);
    }

    updateTransform(dynamicMode) {
        if (dynamicMode) {
            if (this.matrixWorldAutoUpdate) this.updateWorldMatrix(true, false);
            this.transform.copy(this.matrixWorld);
        } else {
            if (this.matrixAutoUpdate) this.updateMatrix();
            this.transform.copy(this.matrix);
        }
    }
}