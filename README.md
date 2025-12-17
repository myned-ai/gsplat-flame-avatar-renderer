# gsplat-flame-avatar-renderer

[![npm version](https://img.shields.io/npm/v/@myned-ai/gsplat-flame-avatar-renderer.svg)](https://www.npmjs.com/package/@myned-ai/gsplat-flame-avatar-renderer)

A specialized Gaussian Splatting library for rendering animated 3D avatars with FLAME parametric head model support, LAM (Large Avatar Model) head avatars, and ARKit blendshape compatibility.

## Features

- 🎭 **52 ARKit Blendshapes** — Complete facial expression control
- 🔥 **FLAME Model Support** — Full integration with FLAME parametric head model
- 🎮 **Animation State Machine** — Built-in states (Idle, Listening, Thinking, Responding)
- ⚡ **GPU Optimized** — WebGL-based rendering with WebAssembly sorting
- 🎯 **Three.js Integration** — Works seamlessly with Three.js r150+
- 🧠 **LAM Head Avatars** — Support for Large Avatar Model based head avatars
- 📦 **ZIP Asset Loading** — Load compressed avatar assets directly
- 🔄 **Real-time Animation** — Smooth blendshape interpolation at 30fps

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

const renderer = await GaussianSplatRenderer.getInstance(
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
```

---

## API Reference

### GaussianSplatRenderer

The main class for rendering Gaussian splat avatars.

#### `GaussianSplatRenderer.getInstance(container, assetPath, options)`

Creates or returns a singleton renderer instance.

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
│   ├── offset.ply          # Gaussian splat point cloud
│   ├── animation.glb       # Animation clips
│   ├── skin.glb            # Skinning/skeleton data
│   └── vertex_order.json   # Vertex ordering data
```

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

---

## Directory Structure

| Module | Files | Description |
|--------|-------|-------------|
| `src/api/` | 1 | Public API layer |
| `src/buffers/` | 5 | GPU buffer management (SplatBuffer, partitioning) |
| `src/core/` | 6 | Rendering engine (Viewer, SplatMesh, SplatTree) |
| `src/enums/` | 8 | Constants and enumerations |
| `src/flame/` | 5 | FLAME model integration (FlameAnimator, textures) |
| `src/loaders/` | 6 | PLY format loader (INRIA v1) |
| `src/materials/` | 4 | WebGL shaders (SplatMaterial2D/3D) |
| `src/raycaster/` | 4 | Intersection testing |
| `src/renderer/` | 4 | Application layer (GaussianSplatRenderer, AnimationManager) |
| `src/utils/` | 3 | Shared utilities |
| `src/worker/` | 2 | WebAssembly sorting worker |

### Key Components

| Component | Purpose |
|-----------|---------|
| **GaussianSplatRenderer** | Main entry point, ZIP loading, render loop |
| **Viewer** | Scene management, camera, render pipeline |
| **SplatMesh** | GPU textures, instanced geometry |
| **FlameAnimator** | Bone rotations, blendshape weights |
| **FlameTextureManager** | GPU texture uploads for FLAME data |
| **AnimationManager** | State machine (Idle, Listen, Think, Speak) |
| **PlyLoader** | Loading PLY files from ZIP |
| **SortWorker** | WebAssembly depth sorting |

---

## Build Output

Rollup produces 4 bundles in `dist/`:

| File | Format |
|------|--------|
| `gsplat-flame-avatar.esm.js` | ES Module |
| `gsplat-flame-avatar.esm.min.js` | ES Module (minified) |
| `gsplat-flame-avatar.umd.js` | UMD |
| `gsplat-flame-avatar.umd.min.js` | UMD (minified) |

---

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

**Requires WebGL 2.0 support.**

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
