# gsplat-flame-avatar-renderer

[![npm version](https://img.shields.io/npm/v/@myned-ai/gsplat-flame-avatar-renderer.svg)](https://www.npmjs.com/package/@myned-ai/gsplat-flame-avatar-renderer)

A specialized Gaussian Splatting library for rendering animated 3D avatars with FLAME parametric head model support, LAM (Large Avatar Model) head avatars, and ARKit blendshape compatibility.

---

## Features

- **52 ARKit Blendshapes** — Complete facial expression control
- **FLAME Model Support** — Full integration with FLAME parametric head model
- **Animation State Machine** — Built-in states (Idle, Listening, Thinking, Responding)
- **GPU Optimized** — WebGL-based rendering with WebAssembly sorting
- **Three.js Integration** — Works seamlessly with Three.js
- **LAM Head Avatars** — Support for Large Avatar Model based head avatars
- **ZIP Asset Loading** — Load compressed avatar assets directly
- **Real-time Animation** — Smooth blendshape interpolation at 30fps
- **Conditional Iris Occlusion Fix** — Optional iris fade during eye blinks via iris_occlusion.json

---

## Installation

```bash
npm install gsplat-flame-avatar-renderer three jszip
```

---

## Quick Start

```javascript
import { GaussianSplatRenderer } from 'gsplat-flame-avatar-renderer';

const container = document.getElementById('avatar-container');

// Create a new renderer instance (v1.0.6+)
const renderer = await GaussianSplatRenderer.create(
  container,
  './path/to/avatar.zip',
  {
    backgroundColor: '0x000000',
    getChatState: () => 'Idle',
    getExpressionData: () => ({
      jawOpen: 0.5,
      mouthSmileLeft: 0.3,
      mouthSmileRight: 0.3,
      // ... other ARKit blendshapes
    })
  }
);

// Don't forget to clean up when done!
// renderer.dispose();
```

---

## API Reference

### GaussianSplatRenderer

The main class for rendering Gaussian splat avatars.

#### `GaussianSplatRenderer.create(container, assetPath, options)`

Creates a new renderer instance with proper resource isolation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `container` | `HTMLDivElement` | Container element for the canvas |
| `assetPath` | `string` | Path to the ZIP file containing avatar assets |
| `options` | `object` | Configuration options |

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `backgroundColor` | `string` | Hex color string (e.g., '0x000000') |
| `getChatState` | `() => string` | Callback returning current animation state |
| `getExpressionData` | `() => object` | Callback returning blendshape weights |
| `loadProgress` | `(progress: number) => void` | Loading progress callback |
| `downloadProgress` | `(progress: number) => void` | Download progress callback |

#### `renderer.dispose()`

Cleans up all resources (WebGL context, textures, workers, event listeners). **Always call this when you're done with a renderer instance** to prevent memory leaks.

```javascript
// Clean up when done
renderer.dispose();
```

#### Migration from v1.0.5

If you're upgrading from v1.0.5 or earlier:

```javascript
// OLD (still works but deprecated)
const renderer = await GaussianSplatRenderer.getInstance(container, path, options);

// NEW (recommended)
const renderer = await GaussianSplatRenderer.create(container, path, options);
// ... use renderer ...
renderer.dispose(); // Don't forget!
```

**Key Changes:**
- Each `create()` call returns a **new independent instance** (no longer a singleton)
- You can now have **multiple renderers** on the same page
- Each instance has its own canvas element
- **Must call `dispose()`** when finished to clean up resources

### Animation States

The renderer supports the following states via `getChatState`:

| State | Description |
|-------|-------------|
| `'Idle'` | Default idle animation |
| `'Listening'` | Listening state animation |
| `'Thinking'` | Processing/thinking animation |
| `'Responding'` | Speaking/responding animation |

### ARKit Blendshapes (52)

```
browDownLeft, browDownRight, browInnerUp, browOuterUpLeft, browOuterUpRight,
cheekPuff, cheekSquintLeft, cheekSquintRight, eyeBlinkLeft, eyeBlinkRight,
eyeLookDownLeft, eyeLookDownRight, eyeLookInLeft, eyeLookInRight, eyeLookOutLeft,
eyeLookOutRight, eyeLookUpLeft, eyeLookUpRight, eyeSquintLeft, eyeSquintRight,
eyeWideLeft, eyeWideRight, jawForward, jawLeft, jawOpen, jawRight,
mouthClose, mouthDimpleLeft, mouthDimpleRight, mouthFrownLeft, mouthFrownRight,
mouthFunnel, mouthLeft, mouthLowerDownLeft, mouthLowerDownRight, mouthPressLeft,
mouthPressRight, mouthPucker, mouthRight, mouthRollLower, mouthRollUpper,
mouthShrugLower, mouthShrugUpper, mouthSmileLeft, mouthSmileRight, mouthStretchLeft,
mouthStretchRight, mouthUpperUpLeft, mouthUpperUpRight, noseSneerLeft, noseSneerRight,
tongueOut
```

---

## Asset Format

The avatar ZIP file should contain:

```
avatar.zip
├── avatar/
│   ├── offset.ply             # Gaussian splats point cloud (required)
│   ├── animation.glb          # Animation clips (required)
│   ├── skin.glb               # Skinning/skeleton data (required)
│   ├── vertex_order.json      # Vertex ordering data (required)
│   └── iris_occlusion.json    # Iris occlusion ranges (optional)
```

### Optional: Iris Occlusion

To enable iris fade during eye blinks if the iris is still visible, include `iris_occlusion.json` in your avatar folder to apply a fix.

An example of `iris_occlusion.json` :

```json
{
  "right_iris": [
    [4000, 4100],
    [3930, 3970]
  ],
  "left_iris": [
    [4470, 4605],
    [18370, 18799]
  ]
}
```

Each array `[start, end]` defines a range of Gaussian splat indices that belong to the iris. When eye blink blendshapes (eyeBlinkLeft, eyeBlinkRight) increase, these splats will smoothly fade out to prevent visual artifacts during eye closure.

If `iris_occlusion.json` is not present, the renderer will work normally without iris occlusion.

---

## Architecture Overview

### Rendering Pipeline

```
Loading (PLY) → Initialization (Viewer) → Scene Setup (SplatMesh) → Animation (FLAME)
→ Transform Update → Sorting (WebAssembly) → Drawing (WebGL)
```

1. **Loading**: Assets fetched from ZIP, PLY parsed via INRIAV1PlyParser
2. **Initialization**: Viewer creates WebGL context, materials, sort worker
3. **Scene Setup**: SplatMesh uploads data to GPU textures
4. **Animation**: FlameAnimator updates bone matrices, AnimationManager handles state transitions
5. **Transform Update**: Scene transforms applied, camera matrices computed
6. **Sorting**: WebAssembly radix sort produces depth-sorted indices
7. **Drawing**: Instanced rendering of sorted splats with alpha blending

### FLAME Integration

The library supports hybrid rendering where Gaussian Splat positions are deformed by FLAME's skeleton:

- **5 bones**: Root, Neck, Jaw, Left Eye, Right Eye
- **52 blendshapes**: Full ARKit compatibility for face tracking
- **LBS Skinning**: Splat positions transformed via bone matrices and blend weights
- **GPU-based**: All deformation computed in vertex shader via texture lookups
- **Iris Occlusion**: Optional dynamic iris fade during eye blinks (configured per-avatar via JSON)

---

## Directory Structure

| Module | Files | Description |
|--------|-------|-------------|
| `src/api/` | 1 | Public API layer |
| `src/buffers/` | 5 | GPU buffer management (SplatBuffer, partitioning) |
| `src/core/` | 6 | Rendering engine (Viewer, SplatMesh, SplatTree) |
| `src/enums/` | 8 | Constants and enumerations |
| `src/errors/` | 1 | Custom error classes (ValidationError, NetworkError, ParseError, etc.) |
| `src/flame/` | 5 | FLAME model integration (FlameAnimator, textures) |
| `src/loaders/` | 6 | PLY format loader (INRIA v1) |
| `src/materials/` | 4 | WebGL shaders (SplatMaterial2D/3D, conditional iris occlusion) |
| `src/raycaster/` | 4 | Intersection testing |
| `src/renderer/` | 4 | Application layer (GaussianSplatRenderer, AnimationManager) |
| `src/utils/` | 8 | Shared utilities (validation, logging, object pooling, blob management) |
| `src/worker/` | 2 | WebAssembly sorting worker |

### Key Components

| Component | Purpose |
|-----------|---------|
| **GaussianSplatRenderer** | Main entry point, ZIP loading, render loop, asset management |
| **Viewer** | Scene management, camera, render pipeline |
| **SplatMesh** | GPU textures, instanced geometry, iris config forwarding |
| **SplatMaterial3D** | WebGL shader generation, conditional iris occlusion code |
| **FlameAnimator** | Bone rotations, blendshape weights |
| **FlameTextureManager** | GPU texture uploads for FLAME data |
| **AnimationManager** | State machine (Idle, Listen, Think, Speak) |
| **PlyLoader** | Loading PLY files from ZIP with validation |
| **SortWorker** | WebAssembly depth sorting |
| **ValidationUtils** | Input validation (URLs, paths, ranges, types) |
| **Logger** | Structured logging system |
| **ObjectPool** | Object pooling for performance (Vector3, Quaternion) |
| **BlobUrlManager** | Blob URL lifecycle management |

---

## Build Output

Rollup produces optimized ESM and CommonJS bundles in `dist/`:

| File | Size | Format | Source Maps |
|------|------|--------|-------------|
| `gsplat-flame-avatar-renderer.esm.min.js`| 244 KB | ES Module (production, minified) | External (.map) |
| `gsplat-flame-avatar-renderer.cjs.min.js`| 246 KB | CommonJS (production, minified) | External (.map) |
| `gsplat-flame-avatar-renderer.esm.js` | 2.1 MB | ES Module (development, unminified) | Inline |
| `gsplat-flame-avatar-renderer.cjs.js` | 2.1 MB | CommonJS (development, unminified) | Inline |

** The minified builds are used by default** when importing the package. Development builds are automatically selected when `NODE_ENV=development`.

Type declarations are available at `dist/index.d.ts`, and the package publishes the `src/` folder for source inspection.

---

## Browser Compatibility

### Desktop
| Browser | Version | WebGL 2 | SharedArrayBuffer | Status |
|---------|---------|---------|-------------------|--------|
| Chrome | 80+ | ✓ | ✓ (with headers) | Fully Supported |
| Firefox | 75+ | ✓ | ✓ (with headers) | Fully Supported |
| Safari | 14+ | ✓ | ✓ (macOS 11.3+) | Fully Supported |
| Edge | 80+ | ✓ | ✓ (with headers) | Fully Supported |

### Mobile
| Browser | Version | Performance | Notes |
|---------|---------|-------------|-------|
| Safari iOS | 14.5+ | Good | Enable WebGL 2 in Settings |
| Chrome Android | 80+ | Good | May require reduced splat count |
| Samsung Internet | 13+ | Fair | Limited SharedArrayBuffer support |

**Known Limitations:**
- iOS Safari: WebGL context may be lost during backgrounding
- Android: Performance varies significantly by device
- Firefox Android: SharedArrayBuffer requires site isolation
---

## Deployment Requirements

### SharedArrayBuffer Configuration

This library uses WebAssembly with SharedArrayBuffer for high-performance splat sorting. To deploy in production, your server **must** send the following HTTP headers:

```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Without these headers, SharedArrayBuffer will be disabled by the browser and the renderer will fail to initialize.

---

## Credits & Attribution

This library is built upon the work of several open-source projects:

### Three.js
**The foundation for all 3D rendering.**
- Website: https://threejs.org/
- License: MIT
- Used for: WebGL rendering, scene graph, cameras, materials, geometry, animation mixer

### @mkkellogg/gaussian-splats-3d
**Base Gaussian Splat rendering engine.**
- Repository: https://github.com/mkkellogg/GaussianSplats3D
- Author: Mark Kellogg
- License: MIT
- Used for: Core splat rendering, buffers, loaders, raycaster, sorting worker, utilities

### gaussian-splat-renderer-for-lam
**FLAME avatar extensions and high-level API.**
- npm package: https://www.npmjs.com/package/gaussian-splat-renderer-for-lam
- License: MIT
- Used for: FLAME model integration, animation state machine, FlameAnimator, FlameTextureManager, GPU skinning shaders

### FLAME Model
**Parametric head model for facial animation.**
- Website: https://flame.is.tue.mpg.de/
- Institution: Max Planck Institute for Intelligent Systems
- Used for: 5-bone skeleton, 52 ARKit blendshapes, LBS skinning weights
