// 没有自带类型声明的第三方库
declare module 'n8ao' {
  import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
  import type * as THREE from 'three';
  export class N8AOPass extends Pass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    configuration: {
      aoRadius: number;
      distanceFalloff: number;
      intensity: number;
      gammaCorrection: boolean;
      halfRes: boolean;
      color: THREE.Color;
      transparencyAware: boolean;
      [k: string]: unknown;
    };
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
  }
}

// ez-tree 的源码入口（vite.config.ts 里的别名），类型沿用它发布的声明
declare module 'ez-tree-src' {
  export * from '@dgreenheck/ez-tree';
}
