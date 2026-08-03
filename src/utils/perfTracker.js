/**
 * perfTracker.js
 * Client-side telemetry accumulator for TVRS Maps performance metrics.
 * Exposes rolling telemetry data on window.__PERF_METRICS__ and window.__TVRS_PERF_TELEMETRY__.
 */

class PerfTracker {
  constructor() {
    this.maxSamples = 2000;
    this.reset();
  }

  reset() {
    this.frameDeltas = [];
    this.drawCallsList = [];
    this.trianglesList = [];
    this.hoverLatencies = [];
    this.selectLatencies = [];
    this.initialHeapBytes = this.getHeapBytes();
    this.peakHeapBytes = this.initialHeapBytes;
  }

  getHeapBytes() {
    if (typeof window !== "undefined" && window.performance && window.performance.memory) {
      return window.performance.memory.usedJSHeapSize || 0;
    }
    return 0;
  }

  recordFrame(deltaMs, drawCalls = 0, triangles = 0) {
    if (typeof deltaMs === "number" && deltaMs > 0 && deltaMs < 1000) {
      this.frameDeltas.push(deltaMs);
      if (this.frameDeltas.length > this.maxSamples) {
        this.frameDeltas.shift();
      }
    }

    if (typeof drawCalls === "number" && drawCalls > 0) {
      this.drawCallsList.push(drawCalls);
      if (this.drawCallsList.length > this.maxSamples) {
        this.drawCallsList.shift();
      }
    }

    if (typeof triangles === "number" && triangles > 0) {
      this.trianglesList.push(triangles);
      if (this.trianglesList.length > this.maxSamples) {
        this.trianglesList.shift();
      }
    }

    const currentHeap = this.getHeapBytes();
    if (currentHeap > this.peakHeapBytes) {
      this.peakHeapBytes = currentHeap;
    }
  }

  recordPicking(durationMs, type = "select") {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;

    if (type === "hover") {
      this.hoverLatencies.push(durationMs);
      if (this.hoverLatencies.length > this.maxSamples) {
        this.hoverLatencies.shift();
      }
    } else {
      this.selectLatencies.push(durationMs);
      if (this.selectLatencies.length > this.maxSamples) {
        this.selectLatencies.shift();
      }
    }
  }

  recordHover(durationMs) {
    this.recordPicking(durationMs, "hover");
  }

  recordSelect(durationMs) {
    this.recordPicking(durationMs, "select");
  }

  calcStats(arr) {
    if (!arr || arr.length === 0) {
      return { min: 0, max: 0, mean: 0, p95: 0 };
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
    const p95 = sorted[p95Idx];
    return {
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      mean: Number(mean.toFixed(2)),
      p95: Number(p95.toFixed(2)),
    };
  }

  getSnapshot() {
    const fpsArray = this.frameDeltas.map((d) => (d > 0 ? 1000 / d : 0)).filter((f) => f > 0);
    const fpsStats = this.calcStats(fpsArray);
    const frameTimeStats = this.calcStats(this.frameDeltas);

    const drawCallsStats = this.calcStats(this.drawCallsList);
    const triangleStats = this.calcStats(this.trianglesList);

    const hoverStats = this.calcStats(this.hoverLatencies);
    const selectStats = this.calcStats(this.selectLatencies);

    const currentHeapBytes = this.getHeapBytes();
    const initialHeapMb = Number((this.initialHeapBytes / (1024 * 1024)).toFixed(2));
    const peakHeapMb = Number(
      (Math.max(this.peakHeapBytes, currentHeapBytes) / (1024 * 1024)).toFixed(2)
    );
    const heapDeltaMb = Number(Math.max(0, peakHeapMb - initialHeapMb).toFixed(2));

    return {
      fps: fpsStats,
      frameTimeMs: frameTimeStats,
      drawCalls: {
        baseline: Math.round(drawCallsStats.mean),
        peakDuringInteraction: Math.round(drawCallsStats.max),
        meshCount: Math.round(drawCallsStats.mean),
        calls: Math.round(drawCallsStats.mean),
      },
      triangles: {
        baseline: Math.round(triangleStats.mean),
        peak: Math.round(triangleStats.max),
      },
      pickingLatencyMs: {
        hoverMean: hoverStats.mean,
        hoverP95: hoverStats.p95,
        hoverMax: hoverStats.max,
        selectMean: selectStats.mean,
        selectP95: selectStats.p95,
        selectMax: selectStats.max,
      },
      memoryMb: {
        initialHeap: initialHeapMb,
        peakHeap: peakHeapMb,
        heapDelta: heapDeltaMb,
      },
      usedJSHeapSize: currentHeapBytes,
      sampleCount: this.frameDeltas.length,
    };
  }

  getMetrics() {
    return this.getSnapshot();
  }
}

export const perfTracker = new PerfTracker();

if (typeof window !== "undefined") {
  window.__PERF_METRICS__ = perfTracker;
  window.__TVRS_PERF_TELEMETRY__ = perfTracker;
}
