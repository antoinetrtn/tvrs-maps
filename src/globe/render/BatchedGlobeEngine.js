import * as THREE from "three";

import { GLITCH_FRAGMENT_BODY } from "./globeShaders";

export const GLOBE_RADIUS = 100;

export function latLngToVector3(lat, lng, altitude = 0, radius = GLOBE_RADIUS) {
  const r = radius + altitude * radius;
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

export function createBatchedGlobeMaterial(dataTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDataTexture: { value: dataTexture },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aFeatureIndex;
      varying float vFeatureIndex;
      varying vec3 vNormal;
      void main() {
        vFeatureIndex = aFeatureIndex;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uDataTexture;
      uniform float uTime;
      varying float vFeatureIndex;
      varying vec3 vNormal;

      ${GLITCH_FRAGMENT_BODY}

      void main() {
        vec4 state = texture2D(uDataTexture, vec2(vFeatureIndex / 256.0, 0.5));
        float status = state.g * 255.0;

        if (status > 1.5) {
          // Selected country TV static glitch
          float noise = rand(gl_FragCoord.xy + vec2(uTime * 28.0));
          gl_FragColor = vec4(vec3(mix(0.12, 0.68, noise)), 1.0);
        } else if (status > 0.5) {
          // Found country green
          gl_FragColor = vec4(0.1, 0.8, 0.4, 1.0);
        } else {
          // Unfound country slate
          gl_FragColor = vec4(0.2, 0.25, 0.3, 0.8);
        }
      }
    `,
    transparent: true,
  });
}

export class BatchedGlobeEngine {
  constructor({ container, onPickFeature }) {
    this.container = container;
    this.onPickFeature = onPickFeature;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.camera.position.set(0, 0, 300);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (this.container) {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.container.appendChild(this.renderer.domElement);
    }

    this.featureMap = new Map();
    this.indexMap = new Map();
    this.dataTexture = null;
    this.dataArray = null;

    this.pickRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    this.pickScene = new THREE.Scene();

    this.capMesh = null;
    this.sideMesh = null;
    this.pickMesh = null;

    this.animFrameId = null;
    this.isDestroyed = false;
  }

  initDataTexture(featureCount) {
    const size = Math.max(16, Math.ceil(Math.sqrt(featureCount)));
    this.textureSize = size;
    this.dataArray = new Uint8Array(size * size * 4);
    this.dataTexture = new THREE.DataTexture(
      this.dataArray,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.dataTexture.needsUpdate = true;
  }

  updateFeatureState(
    adminKey,
    { isFound = false, isSelected = false, isError = false, regionIndex = 0, fadeProgress = 1.0 }
  ) {
    const index = this.featureMap.get(adminKey);
    if (index === undefined || !this.dataArray) return;

    const offset = index * 4;
    this.dataArray[offset] = regionIndex;
    this.dataArray[offset + 1] = isSelected ? 2 : isFound ? 1 : 0;
    this.dataArray[offset + 2] = Math.floor(fadeProgress * 255);
    this.dataArray[offset + 3] = isError ? 255 : 0;

    if (this.dataTexture) {
      this.dataTexture.needsUpdate = true;
    }
  }

  pickAtPixel(x, y) {
    if (!this.pickMesh || !this.renderer) return null;

    const width = this.container ? this.container.clientWidth : 1;
    const height = this.container ? this.container.clientHeight : 1;

    this.camera.setViewOffset(width, height, x, y, 1, 1);
    this.renderer.setRenderTarget(this.pickRenderTarget);
    this.renderer.render(this.pickScene, this.camera);

    const pixelBuffer = new Uint8Array(4);
    this.renderer.readRenderTargetPixels(this.pickRenderTarget, 0, 0, 1, 1, pixelBuffer);

    this.renderer.setRenderTarget(null);
    this.camera.clearViewOffset();

    const r = pixelBuffer[0];
    const g = pixelBuffer[1];
    const pickedIndex = r + g * 256 - 1;

    if (pickedIndex >= 0 && this.indexMap.has(pickedIndex)) {
      return this.indexMap.get(pickedIndex);
    }
    return null;
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.renderer && this.renderer.domElement && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    if (this.pickRenderTarget) {
      this.pickRenderTarget.dispose();
    }
  }
}
