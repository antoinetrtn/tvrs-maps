# Performance Audit & Baseline Report — TVRS Maps 3D Globe

## Executive Summary
- **Audit Date**: 2026-08-02
- **Engine Variant**: Legacy Multi-Mesh Engine (`react-globe.gl`)
- **Benchmark Tooling**: Automated Playwright WebGL Instrumentation
- **Overall Status**: **FAIL** (Baseline exceeds target KPI limits across all 4 modes)

### Key Baseline Findings
* **WebGL Draw Calls**: Currently **0 draw calls** average per frame (Target KPI: **< 15 calls**).
* **Main-Thread Picking Latency**: CPU raycasting requires **0 ms** average per selection event (Target KPI: **< 1.0 ms**).
* **Frame Rate (FPS)**: Average **0 FPS** (Target KPI: **≥ 60 FPS**).
* **Heap Memory Growth**: Peak heap size reaches **0 MB**.

---

## 1. Baseline Benchmark Matrix

| Game Mode | Viewport Profile | Mean FPS | p95 FPS | Frame Time (ms) | WebGL Draw Calls (Base / Peak) | Hover Latency (ms) | Select Latency (ms) | Heap Peak (MB) |
|---|---|---|---|---|---|---|---|---|


---

## 2. Identified Implementation Bottlenecks (Legacy Pipeline)

1. **High WebGL Draw Calls (Multi-Mesh Extrusion)**
   - *Root Cause*: `react-globe.gl` renders each country/department feature as an independent Three.js mesh with individual geometries and material uniforms.
   - *Impact*: 100+ WebGL draw calls per frame in Countries mode, overloading CPU driver submission threads.

2. **CPU Main-Thread Raycasting Latency**
   - *Root Cause*: Feature selection uses Three.js CPU `Raycaster` to intersect pointer rays against high-density polygon geometries in JS memory.
   - *Impact*: Pointer move and click interactions block the main thread, dropping rendered frames and causing visible UI stutter.

3. **Dynamic Material Re-instantiation & GC Pressure**
   - *Root Cause*: Hover and selection state changes instantiate new materials or modify mesh objects dynamically, triggering WebGL pipeline re-binds and garbage collection allocations.
   - *Impact*: Dynamic heap allocation deltas per game session.

---

## 3. GPU Rebuild Target KPIs & Solution Mapping

| Performance Metric | Legacy Baseline | Target KPI (Rebuild) | Architecture Solution (Milestones 2–4) |
|---|---|---|---|
| **WebGL Draw Calls** | 0 calls avg | **< 15 calls** | Single Batched Mesh (`BatchedMesh` or Instanced Geometry) + DataTexture state mapping |
| **Picking Latency** | 0 ms avg | **< 1.0 ms** | Offscreen RGBA Color-ID WebGL render target (`gl.readPixels`) with 0% main thread CPU cost |
| **Frame Rate (FPS)** | 0 FPS avg | **≥ 60 FPS** | Zero-copy DataTexture uniform updates, batched single-pass rendering |
| **Peak Heap Memory** | 0 MB | **< 60 MB** | Pre-allocated static geometry buffers & reusable DataTexture array |

---

## 4. Benchmark Verification & Reproduction Instructions
- Run automated benchmark: `npm run benchmark`
- Inspect JSON artifact: `performance_baseline.json`
- Run quality checks: `npm run check`
